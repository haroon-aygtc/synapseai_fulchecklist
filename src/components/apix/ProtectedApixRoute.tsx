import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ApixProvider, useApixContext } from '@/lib/apix/context';
import { Permission } from '@/lib/auth/types';
import { Loader2 } from 'lucide-react';

interface ProtectedApixRouteProps {
  children: React.ReactNode;
  requiredPermissions?: Permission[];
  fallbackPath?: string;
}

/**
 * Inner component that handles the actual protection logic
 */
function ProtectedRouteInner({
  children,
  requiredPermissions = [],
  fallbackPath = '/auth/login',
}: ProtectedApixRouteProps) {
  const { isAuthenticated, isLoading, hasAnyPermission, user } = useAuth();
  const { connect, status, isConnected } = useApixContext();
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle authentication and permission checks
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push(fallbackPath);
      } else if (
        requiredPermissions.length > 0 &&
        !hasAnyPermission(requiredPermissions)
      ) {
        router.push('/unauthorized');
      }
    }
  }, [isAuthenticated, isLoading, hasAnyPermission, requiredPermissions, router, fallbackPath]);

  // Connect to APIX when authenticated
  useEffect(() => {
    const connectToApix = async () => {
      if (isAuthenticated && user && !isConnected && !isConnecting && status !== 'connecting') {
        try {
          setIsConnecting(true);
          // Get token from auth service or localStorage
          const token = localStorage.getItem('accessToken');
          if (token) {
            await connect(token, user.organizationId);
          }
        } catch (error) {
          console.error('Failed to connect to APIX:', error);
        } finally {
          setIsConnecting(false);
        }
      }
    };

    connectToApix();
  }, [isAuthenticated, user, isConnected, connect, status, isConnecting]);

  // Show loading state
  if (isLoading || (isAuthenticated && !isConnected && status !== 'error')) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium">
            {isLoading ? 'Authenticating...' : 'Connecting to real-time services...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error state if APIX connection failed
  if (isAuthenticated && status === 'error') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center space-y-4 max-w-md text-center">
          <div className="p-3 rounded-full bg-red-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-700">Connection Error</h3>
          <p className="text-gray-600">
            Failed to connect to real-time services. Please refresh the page or try again later.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Render children when authenticated, authorized and connected
  if (isAuthenticated && (requiredPermissions.length === 0 || hasAnyPermission(requiredPermissions)) && isConnected) {
    return <>{children}</>;
  }

  // This should not be reached, but just in case
  return null;
}

/**
 * Protected route component that ensures the user is authenticated,
 * has the required permissions, and is connected to APIX
 */
export default function ProtectedApixRoute({
  children,
  requiredPermissions,
  fallbackPath,
}: ProtectedApixRouteProps) {
  return (
    <ApixProvider autoConnect={false}>
      <ProtectedRouteInner
        requiredPermissions={requiredPermissions}
        fallbackPath={fallbackPath}
      >
        {children}
      </ProtectedRouteInner>
    </ApixProvider>
  );
}