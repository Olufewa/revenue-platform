import { api, ApiError, loginOrRegister } from './api.ts';
import { accountsFor, SERVICES } from './catalog.ts';
import { loadServices, saveServices, type SavedService } from './state.ts';

const token = await loginOrRegister(process.env.DEMO_EMAIL!, process.env.DEMO_PASSWORD!);
console.log(`Logged in as ${process.env.DEMO_EMAIL}`);

const existing: { id: string; name: string }[] = await api('GET', '/services', { token });
const saved = loadServices();
const result: SavedService[] = [];

for (const mock of SERVICES) {
  let service = existing.find((s) => s.name === mock.name);
  if (!service) {
    service = await api('POST', '/services', { token }, {
      name: mock.name,
      baseCurrency: 'NGN',
      timezone: 'Africa/Lagos',
    });
    console.log(`Created service ${mock.name}`);
  }
  const serviceId = service!.id;

  for (const account of accountsFor(mock)) {
    try {
      await api('POST', `/services/${serviceId}/accounts`, { token }, account);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error;
    }
  }

  let apiKey = saved.find((s) => s.id === serviceId)?.apiKey;
  if (!apiKey) {
    const minted = await api('POST', `/services/${serviceId}/keys`, { token }, { name: 'simulator' });
    apiKey = minted.key as string;
    console.log(`Minted API key for ${mock.name}`);
  }

  result.push({ id: serviceId, name: mock.name, incomeAccount: mock.incomeAccount, apiKey });
}

saveServices(result);
console.log(`Ready: ${result.length} services saved to state/services.json`);
