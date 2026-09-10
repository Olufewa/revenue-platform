import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentService = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest().service,
);
