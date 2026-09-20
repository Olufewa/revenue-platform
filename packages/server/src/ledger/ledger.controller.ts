import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { CreatePostingRuleDto } from './dto/create-posting-rule.dto.js';
import { ListEntriesDto } from './dto/list-entries.dto.js';
import { LedgerService } from './ledger.service.js';

@Controller('services/:serviceId')
@UseGuards(AuthGuard)
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Post('posting-rules')
  createRule(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreatePostingRuleDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.ledger.createPostingRule(serviceId, user.sub, dto);
  }

  @Get('posting-rules')
  listRules(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.ledger.listPostingRules(serviceId, user.sub);
  }

  @Post('events/post')
  postEvents(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.ledger.postEvents(serviceId, user.sub);
  }

  @Get('entries')
  listEntries(
    @Param('serviceId') serviceId: string,
    @Query() query: ListEntriesDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.ledger.listEntries(serviceId, user.sub, query);
  }

  @Get('balances')
  getBalances(
    @Param('serviceId') serviceId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.ledger.getBalances(serviceId, user.sub);
  }
}
