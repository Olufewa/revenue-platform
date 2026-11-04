import bcrypt from 'bcryptjs';
import type { Role, User } from '../../generated/prisma/client.js';

export class UserEntity {
  private constructor(
    readonly id: string,
    readonly email: string,
    readonly name: string,
    readonly role: Role,
    readonly createdAt: Date,
    private readonly passwordHash: string,
  ) {}

  static fromRecord(row: User): UserEntity {
    return new UserEntity(
      row.id,
      row.email,
      row.name,
      row.role,
      row.createdAt,
      row.passwordHash,
    );
  }

  static hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  verifyPassword(plain: string): Promise<boolean> {
    return bcrypt.compare(plain, this.passwordHash);
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      createdAt: this.createdAt,
    };
  }
}
