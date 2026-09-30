import { describe, expect, it } from 'vitest';
import { UserEntity } from './user.entity.js';

describe('UserEntity', () => {
  const record = async (role: 'ADMIN' | 'MEMBER' = 'MEMBER') => ({
    id: 'usr_1',
    email: 'jane@mtn.test',
    name: 'Jane Doe',
    role,
    passwordHash: await UserEntity.hashPassword('Password123!'),
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  });

  it('verifies the password against the stored hash', async () => {
    const user = UserEntity.fromRecord(await record());

    expect(await user.verifyPassword('Password123!')).toBe(true);
    expect(await user.verifyPassword('incorrectpassword')).toBe(false);
  });

  it('never serialises the password hash', async () => {
    const json = JSON.parse(JSON.stringify(UserEntity.fromRecord(await record())));

    expect(json).toEqual({
      id: 'usr_1',
      email: 'jane@mtn.test',
      name: 'Jane Doe',
      createdAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('knows whether the user is an admin', async () => {
    expect(UserEntity.fromRecord(await record('ADMIN')).isAdmin).toBe(true);
    expect(UserEntity.fromRecord(await record('MEMBER')).isAdmin).toBe(false);
  });
});
