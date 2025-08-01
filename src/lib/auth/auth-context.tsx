'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from './auth-service';
import { 
  AuthState, 
  User, 
  Organization, 
  Permission, 
  LoginCredentials, 
  RegisterData,
  PasswordResetRequest,
  PasswordReset,
  TwoFactorVerification
} from './types';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  requestPasswordReset: (data: PasswordResetRequest) => Promise<void>;
  resetPassword: (data: PasswordReset) => Promise<void>;
  verifyTwoFactor: (data: TwoFactorVerification) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  switchOrganization: (organizationId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    organization: null,
    isAuthenticated: false,
    isLoading: true,
    permissions: [],
  });

  const router = useRouter();

  const updateAuthState = useCallback((
    user: User | null, 
    organization: Organization | null
  ) => {
    const permissions = user?.permissions || [];
    setState({
      user,
      organization,
      isAuthenticated: !!user,
      isLoading: false,
      permissions,
    });
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      if (!authService.isAuthenticated()) {
        updateAuthState(null, null);
        return;
      }

      const { user, organization } = await authService.getCurrentUser();
      updateAuthState(user, organization);
    } catch (error) {
      console.error('Failed to refresh auth:', error);
      updateAuthState(null, null);
    }
  }, [updateAuthState]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const response = await authService.login(credentials);
      updateAuthState(response.user, response.organization);
      router.push('/');
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [updateAuthState, router]);

  const register = useCallback(async (data: RegisterData) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const response = await authService.register(data);
      updateAuthState(response.user, response.organization);
      router.push('/');
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [updateAuthState, router]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
      updateAuthState(null, null);
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
      updateAuthState(null, null);
      router.push('/auth/login');
    }
  }, [updateAuthState, router]);

  const requestPasswordReset = useCallback(async (data: PasswordResetRequest) => {
    await authService.requestPasswordReset(data);
  }, []);

  const resetPassword = useCallback(async (data: PasswordReset) => {
    await authService.resetPassword(data);
    router.push('/auth/login');
  }, [router]);

  const verifyTwoFactor = useCallback(async (data: TwoFactorVerification) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const response = await authService.verifyTwoFactor(data);
      updateAuthState(response.user, response.organization);
      router.push('/');
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [updateAuthState, router]);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    const updatedUser = await authService.updateProfile(data);
    setState(prev => ({
      ...prev,
      user: updatedUser,
    }));
  }, []);

  const hasPermission = useCallback((permission: Permission): boolean => {
    return state.permissions.includes(permission);
  }, [state.permissions]);

  const hasAnyPermission = useCallback((permissions: Permission[]): boolean => {
    return permissions.some(permission => state.permissions.includes(permission));
  }, [state.permissions]);

  const switchOrganization = useCallback(async (organizationId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      // This would be implemented when multi-org switching is needed
      await refreshAuth();
    } catch (error) {
      console.error('Failed to switch organization:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, [refreshAuth]);

  // Initialize auth state on mount
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Set up token refresh interval
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const interval = setInterval(async () => {
      try {
        await authService.refreshToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
        logout();
      }
    }, 15 * 60 * 1000); // Refresh every 15 minutes

    return () => clearInterval(interval);
  }, [state.isAuthenticated, logout]);

  const contextValue: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshAuth,
    requestPasswordReset,
    resetPassword,
    verifyTwoFactor,
    updateProfile,
    hasPermission,
    hasAnyPermission,
    switchOrganization,
  };

  return (
    <AuthContext.Provider value={contextValue}>
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