export type PostingLine = {
  accountCode: string;
  direction: 'DEBIT' | 'CREDIT';
  numerator: number;
  denominator: number;
};

export type AllocatedLine = {
  accountCode: string;
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: bigint;
};

export function allocate(amountMinor: bigint, lines: PostingLine[]): AllocatedLine[] {
  let lastDebitIndex = -1;
  let lastCreditIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].direction === 'DEBIT') {
      lastDebitIndex = i;
    } else if (lines[i].direction === 'CREDIT') {
      lastCreditIndex = i;
    }
  }

  if (lastDebitIndex === -1 || lastCreditIndex === -1) {
    throw new Error('Rule must contain at least one DEBIT and one CREDIT line');
  }

  const result: AllocatedLine[] = [];
  let debitSum = 0n;
  let creditSum = 0n;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const num = BigInt(line.numerator);
    const den = BigInt(line.denominator);

    if (line.direction === 'DEBIT') {
      if (i === lastDebitIndex) {
        const amount = amountMinor - debitSum;
        debitSum += amount;
        result.push({ accountCode: line.accountCode, direction: 'DEBIT', amountMinor: amount });
      } else {
        const amount = (amountMinor * num + den / 2n) / den;
        debitSum += amount;
        result.push({ accountCode: line.accountCode, direction: 'DEBIT', amountMinor: amount });
      }
    } else {
      if (i === lastCreditIndex) {
        const amount = amountMinor - creditSum;
        creditSum += amount;
        result.push({ accountCode: line.accountCode, direction: 'CREDIT', amountMinor: amount });
      } else {
        const amount = (amountMinor * num + den / 2n) / den;
        creditSum += amount;
        result.push({ accountCode: line.accountCode, direction: 'CREDIT', amountMinor: amount });
      }
    }
  }

  if (debitSum !== creditSum || debitSum !== amountMinor) {
    throw new Error('Debits and credits do not balance');
  }

  return result;
}
