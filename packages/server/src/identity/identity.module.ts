import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';
import { AuthGuard } from './auth.guard.js';
import { RefreshTokenRepository } from './refresh-token.repository.js';
import { UserRepository } from './user.repository.js';

const ACCESS_TOKEN_TTL = '15m';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: ACCESS_TOKEN_TTL },
      }),
    }),
  ],
  controllers: [IdentityController],
  providers: [
    IdentityService,
    AuthGuard,
    UserRepository,
    RefreshTokenRepository,
  ],
  exports: [JwtModule, AuthGuard, UserRepository],
})
export class IdentityModule {}
