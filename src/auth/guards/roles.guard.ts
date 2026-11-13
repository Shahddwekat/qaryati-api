
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma/client';
import { ROLES_KEY } from '../roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: number; role: UserRole };
    }>();

    if (!request.user) {
      throw new UnauthorizedException(
        'Authentication is required to access this resource',
      );
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException(
        'Your role does not have permission to access this resource',
      );
    }

    return true;
  }
}
