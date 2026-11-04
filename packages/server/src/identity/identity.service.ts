import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TransactionRunner } from '../prisma/transaction-runner.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  RefreshTokenEntity,
} from './entities/refresh-token.entity.js';
import { UserEntity } from './entities/user.entity.js';
import { RefreshTokenRepository } from './refresh-token.repository.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class IdentityService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly transactions: TransactionRunner,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('That email is already registered');
    }

    return this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash: await UserEntity.hashPassword(dto.password),
    });
  }

  /** Starts a new session: one login on one device is one token family. */
  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);

    if (!user || !(await user.verifyPassword(dto.password))) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const now = new Date();
    await this.refreshTokens.deleteExpiredForUser(user.id, now);

    return this.issueTokens(user, randomUUID(), this.refreshTokens, now);
  }

  /**
   * Exchanges a refresh token for a new pair. A token presented again after
   * its grace window means two parties hold it, so the whole family is revoked.
   */
  async refresh(presented: string) {
    const now = new Date();

    // Returns null rather than throwing inside the transaction, because
    // throwing would roll back the family revocation.
    const tokens = await this.transactions.run(async (tx) => {
      const refreshTokens = this.refreshTokens.withTx(tx);
      const current = await refreshTokens.findByHash(
        RefreshTokenEntity.hash(presented),
      );

      if (!current?.isUsable(now)) return null;

      if (current.isReplay(now)) {
        await refreshTokens.revokeFamily(current.familyId, now);
        return null;
      }

      const user = await this.users.withTx(tx).findById(current.userId);
      if (!user) return null;

      await refreshTokens.markRotated(current.id, now);
      return this.issueTokens(user, current.familyId, refreshTokens, now);
    });

    if (!tokens) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return tokens;
  }

  /** Ends this session. Unknown tokens succeed too, as there's nothing to end. */
  async logout(presented: string): Promise<void> {
    const current = await this.refreshTokens.findByHash(
      RefreshTokenEntity.hash(presented),
    );

    if (current) {
      await this.refreshTokens.revokeFamily(current.familyId, new Date());
    }
  }

  async findById(id: string) {
    const user = await this.users.findById(id);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  private async issueTokens(
    user: UserEntity,
    familyId: string,
    refreshTokens: RefreshTokenRepository,
    now: Date,
  ) {
    const { plainToken, tokenHash, expiresAt } =
      RefreshTokenEntity.generate(now);

    await refreshTokens.create({
      tokenHash,
      familyId,
      userId: user.id,
      expiresAt,
    });

    return {
      access_token: await this.jwt.signAsync({
        sub: user.id,
        email: user.email,
      }),
      refresh_token: plainToken,
      refresh_expires_in: REFRESH_TOKEN_TTL_SECONDS,
    };
  }
}
