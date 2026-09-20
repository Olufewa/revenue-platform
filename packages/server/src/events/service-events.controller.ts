import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { EventsService } from './events.service.js';
import { ListEventsDto } from './dto/list-events.dto.js';

@Controller('services/:serviceId/events')
@UseGuards(AuthGuard)
export class ServiceEventsController {
  constructor(private readonly events: EventsService) {}

  @Get('summary')
  summary(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.events.summaryForUser(serviceId, user.sub);
  }

  @Get(':eventId/adjustments')
  adjustments(
    @Param('serviceId') serviceId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.events.getAdjustmentsForUser(serviceId, user.sub, eventId);
  }

  @Get()
  list(
    @Param('serviceId') serviceId: string,
    @Query() query: ListEventsDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.events.listForUser(serviceId, user.sub, query);
  }
}
