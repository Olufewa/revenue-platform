import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../identity/auth.guard.js';
import { Roles } from '../services/roles.decorator.js';
import { RolesGuard } from '../services/roles.guard.js';
import { DateRangeDto } from './dto/date-range.dto.js';
import { MetricsService } from './metrics.service.js';

@Controller('metrics')
@UseGuards(AuthGuard, RolesGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('overview')
  @Roles('ADMIN')
  getOverview(@Query() query: DateRangeDto) {
    return this.metrics.getOverview(query);
  }
}
