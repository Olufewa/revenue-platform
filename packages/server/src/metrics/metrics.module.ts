import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ServicesModule } from '../services/services.module.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { ServiceMetricsController } from './service-metrics.controller.js';

@Module({
  imports: [IdentityModule, ServicesModule],
  controllers: [ServiceMetricsController, MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
