export type Product = {
  description: string;
  minNaira: number;
  maxNaira: number;
  vatInclusive: boolean;
};

export type MockService = {
  name: string;
  incomeAccount: string;
  products: Product[];
};

export const SERVICES: MockService[] = [
  {
    name: 'MTN Data Bundles',
    incomeAccount: 'bundle_revenue',
    products: [
      { description: '1GB daily bundle', minNaira: 350, maxNaira: 350, vatInclusive: true },
      { description: '2.5GB weekly bundle', minNaira: 1000, maxNaira: 1000, vatInclusive: true },
      { description: '10GB monthly bundle', minNaira: 3500, maxNaira: 3500, vatInclusive: true },
    ],
  },
  {
    name: 'MoMo',
    incomeAccount: 'fee_income',
    products: [
      { description: 'Transfer fee', minNaira: 10, maxNaira: 100, vatInclusive: false },
      { description: 'Bill payment fee', minNaira: 50, maxNaira: 100, vatInclusive: false },
    ],
  },
  {
    name: 'MyCityApp',
    incomeAccount: 'ticket_revenue',
    products: [
      { description: 'Event ticket', minNaira: 500, maxNaira: 5000, vatInclusive: true },
      { description: 'Cinema ticket', minNaira: 2000, maxNaira: 4500, vatInclusive: true },
    ],
  },
  {
    name: 'VAS Subscriptions',
    incomeAccount: 'subscription_revenue',
    products: [
      { description: 'Daily caller tune', minNaira: 50, maxNaira: 50, vatInclusive: true },
      { description: 'Weekly news alerts', minNaira: 100, maxNaira: 100, vatInclusive: true },
    ],
  },
];

export function accountsFor(service: MockService) {
  return [
    { code: 'cash', name: 'Cash received', type: 'ASSET' },
    { code: 'vat_payable', name: 'VAT payable', type: 'LIABILITY' },
    { code: service.incomeAccount, name: `${service.name} revenue`, type: 'INCOME' },
  ];
}
