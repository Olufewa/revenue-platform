import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { API_KEY_SCHEME } from '../swagger.js';
import { ListPageDto } from '../common/list-page.dto.js';
import { ApiKeyGuard } from '../services/api-key.guard.js';
import { CurrentService } from '../services/current-service.decorator.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Orders')
@ApiSecurity(API_KEY_SCHEME)
@Controller('orders')
@UseGuards(ApiKeyGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @Body() dto: CreateOrderDto,
    @CurrentService() service: { id: string },
  ) {
    return this.orders.create(service.id, dto);
  }

  @Get()
  list(@Query() query: ListPageDto, @CurrentService() service: { id: string }) {
    return this.orders.list(service.id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentService() service: { id: string }) {
    return this.orders.findOne(service.id, id);
  }
}
