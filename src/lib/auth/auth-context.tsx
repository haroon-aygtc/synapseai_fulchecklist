'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Organization, Permission, AuthContext, UserRole } from './types';
import { authService } from './auth-service';
import { sessionManager } from './session-manager';

const AuthContextProvider = createContext<AuthContext | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const updateAuthState = useCallback((userData: User | null, orgData: Organization | null) => {
    setUser(userData);
    setOrganization(orgData);
    
    if (userData) {
      const userPermissions = authService.getUserPermissions(userData.role, userData.permissions);
      setPermissions(userPermissions);
      setIsAuthenticated(true);
    } else {
      setPermissions([]);
      setIsAuthenticated(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string, twoFactorCode?: string) => {
    try {
      setIsLoading(true);
      
      // Get client IP and user agent
      const ipAddress = await fetch('/api/auth/client-info')
        .then(res => res.json())
        .then(data => data.ip)
        .catch(() => '127.0.0.1');
      
      const userAgent = navigator.userAgent;

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          twoFactorCode,
          ipAddress,
          userAgent
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const { user: userData, organization: orgData, accessToken, refreshToken } = await response.json();

      // Store tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      updateAuthState(userData, orgData);

      // Log successful login
      await authService.logSecurityEvent({
        userId: userData.id,
        organizationId: userData.organizationId,
        action: 'LOGIN',
        resource: 'USER',
        details: { email, twoFactorUsed: !!twoFactorCode },
        ipAddress,
        userAgent,
        success: true
      });

    } catch (error) {
      console.error('Login error:', error);
      
      // Log failed login attempt
      await authService.logSecurityEvent({
        action: 'LOGIN_FAILED',
        resource: 'USER',
        details: { email, error: (error as Error).message },
        ipAddress: await fetch('/api/auth/client-info').then(res => res.json()).then(data => data.ip).catch(() => '127.0.0.1'),
        userAgent: navigator.userAgent,
        success: false
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [updateAuthState]);

  const logout = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      
      if (accessToken) {
        const payload = await authService.verifyJWT(accessToken);
        if (payload) {
          await authService.invalidateSession(payload.sessionId);
          
          // Log logout
          await authService.logSecurityEvent({
            userId: payload.sub,
            organizationId: payload.organizationId,
            action: 'LOGOUT',
            resource: 'USER',
            details: {},
            ipAddress: await fetch('/api/auth/client-info').then(res => res.json()).then(data => data.ip).catch(() => '127.0.0.1'),
            userAgent: navigator.userAgent,
            success: true
          });
        }
      }

      // Clear tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');

      updateAuthState(null, null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [updateAuthState]);

  const refreshToken = useCallback(async () => {
    try {
      const refreshTokenValue = localStorage.getItem('refreshToken');
      
      if (!refreshTokenValue) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: refreshTokenValue }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await response.json();

      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      // Verify the new token and update state
      const payload = await authService.verifyJWT(newAccessToken);
      if (payload) {
        // Fetch updated user and organization data
        const userResponse = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${newAccessToken}`,
          },
        });

        if (userResponse.ok) {
          const { user: userData, organization: orgData } = await userResponse.json();
          updateAuthState(userData, orgData);
        }
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      await logout();
    }
  }, [updateAuthState, logout]);

  const hasPermission = useCallback((permission: Permission): boolean => {
    return authService.hasPermission(permissions, permission);
  }, [permissions]);

  const hasAnyPermission = useCallback((requiredPermissions: Permission[]): boolean => {
    return authService.hasAnyPermission(permissions, requiredPermissions);
  }, [permissions]);

  const switchOrganization = useCallback(async (organizationId: string) => {
    try {
      setIsLoading(true);
      
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('No access token available');
      }

      const response = await fetch('/api/auth/switch-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Organization switch failed');
      }

      const { user: userData, organization: orgData, accessToken: newAccessToken } = await response.json();

      localStorage.setItem('accessToken', newAccessToken);
      updateAuthState(userData, orgData);

    } catch (error) {
      console.error('Organization switch error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [updateAuthState]);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        
        if (!accessToken) {
          setIsLoading(false);
          return;
        }

        const validation = await authService.validateSession(accessToken);
        
        if (!validation.isValid) {
          // Try to refresh the token
          await refreshToken();
          return;
        }

        // Fetch current user and organization data
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const { user: userData, organization: orgData } = await response.json();
          updateAuthState(userData, orgData);
        } else {
          await logout();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        await logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [refreshToken, logout, updateAuthState]);

  // Set up token refresh interval
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(async () => {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        const payload = await authService.verifyJWT(accessToken);
        if (payload) {
          const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
          // Refresh token if it expires in less than 5 minutes
          if (expiresIn < 300) {
            await refreshToken();
          }
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isAuthenticated, refreshToken]);

  const contextValue: AuthContext = {
    user,
    organization,
    permissions,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshToken,
    hasPermission,
    hasAnyPermission,
    switchOrganization,
  };

  return (
    <AuthContextProvider.Provider value={contextValue}>
      {children}
    </AuthContextProvider.Provider>
  );
}

export function useAuth(): AuthContext {
  const context = useContext(AuthContextProvider);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions?: Permission[]
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, hasAnyPermission } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return null;
    }

    if (requiredPermissions && !hasAnyPermission(requiredPermissions)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
            <p className="text-muted-foreground">You don't have permission to access this resource.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

// Hook for permission-based rendering
export function usePermissions() {
  const { permissions, hasPermission, hasAnyPermission } = useAuth();
  
  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    can: hasPermission,
    canAny: hasAnyPermission,
  };
}