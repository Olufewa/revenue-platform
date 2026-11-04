import { randomUUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { api } from './api.ts';
import { SERVICES } from './catalog.ts';
import { buildCustomerPool } from './customers.ts';
import { loadServices } from './state.ts';
import { splitVat } from './vat.ts';

const services = loadServices();
if (services.length === 0) {
  console.error('No services found. Run `npm run sim:setup` first.');
  process.exit(1);
}

const customers = buildCustomerPool(200);
console.log(`Sending traffic for ${customers.length} customers across ${services.length} services. Ctrl+C to stop.`);

async function sendOne() {
  const service = faker.helpers.arrayElement(services);
  const mock = SERVICES.find((s) => s.name === service.name)!;
  const product = faker.helpers.arrayElement(mock.products);
  const customer = faker.helpers.arrayElement(customers);

  const price = faker.number.int({ min: product.minNaira, max: product.maxNaira }) * 100;
  const now = new Date().toISOString();
  const externalId = `live-${randomUUID()}`;
  const auth = { apiKey: service.apiKey };

  const { order } = await api('POST', '/orders', auth, {
    externalId,
    amount: price,
    currency: 'NGN',
    placedAt: now,
    description: product.description,
    customerRef: customer.msisdn,
    metadata: { channel: customer.channel, city: customer.city, customerName: customer.name },
  });

  const entries = [{ accountCode: 'cash', direction: 'DEBIT', amount: price }];
  if (product.vatInclusive) {
    const { vat, net } = splitVat(price);
    entries.push({ accountCode: 'vat_payable', direction: 'CREDIT', amount: vat });
    entries.push({ accountCode: service.incomeAccount, direction: 'CREDIT', amount: net });
  } else {
    entries.push({ accountCode: service.incomeAccount, direction: 'CREDIT', amount: price });
  }

  await api('POST', `/orders/${order.id}/transactions`, auth, {
    externalId: `${externalId}-sale`,
    occurredAt: now,
    description: product.description,
    entries,
  });

  console.log(`${new Date().toLocaleTimeString('en-GB')}  ${service.name.padEnd(18)} ₦${(price / 100).toLocaleString().padStart(6)}  ${customer.name} (${customer.msisdn}, ${customer.channel})`);
}

while (true) {
  try {
    await sendOne();
  } catch (error) {
    console.error((error as Error).message);
  }
  await new Promise((resolve) => setTimeout(resolve, faker.number.int({ min: 2000, max: 5000 })));
}
