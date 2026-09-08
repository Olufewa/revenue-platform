import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';
import { AuthGuard } from './auth.guard.js';

@Module({
  imports: [
    // registerAsync, not register, because the secret comes from .env and the
    // config has to be loaded before we can read it. getOrThrow means the app
    // refuses to start without JWT_SECRET, rather than starting and signing
    // every token with undefined.
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
  providers: [IdentityService, AuthGuard],
  // AuthGuard is exported so other modules can put @UseGuards(AuthGuard) on
  // their routes without re-declaring it. JwtModule goes with it because that
  // is where the guard gets JwtService from.
  exports: [JwtModule, AuthGuard],
})
export class IdentityModule {}
