import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UserEntity } from './entities/user.entity.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class IdentityService {
  constructor(
    private readonly users: UserRepository,
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

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);

    if (!user || !(await user.verifyPassword(dto.password))) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });

    return { access_token: token };
  }

  async findById(id: string) {
    const user = await this.users.findById(id);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
