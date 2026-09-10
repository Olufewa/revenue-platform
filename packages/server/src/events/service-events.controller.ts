import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { EventsService } from './events.service.js';
import { ListEventsDto } from './dto/list-events.dto.js';

@Controller('services/:serviceId/events')
@UseGuards(AuthGuard)
export class ServiceEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(
    @Param('serviceId') serviceId: string,
    @Query() query: ListEventsDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.events.listForUser(serviceId, user.sub, query);
  }

  @Get('summary')
  summary(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.events.summaryForUser(serviceId, user.sub);
  }
}
