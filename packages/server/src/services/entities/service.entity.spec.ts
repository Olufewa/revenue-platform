import { describe, expect, it } from 'vitest';
import { ServiceEntity } from './service.entity.js';

describe('ServiceEntity', () => {
  it('generates a slug from the name with a random suffix', () => {
    expect(ServiceEntity.generateSlug('MTN Airtime Service')).toMatch(
      /^mtn-airtime-service-[0-9a-f]{8}$/,
    );
  });

  it('strips accents and symbols and truncates long names', () => {
    const slug = ServiceEntity.generateSlug('Café & Crème — a very long service name indeed');
    const base = slug.slice(0, slug.lastIndexOf('-'));

    expect(base).toMatch(/^[a-z0-9-]+$/);
    expect(base.length).toBeLessThanOrEqual(25);
    expect(base.startsWith('cafe-creme')).toBe(true);
  });

  it('falls back to the suffix alone when the name has no usable characters', () => {
    expect(ServiceEntity.generateSlug('!!!')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('checks ownership', () => {
    const service = ServiceEntity.fromRecord({
      id: 'svc_1',
      slug: 'airtime-1a2b3c4d',
      name: 'Airtime',
      baseCurrency: 'NGN',
      ownerId: 'usr_1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(service.isOwnedBy('usr_1')).toBe(true);
    expect(service.isOwnedBy('usr_2')).toBe(false);
  });
});
