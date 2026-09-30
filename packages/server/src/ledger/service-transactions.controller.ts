import { Controller, Get, Param, UseGuards } from '@nestjs/common';
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

  @Get('transactions/:id')
  findOne(
    @Param('serviceId') serviceId: string,
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.transactions.findOneForUser(serviceId, user.sub, id);
  }
}
