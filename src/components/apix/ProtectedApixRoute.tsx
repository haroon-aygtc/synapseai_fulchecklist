'use client';

import { ReactNode } from 'react';
import { ApixProvider } from '@/lib/apix/context';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Permission } from '@/lib/auth/types';

interface ProtectedApixRouteProps {
  children: ReactNode;
  requiredPermissions?: Permission[];
  requireAuth?: boolean;
  fallbackPath?: string;
  autoConnect?: boolean;
  token?: string;
  organizationId?: string;
}

/**
 * ProtectedApixRoute Component
 * 
 * Combines ProtectedRoute with ApixProvider to create authenticated APIX-enabled routes.
 * This component ensures that:
 * 1. The user is authenticated and has required permissions
 * 2. The APIX context is available to all child components
 */
export default function ProtectedApixRoute({
  children,
  requiredPermissions = [],
  requireAuth = true,
  fallbackPath = '/auth/login',
  autoConnect = true,
  token,
  organizationId
}: ProtectedApixRouteProps) {
  return (
    <ProtectedRoute
      requiredPermissions={requiredPermissions}
      requireAuth={requireAuth}
      fallbackPath={fallbackPath}
    >
      <ApixProvider
        autoConnect={autoConnect}
        token={token}
        organizationId={organizationId}
      >
        {children}
      </ApixProvider>
    </ProtectedRoute>
  );
}