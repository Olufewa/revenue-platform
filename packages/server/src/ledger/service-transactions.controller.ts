import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ListPageDto } from '../common/list-page.dto.js';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { TransactionsService } from './transactions.service.js';

@Controller('services/:serviceId')
@UseGuards(AuthGuard)
export class ServiceTransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('orders/:orderId/transactions')
  listForOrder(
    @Param('serviceId') serviceId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.transactions.listForOrderForUser(serviceId, user.sub, orderId);
  }

  @Get('orders/:orderId/summary')
  summary(
    @Param('serviceId') serviceId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.transactions.summaryForUser(serviceId, user.sub, orderId);
  }

  @Get('transactions')
  list(
    @Param('serviceId') serviceId: string,
    @Query() query: ListPageDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.transactions.listForUser(serviceId, user.sub, query);
  }

  @Get('transactions/:id')
  findOne(
    @Param('serviceId') serviceId: string,
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.transactions.findOneForUser(serviceId, user.sub, id);
  }
}
