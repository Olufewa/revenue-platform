import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// The machine equivalent of @CurrentUser(). ApiKeyGuard puts the service on
// the request; this hands it to the route.
export const CurrentService = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest().service,
);
