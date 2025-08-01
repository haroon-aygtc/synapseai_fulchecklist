import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Extend the Request interface to include our custom properties
declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
      organization?: any;
      userPermissions?: string[];
      userRole?: string;
      membershipId?: string;
      userId?: string;
    }
  }
}

@Injectable()
export class MultiTenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const user = req.user as any;

    if (user) {
      // Add organization context to request
      req.organizationId = user.organizationId;
      req.organization = user.organization;
      req.userPermissions = user.permissions;
      req.userRole = user.role;
      req.membershipId = user.membershipId;
      req.userId = user.sub;

      // Add helpful headers for debugging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        res.setHeader('X-Organization-Id', user.organizationId);
        res.setHeader('X-User-Role', user.role);
        res.setHeader('X-User-Permissions', user.permissions.join(','));
      }
    }

    next();
  }
}