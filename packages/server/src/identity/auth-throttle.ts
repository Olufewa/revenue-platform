import type { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Register and login allow five attempts per client IP per minute, which
 * stops password guessing without getting in a real user's way.
 *
 * Behind a proxy or load balancer, enable Express's `trust proxy` so the
 * client IP is used; otherwise every caller shares the proxy's address.
 */
export const AUTH_THROTTLE: ThrottlerModuleOptions = [{ ttl: 60_000, limit: 5 }];
