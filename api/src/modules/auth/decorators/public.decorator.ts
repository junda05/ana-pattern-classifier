/**
 * Decorator that marks a route as public (no authentication required)
 *
 * Usage:
 * @Public()
 * @Get('public-endpoint')
 * async publicMethod() { ... }
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
