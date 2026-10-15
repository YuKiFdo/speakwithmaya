import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { UserProfileData } from '../auth.service.js';

/**
 * Custom parameter decorator to retrieve the authenticated user profile
 * (fetched from Supabase database by AuthGuard).
 *
 * Usage:
 * @Get('profile')
 * @UseGuards(AuthGuard)
 * getProfile(@GetUser() user: UserProfileData) { ... }
 *
 * Or pick a specific field:
 * @Get('my-id')
 * @UseGuards(AuthGuard)
 * getMyId(@GetUser('id') userId: string) { ... }
 */
export const GetUser = createParamDecorator(
  (data: keyof UserProfileData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: UserProfileData | undefined = request.user;

    if (!user) {
      throw new UnauthorizedException(
        'User profile is not attached to request. Ensure AuthGuard is applied to this endpoint.',
      );
    }

    return data ? user[data] : user;
  },
);

export const CurrentUser = GetUser;
