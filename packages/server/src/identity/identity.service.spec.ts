import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  RefreshTokenEntity,
} from './entities/refresh-token.entity.js';
import { UserEntity } from './entities/user.entity.js';
import { IdentityService } from './identity.service.js';

const user = UserEntity.fromRecord({
  id: 'usr_1',
  email: 'ada@mtn.test',
  name: 'Ada',
  role: 'MEMBER',
  passwordHash: 'unused',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const stored = (
  overrides: {
    expiresAt?: Date;
    rotatedAt?: Date | null;
    revokedAt?: Date | null;
  } = {},
) =>
  RefreshTokenEntity.fromRecord({
    id: 'rt_1',
    tokenHash: 'hash',
    familyId: 'family_1',
    userId: user.id,
    createdAt: new Date(),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
    rotatedAt: overrides.rotatedAt ?? null,
    revokedAt: overrides.revokedAt ?? null,
  });

describe('IdentityService', () => {
  const refreshTokens = {
    withTx: vi.fn(),
    findByHash: vi.fn(),
    create: vi.fn(),
    markRotated: vi.fn(),
    revokeFamily: vi.fn(),
    deleteExpiredForUser: vi.fn(),
  };
  const users = {
    withTx: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
  };
  const transactions = { run: vi.fn() };
  const jwt = { signAsync: vi.fn() };
  const service = new IdentityService(
    users as never,
    refreshTokens as never,
    transactions as never,
    jwt as never,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    refreshTokens.withTx.mockReturnValue(refreshTokens);
    users.withTx.mockReturnValue(users);
    users.findById.mockResolvedValue(user);
    transactions.run.mockImplementation((fn) => fn({}));
    jwt.signAsync.mockResolvedValue('new.access.token');
  });

  describe('login', () => {
    beforeEach(() => {
      users.findByEmail.mockResolvedValue(user);
      vi.spyOn(user, 'verifyPassword').mockResolvedValue(true);
    });

    it('returns both tokens and stores only the hash', async () => {
      const tokens = await service.login({
        email: user.email,
        password: 'Password123!',
      });

      expect(tokens).toEqual({
        access_token: 'new.access.token',
        refresh_token: expect.any(String),
        refresh_expires_in: REFRESH_TOKEN_TTL_SECONDS,
      });

      const created = refreshTokens.create.mock.calls[0]?.[0];
      expect(created.tokenHash).toBe(
        RefreshTokenEntity.hash(tokens.refresh_token),
      );
      expect(JSON.stringify(created)).not.toContain(tokens.refresh_token);
    });

    it('starts a new family for each login', async () => {
      const credentials = { email: user.email, password: 'Password123!' };

      await service.login(credentials);
      await service.login(credentials);

      const [first, second] = refreshTokens.create.mock.calls;
      expect(first?.[0].familyId).not.toBe(second?.[0].familyId);
    });

    it('clears out the expired tokens of that user', async () => {
      await service.login({ email: user.email, password: 'Password123!' });

      expect(refreshTokens.deleteExpiredForUser).toHaveBeenCalledWith(
        user.id,
        expect.any(Date),
      );
    });

    it('issues nothing for a wrong password', async () => {
      vi.spyOn(user, 'verifyPassword').mockResolvedValue(false);

      await expect(
        service.login({ email: user.email, password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('looks up the token by its hash', async () => {
      refreshTokens.findByHash.mockResolvedValue(stored());

      await service.refresh('presented');

      expect(refreshTokens.findByHash).toHaveBeenCalledWith(
        RefreshTokenEntity.hash('presented'),
      );
    });

    it('rotates a current token within the same family', async () => {
      refreshTokens.findByHash.mockResolvedValue(stored());

      const tokens = await service.refresh('presented');

      expect(refreshTokens.markRotated).toHaveBeenCalledWith(
        'rt_1',
        expect.any(Date),
      );
      expect(refreshTokens.create.mock.calls[0]?.[0].familyId).toBe('family_1');
      expect(tokens.refresh_token).not.toBe('presented');
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
      });
    });

    it('treats a repeat inside the grace window as a normal rotation', async () => {
      refreshTokens.findByHash.mockResolvedValue(
        stored({ rotatedAt: new Date(Date.now() - 2_000) }),
      );

      await expect(service.refresh('presented')).resolves.toMatchObject({
        access_token: 'new.access.token',
      });
      expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
    });

    it('revokes the family on a replay, without rolling that back', async () => {
      refreshTokens.findByHash.mockResolvedValue(
        stored({ rotatedAt: new Date(Date.now() - 60_000) }),
      );

      await expect(service.refresh('presented')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith(
        'family_1',
        expect.any(Date),
      );
      expect(refreshTokens.create).not.toHaveBeenCalled();
      // A rejected transaction would roll back the revocation.
      await expect(transactions.run.mock.results[0]?.value).resolves.toBeNull();
    });

    it.each([
      ['unknown', null],
      ['expired', stored({ expiresAt: new Date(Date.now() - 1) })],
      ['revoked', stored({ revokedAt: new Date() })],
    ])(
      'rejects an %s token without issuing or revoking',
      async (_label, row) => {
        refreshTokens.findByHash.mockResolvedValue(row);

        await expect(service.refresh('presented')).rejects.toBeInstanceOf(
          UnauthorizedException,
        );

        expect(refreshTokens.create).not.toHaveBeenCalled();
        expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
      },
    );
  });

  describe('logout', () => {
    it('revokes the family', async () => {
      refreshTokens.findByHash.mockResolvedValue(stored());

      await service.logout('presented');

      expect(refreshTokens.revokeFamily).toHaveBeenCalledWith(
        'family_1',
        expect.any(Date),
      );
    });

    it('succeeds quietly for an unknown token', async () => {
      refreshTokens.findByHash.mockResolvedValue(null);

      await expect(service.logout('presented')).resolves.toBeUndefined();
      expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
    });
  });
});
