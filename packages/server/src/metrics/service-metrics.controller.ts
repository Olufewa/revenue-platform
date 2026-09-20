import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { DateRangeDto } from './dto/date-range.dto.js';
import { MetricsService } from './metrics.service.js';

@Controller('services/:serviceId')
@UseGuards(AuthGuard)
export class ServiceMetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Post('aggregates/rebuild')
  rebuild(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.metrics.rebuildAggregates(serviceId, user.sub);
  }

  @Get('metrics')
  getMetrics(
    @Param('serviceId') serviceId: string,
    @Query() query: DateRangeDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.metrics.getMetrics(serviceId, user.sub, query);
  }

  @Get('health')
  getHealth(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.metrics.getHealth(serviceId, user.sub);
  }
}
