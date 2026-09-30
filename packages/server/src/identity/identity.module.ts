import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AUTH_THROTTLE } from './auth-throttle.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';
import { AuthGuard } from './auth.guard.js';
import { UserRepository } from './user.repository.js';

@Module({
  imports: [
    ThrottlerModule.forRoot(AUTH_THROTTLE),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [IdentityController],
  providers: [IdentityService, AuthGuard, UserRepository],
  exports: [JwtModule, AuthGuard, UserRepository],
})
export class IdentityModule {}
