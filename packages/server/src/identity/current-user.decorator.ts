import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Convenience only: lets a route say @CurrentUser() user instead of digging
// into the request object every time.
// 'sub' is the standard JWT field for "who this token is about".
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request.user as { sub: string; email: string };
  },
);
