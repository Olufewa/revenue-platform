import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { BalancesQueryDto } from './dto/balances-query.dto.js';
import { DateRangeDto } from './dto/date-range.dto.js';
import { ReportsService } from './reports.service.js';

@Controller('services/:serviceId')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('balances')
  balances(
    @Param('serviceId') serviceId: string,
    @Query() query: BalancesQueryDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.reports.balances(serviceId, user.sub, query);
  }

  @Get('reports/revenue')
  revenue(
    @Param('serviceId') serviceId: string,
    @Query() query: DateRangeDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.reports.revenue(serviceId, user.sub, query);
  }
}
