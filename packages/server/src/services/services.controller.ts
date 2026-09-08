import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../identity/auth.guard.js';
import { CurrentUser } from '../identity/current-user.decorator.js';
import { ServicesService } from './services.service.js';
import { ApiKeysService } from './api-keys.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { CurrentService } from './current-service.decorator.js';
import { RolesGuard } from './roles.guard.js';
import { Roles } from './roles.decorator.js';

@Controller('services')
export class ServicesController {
  constructor(
    private readonly services: ServicesService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  // The machine route. It is declared before ':id' on purpose: Nest matches
  // routes in the order they are written, so with ':id' first a GET to
  // /services/whoami would be read as "the service with id 'whoami'".
  @Get('whoami')
  @UseGuards(ApiKeyGuard)
  whoami(@CurrentService() service: { id: string; slug: string; name: string }) {
    return { id: service.id, slug: service.slug, name: service.name };
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: { sub: string }) {
    return this.services.create(dto, user.sub);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll(@CurrentUser() user: { sub: string }) {
    return this.services.findAllFor(user.sub);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.services.findOneFor(id, user.sub);
  }

  // Deleting takes a service and every key on it out of the system, so it is
  // the one route that is not merely owner-gated. Both guards run, in order:
  // AuthGuard establishes who you are, RolesGuard checks what you may do.
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async remove(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    await this.services.remove(id, user.sub);
  }

  @Post(':id/keys')
  @UseGuards(AuthGuard)
  createKey(
    @Param('id') id: string,
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.apiKeys.create(id, user.sub, dto);
  }

  @Get(':id/keys')
  @UseGuards(AuthGuard)
  listKeys(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.apiKeys.findAll(id, user.sub);
  }

  // DELETE, but the row survives with revokedAt set. See ApiKeysService.
  @Delete(':id/keys/:keyId')
  @UseGuards(AuthGuard)
  revokeKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.apiKeys.revoke(id, keyId, user.sub);
  }
}
