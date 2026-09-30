import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ServicesModule } from '../services/services.module.js';
import { OrderRepository } from './order.repository.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { ServiceOrdersController } from './service-orders.controller.js';

@Module({
  imports: [IdentityModule, ServicesModule],
  controllers: [OrdersController, ServiceOrdersController],
  providers: [OrdersService, OrderRepository],
  exports: [OrdersService],
})
export class OrdersModule {}
