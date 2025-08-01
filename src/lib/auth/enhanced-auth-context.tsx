'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { 
  enhancedAuthService, 
  User, 
  Organization, 
  OrganizationSummary,
  LoginRequest, 
  RegisterRequest,
  InviteUserRequest,
} from './enhanced-auth-service';

interface EnhancedAuthContextType {
  // State
  user: User | null;
  organization: Organization | null;
  availableOrganizations: OrganizationSummary[];
  permissions: string[];
  role: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  inviteUser: (data: InviteUserRequest) => Promise<{ message: string }>;
  refreshProfile: () => Promise<void>;

  // Permission helpers
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  canInviteUsers: () => boolean;
  canManageOrganization: () => boolean;
}

const EnhancedAuthContext = createContext<EnhancedAuthContextType | undefined>(undefined);

interface EnhancedAuthProviderProps {
  children: ReactNode;
}

export function EnhancedAuthProvider({ children }: EnhancedAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<OrganizationSummary[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!user && enhancedAuthService.isAuthenticated();

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (enhancedAuthService.isAuthenticated()) {
          const storedUser = enhancedAuthService.getUser();
          const storedOrg = enhancedAuthService.getOrganization();
          const storedAvailableOrgs = enhancedAuthService.getAvailableOrganizations();
          const storedPermissions = enhancedAuthService.getPermissions();
          const storedRole = enhancedAuthService.getRole();

          if (storedUser && storedOrg) {
            setUser(storedUser);
            setOrganization(storedOrg);
            setAvailableOrganizations(storedAvailableOrgs);
            setPermissions(storedPermissions);
            setRole(storedRole);

            // Refresh profile to get latest data
            try {
              const profile = await enhancedAuthService.getProfile();
              setUser(profile.user);
              setOrganization(profile.organization);
              setPermissions(profile.permissions);
              setRole(profile.role);
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
      const response = await enhancedAuthService.login(data);
      setUser(response.user);
      setOrganization(response.organization);
      setAvailableOrganizations(response.availableOrganizations || []);
      
      // Get permissions from profile
      const profile = await enhancedAuthService.getProfile();
      setPermissions(profile.permissions);
      setRole(profile.role);
      
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest): Promise<{ message: string }> => {
    setIsLoading(true);
    try {
      const response = await enhancedAuthService.register(data);
      return response;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await enhancedAuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setOrganization(null);
      setAvailableOrganizations([]);
      setPermissions([]);
      setRole(null);
      setIsLoading(false);
      router.push('/auth/login');
    }
  };

  const switchOrganization = async (organizationId: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await enhancedAuthService.switchOrganization(organizationId);
      setUser(response.user);
      setOrganization(response.organization);
      setAvailableOrganizations(response.availableOrganizations || []);
      
      // Get updated permissions
      const profile = await enhancedAuthService.getProfile();
      setPermissions(profile.permissions);
      setRole(profile.role);
      
      // Refresh the current page to update organization context
      window.location.reload();
    } catch (error) {
      console.error('Switch organization error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const inviteUser = async (data: InviteUserRequest): Promise<{ message: string }> => {
    try {
      const response = await enhancedAuthService.inviteUser(data);
      return response;
    } catch (error) {
      console.error('Invite user error:', error);
      throw error;
    }
  };

  const refreshProfile = async (): Promise<void> => {
    try {
      const profile = await enhancedAuthService.getProfile();
      setUser(profile.user);
      setOrganization(profile.organization);
      setPermissions(profile.permissions);
      setRole(profile.role);
    } catch (error) {
      console.error('Refresh profile error:', error);
      throw error;
    }
  };

  // Permission helpers
  const hasPermission = (permission: string): boolean => {
    return enhancedAuthService.hasPermission(permission);
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    return enhancedAuthService.hasAnyPermission(permissions);
  };

  const hasRole = (role: string): boolean => {
    return enhancedAuthService.hasRole(role);
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return enhancedAuthService.hasAnyRole(roles);
  };

  const canInviteUsers = (): boolean => {
    return enhancedAuthService.canInviteUsers();
  };

  const canManageOrganization = (): boolean => {
    return enhancedAuthService.canManageOrganization();
  };

  const value: EnhancedAuthContextType = {
    // State
    user,
    organization,
    availableOrganizations,
    permissions,
    role,
    isLoading,
    isAuthenticated,

    // Actions
    login,
    register,
    logout,
    switchOrganization,
    inviteUser,
    refreshProfile,

    // Permission helpers
    hasPermission,
    hasAnyPermission,
    hasRole,
    hasAnyRole,
    canInviteUsers,
    canManageOrganization,
  };

  return (
    <EnhancedAuthContext.Provider value={value}>
      {children}
    </EnhancedAuthContext.Provider>
  );
}

export function useEnhancedAuth(): EnhancedAuthContextType {
  const context = useContext(EnhancedAuthContext);
  if (context === undefined) {
    throw new Error('useEnhancedAuth must be used within an EnhancedAuthProvider');
  }
  return context;
}

export default useEnhancedAuth;