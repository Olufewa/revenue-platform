import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';
import { AuthGuard } from './auth.guard.js';

@Module({
  imports: [

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

  exports: [JwtModule, AuthGuard],
})
export class IdentityModule {}
