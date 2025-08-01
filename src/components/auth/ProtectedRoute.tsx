'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Permission } from '@/lib/auth/types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: Permission[];
  requireAuth?: boolean;
  fallbackPath?: string;
}

export default function ProtectedRoute({
  children,
  requiredPermissions = [],
  requireAuth = true,
  fallbackPath = '/auth/login'
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasAnyPermission, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Check authentication requirement
    if (requireAuth && !isAuthenticated) {
      router.push(fallbackPath);
      return;
    }

    // Check permission requirements
    if (requiredPermissions.length > 0 && !hasAnyPermission(requiredPermissions)) {
      router.push('/unauthorized');
      return;
    }

    // Check email verification if required
    if (isAuthenticated && user && !user.isEmailVerified) {
      router.push('/auth/verify-email');
      return;
    }
  }, [
    isAuthenticated, 
    isLoading, 
    hasAnyPermission, 
    requiredPermissions, 
    requireAuth, 
    fallbackPath, 
    router,
    user
  ]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Check authentication
  if (requireAuth && !isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  // Check permissions
  if (requiredPermissions.length > 0 && !hasAnyPermission(requiredPermissions)) {
    return null; // Will redirect in useEffect
  }

  // Check email verification
  if (isAuthenticated && user && !user.isEmailVerified) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}