import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';
import { ApiKeysService } from './api-keys.service.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { RolesGuard } from './roles.guard.js';
import { ServiceRepository } from './service.repository.js';
import { ApiKeyRepository } from './api-key.repository.js';

@Module({
  imports: [IdentityModule],
  controllers: [ServicesController],
  providers: [
    ServicesService,
    ApiKeysService,
    ApiKeyGuard,
    RolesGuard,
    ServiceRepository,
    ApiKeyRepository,
  ],
  exports: [ServicesService, ApiKeyGuard, ServiceRepository, ApiKeyRepository],
})
export class ServicesModule {}
