import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppModule', () => {
  it('resolves every provider, repository and guard', async () => {
    process.env.JWT_SECRET ??= 'test-secret';
    process.env.DATABASE_URL ??= 'postgresql://localhost/unused';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
