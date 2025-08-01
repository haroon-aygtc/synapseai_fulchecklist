import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  ForbiddenException,
  UnauthorizedException 
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

@Injectable()
export class EnhancedPermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions or roles are required, allow access
    if (!requiredPermissions && !requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Check role-based access
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(user.role);
      if (!hasRole) {
        throw new ForbiddenException(
          `Insufficient role. Required roles: ${requiredRoles.join(', ')}, Current role: ${user.role}`
        );
      }
    }

    // Check permission-based access
    if (requiredPermissions && requiredPermissions.length > 0) {
      if (!user.permissions || !Array.isArray(user.permissions)) {
        throw new ForbiddenException('User permissions not found');
      }

      const hasPermission = requiredPermissions.some(permission =>
        user.permissions.includes(permission)
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
        );
      }
    }

    return true;
  }
}