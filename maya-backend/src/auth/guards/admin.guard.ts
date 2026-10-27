import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const adminHeader = request.headers['x-admin-token'] as string | undefined;
    const authHeader = request.headers['authorization'] as string | undefined;

    const rawToken =
      adminHeader ||
      (authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '');

    if (!rawToken) {
      throw new UnauthorizedException('Admin authentication required');
    }

    const isValid = this.authService.validateAdminToken(rawToken);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired admin credentials');
    }

    return true;
  }
}
