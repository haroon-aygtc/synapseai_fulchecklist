'use client';

import React, { ReactNode } from 'react';
import { useEnhancedAuth } from '@/lib/auth/enhanced-auth-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

interface PermissionGuardProps {
  children: ReactNode;
  permissions?: string[];
  roles?: string[];
  requireAll?: boolean;
  fallback?: ReactNode;
  showFallback?: boolean;
}

export function PermissionGuard({
  children,
  permissions = [],
  roles = [],
  requireAll = false,
  fallback = null,
  showFallback = true,
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasRole, hasAnyRole, isAuthenticated } = useEnhancedAuth();

  // If user is not authenticated, don't show anything
  if (!isAuthenticated) {
    return null;
  }

  let hasAccess = true;

  // Check permissions
  if (permissions.length > 0) {
    if (requireAll) {
      hasAccess = permissions.every(permission => hasPermission(permission));
    } else {
      hasAccess = hasAnyPermission(permissions);
    }
  }

  // Check roles (if permissions check passed)
  if (hasAccess && roles.length > 0) {
    if (requireAll) {
      hasAccess = roles.every(role => hasRole(role));
    } else {
      hasAccess = hasAnyRole(roles);
    }
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  // Show fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show default access denied message if showFallback is true
  if (showFallback) {
    return (
      <Alert className="border-destructive/50 text-destructive dark:border-destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to access this content.
          {permissions.length > 0 && (
            <div className="mt-1 text-sm">
              Required permissions: {permissions.join(', ')}
            </div>
          )}
          {roles.length > 0 && (
            <div className="mt-1 text-sm">
              Required roles: {roles.join(', ')}
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

// Convenience components for common permission checks
export function AdminOnly({ children, fallback, showFallback = true }: Omit<PermissionGuardProps, 'roles'>) {
  return (
    <PermissionGuard 
      roles={['ORG_ADMIN', 'SUPER_ADMIN']} 
      fallback={fallback}
      showFallback={showFallback}
    >
      {children}
    </PermissionGuard>
  );
}

export function SuperAdminOnly({ children, fallback, showFallback = true }: Omit<PermissionGuardProps, 'roles'>) {
  return (
    <PermissionGuard 
      roles={['SUPER_ADMIN']} 
      fallback={fallback}
      showFallback={showFallback}
    >
      {children}
    </PermissionGuard>
  );
}

export function DeveloperOrAbove({ children, fallback, showFallback = true }: Omit<PermissionGuardProps, 'roles'>) {
  return (
    <PermissionGuard 
      roles={['DEVELOPER', 'ORG_ADMIN', 'SUPER_ADMIN']} 
      fallback={fallback}
      showFallback={showFallback}
    >
      {children}
    </PermissionGuard>
  );
}

export default PermissionGuard;