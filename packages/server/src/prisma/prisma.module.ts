import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// @Global() means this is registered ONCE and every module can inject it.
// Registering it a second time elsewhere opens a second connection pool.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
