import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ListPageDto } from '../common/list-page.dto.js';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('services/:serviceId/orders')
@UseGuards(AuthGuard)
export class ServiceOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @Param('serviceId') serviceId: string,
    @Query() query: ListPageDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.orders.listForUser(serviceId, user.sub, query);
  }

  @Get(':orderId')
  findOne(
    @Param('serviceId') serviceId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.orders.findOneForUser(serviceId, user.sub, orderId);
  }
}
