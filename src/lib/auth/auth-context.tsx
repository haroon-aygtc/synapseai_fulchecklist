'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { 
  authService, 
  User, 
  Organization, 
  LoginRequest, 
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  Enable2FARequest,
  Verify2FARequest,
} from './auth-service';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  forgotPassword: (data: ForgotPasswordRequest) => Promise<{ message: string }>;
  resetPassword: (data: ResetPasswordRequest) => Promise<{ message: string }>;
  verifyEmail: (data: VerifyEmailRequest) => Promise<{ message: string }>;
  enable2FA: (data: Enable2FARequest) => Promise<{ qrCode: string; backupCodes: string[] }>;
  verify2FA: (data: Verify2FARequest) => Promise<{ message: string }>;
  disable2FA: (password: string) => Promise<{ message: string }>;
  refreshProfile: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!user && authService.isAuthenticated();

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const storedUser = authService.getUser();
          const storedOrg = authService.getOrganization();

          if (storedUser && storedOrg) {
            setUser(storedUser);
            setOrganization(storedOrg);

            // Refresh profile to get latest data and permissions
            try {
              const profile = await authService.getProfile();
              setUser(profile.user);
              setPermissions(profile.permissions);
              
              // Update localStorage with fresh data
              localStorage.setItem('user', JSON.stringify(profile.user));
            } catch (error) {
              console.error('Failed to refresh profile:', error);
              // If profile refresh fails, user might need to re-login
              await logout();
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        await logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (data: LoginRequest): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authService.login(data);
      setUser(response.user);
      setOrganization(response.organization);
      
      // Get permissions
      const profile = await authService.getProfile();
      setPermissions(profile.permissions);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest): Promise<{ message: string }> => {
    return authService.register(data);
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.logout(authService.getAccessToken() || undefined);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setOrganization(null);
      setPermissions([]);
      setIsLoading(false);
      router.push('/auth/login');
    }
  };

  const forgotPassword = async (data: ForgotPasswordRequest): Promise<{ message: string }> => {
    return authService.forgotPassword(data);
  };

  const resetPassword = async (data: ResetPasswordRequest): Promise<{ message: string }> => {
    return authService.resetPassword(data);
  };

  const verifyEmail = async (data: VerifyEmailRequest): Promise<{ message: string }> => {
    return authService.verifyEmail(data);
  };

  const enable2FA = async (data: Enable2FARequest): Promise<{ qrCode: string; backupCodes: string[] }> => {
    return authService.enable2FA(data);
  };

  const verify2FA = async (data: Verify2FARequest): Promise<{ message: string }> => {
    const result = await authService.verify2FA(data);
    
    // Refresh user data to reflect 2FA enabled status
    await refreshProfile();
    
    return result;
  };

  const disable2FA = async (password: string): Promise<{ message: string }> => {
    const result = await authService.disable2FA(password);
    
    // Refresh user data to reflect 2FA disabled status
    await refreshProfile();
    
    return result;
  };

  const refreshProfile = async (): Promise<void> => {
    try {
      const profile = await authService.getProfile();
      setUser(profile.user);
      setPermissions(profile.permissions);
      
      // Update localStorage
      localStorage.setItem('user', JSON.stringify(profile.user));
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      throw error;
    }
  };

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.some(permission => permissions.includes(permission));
  };

  const hasRole = (role: string): boolean => {
    return user?.role === role;
  };

  const value: AuthContextType = {
    user,
    organization,
    permissions,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    verifyEmail,
    enable2FA,
    verify2FA,
    disable2FA,
    refreshProfile,
    hasPermission,
    hasAnyPermission,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermissions?: string[]
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, hasAnyPermission } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading) {
        if (!isAuthenticated) {
          router.push('/auth/login');
          return;
        }

        if (requiredPermissions && !hasAnyPermission(requiredPermissions)) {
          router.push('/unauthorized');
          return;
        }
      }
    }, [isAuthenticated, isLoading, hasAnyPermission, router]);

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    if (requiredPermissions && !hasAnyPermission(requiredPermissions)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}