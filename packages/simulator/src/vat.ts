export function splitVat(priceKobo: number) {
  const vat = Math.floor((priceKobo * 75 + 1075 / 2) / 1075);
  return { vat, net: priceKobo - vat };
}
