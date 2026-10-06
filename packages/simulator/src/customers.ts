import { fakerEN_NG as faker } from '@faker-js/faker';

export type Customer = {
  msisdn: string;
  name: string;
  city: string;
  channel: string;
};

const MTN_PREFIXES = ['0803', '0806', '0703', '0706', '0813', '0816', '0810', '0814', '0903', '0906', '0913', '0916'];
const CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan', 'Enugu', 'Benin City', 'Kaduna', 'Jos', 'Abeokuta'];

export function buildCustomerPool(size: number): Customer[] {
  faker.seed(2026);

  return Array.from({ length: size }, () => ({
    msisdn: faker.helpers.arrayElement(MTN_PREFIXES) + faker.string.numeric(7),
    name: faker.person.fullName(),
    city: faker.helpers.arrayElement(CITIES),
    channel: faker.helpers.weightedArrayElement([
      { weight: 50, value: 'ussd' },
      { weight: 35, value: 'app' },
      { weight: 15, value: 'web' },
    ]),
  }));
}
