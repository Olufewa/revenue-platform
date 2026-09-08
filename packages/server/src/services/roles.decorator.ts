import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Marks a route as needing one of these roles. RolesGuard reads it back.
//   @Roles('ADMIN')
export const Roles = (...roles: Array<'ADMIN' | 'MEMBER'>) =>
  SetMetadata(ROLES_KEY, roles);
