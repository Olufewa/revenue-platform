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
import type { ServiceEntity } from '../services/entities/service.entity.js';
import {
  CreateStandaloneTransactionDto,
  CreateTransactionDto,
} from './dto/create-transaction.dto.js';
import { ReverseTransactionDto } from './dto/reverse-transaction.dto.js';
import { TransactionsService } from './transactions.service.js';

@ApiTags('Transactions')
@ApiSecurity(API_KEY_SCHEME)
@Controller()
@UseGuards(ApiKeyGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Post('orders/:orderId/transactions')
  record(
    @Param('orderId') orderId: string,
    @Body() dto: CreateTransactionDto,
    @CurrentService() service: ServiceEntity,
  ) {
    return this.transactions.record(service, orderId, dto);
  }

  @Get('orders/:orderId/transactions')
  listForOrder(
    @Param('orderId') orderId: string,
    @CurrentService() service: ServiceEntity,
  ) {
    return this.transactions.listForOrder(service.id, orderId);
  }

  @Get('orders/:orderId/summary')
  summary(
    @Param('orderId') orderId: string,
    @CurrentService() service: ServiceEntity,
  ) {
    return this.transactions.summary(service, orderId);
  }

  @Post('transactions')
  recordStandalone(
    @Body() dto: CreateStandaloneTransactionDto,
    @CurrentService() service: ServiceEntity,
  ) {
    const { orderId, ...body } = dto;
    return this.transactions.record(service, orderId ?? null, body);
  }

  @Get('transactions')
  list(@Query() query: ListPageDto, @CurrentService() service: ServiceEntity) {
    return this.transactions.list(service.id, query);
  }

  @Get('transactions/:id')
  findOne(@Param('id') id: string, @CurrentService() service: ServiceEntity) {
    return this.transactions.findOne(service.id, id);
  }

  @Post('transactions/:id/reverse')
  reverse(
    @Param('id') id: string,
    @Body() dto: ReverseTransactionDto,
    @CurrentService() service: ServiceEntity,
  ) {
    return this.transactions.reverse(service, id, dto);
  }
}
