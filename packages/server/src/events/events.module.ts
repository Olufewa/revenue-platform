import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ServicesModule } from '../services/services.module.js';
import { EventsController } from './events.controller.js';
import { ServiceEventsController } from './service-events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [IdentityModule, ServicesModule],
  controllers: [EventsController, ServiceEventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
