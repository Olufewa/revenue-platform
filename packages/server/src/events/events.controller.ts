import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../services/api-key.guard.js';
import { CurrentService } from '../services/current-service.decorator.js';
import { EventsService } from './events.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { ListEventsDto } from './dto/list-events.dto.js';

@Controller('events')
@UseGuards(ApiKeyGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @HttpCode(202)
  ingest(@Body() dto: CreateEventDto, @CurrentService() service: { id: string }) {
    return this.events.ingest(service.id, dto);
  }

  @Get()
  list(@Query() query: ListEventsDto, @CurrentService() service: { id: string }) {
    return this.events.list(service.id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentService() service: { id: string }) {
    return this.events.findOne(service.id, id);
  }
}
