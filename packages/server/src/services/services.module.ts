import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';
import { ApiKeysService } from './api-keys.service.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  // IdentityModule is imported for AuthGuard and the JwtService behind it.
  // PrismaModule is global, so it does not need importing.
  imports: [IdentityModule],
  controllers: [ServicesController],
  providers: [ServicesService, ApiKeysService, ApiKeyGuard, RolesGuard],
  exports: [ServicesService],
})
export class ServicesModule {}
