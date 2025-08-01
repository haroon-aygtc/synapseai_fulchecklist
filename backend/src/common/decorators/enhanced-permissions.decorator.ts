import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

// Permission decorator
export const Permissions = (...permissions: string[]) => SetMetadata('permissions', permissions);

// Role decorator
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// Public route decorator
export const Public = () => SetMetadata('isPublic', true);

// Organization context decorator
export const OrganizationContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return {
      organizationId: request.organizationId,
      organization: request.organization,
      userRole: request.userRole,
      userPermissions: request.userPermissions,
      membershipId: request.membershipId,
    };
  },
);

// Current user decorator
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Organization ID decorator
export const OrganizationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.organizationId;
  },
);

// User permissions decorator
export const UserPermissions = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.userPermissions || [];
  },
);