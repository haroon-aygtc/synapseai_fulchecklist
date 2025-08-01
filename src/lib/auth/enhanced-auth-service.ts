import axios, { AxiosInstance, AxiosResponse } from 'axios';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'DEVELOPER' | 'VIEWER';
  permissions: string[];
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  organization: Organization;
  availableOrganizations?: OrganizationSummary[];
}

export interface LoginRequest {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
  password: string;
}

export interface SwitchOrganizationRequest {
  organizationId: string;
}

export interface InviteUserRequest {
  email: string;
  role: 'ORG_ADMIN' | 'DEVELOPER' | 'VIEWER';
  permissions?: string[];
}

export interface ProfileResponse {
  user: User;
  organization: Organization;
  permissions: string[];
  role: string;
  membershipId: string;
  context: {
    organizationId: string;
    organization: Organization;
    userRole: string;
    userPermissions: string[];
    membershipId: string;
  };
}

class EnhancedAuthService {
  private api: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: User | null = null;
  private organization: Organization | null = null;
  private availableOrganizations: OrganizationSummary[] = [];
  private permissions: string[] = [];
  private role: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load data from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
    }

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for automatic token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config;

        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;

          try {
            if (this.refreshToken) {
              const response = await this.refreshAccessToken();
              this.setTokens(response.accessToken, this.refreshToken);
              original.headers.Authorization = `Bearer ${response.accessToken}`;
              return this.api(original);
            }
          } catch (refreshError) {
            this.clearAuth();
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login';
            }
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async register(data: RegisterRequest): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> = await this.api.post('/auth/register', data);
    return response.data;
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/login', data);
    const authData = response.data;

    this.setAuthData(authData);
    return authData;
  }

  async switchOrganization(organizationId: string): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/switch-organization', {
      organizationId,
    });
    const authData = response.data;

    this.setAuthData(authData);
    return authData;
  }

  async inviteUser(data: InviteUserRequest): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> = await this.api.post('/auth/invite-user', data);
    return response.data;
  }

  async getProfile(): Promise<ProfileResponse> {
    const response: AxiosResponse<ProfileResponse> = await this.api.get('/auth/me');
    const profile = response.data;

    // Update local state with fresh profile data
    this.user = profile.user;
    this.organization = profile.organization;
    this.permissions = profile.permissions;
    this.role = profile.role;

    this.saveToStorage();
    return profile;
  }

  async getUserOrganizations(): Promise<{ organizations: OrganizationSummary[]; current: Organization }> {
    const response = await this.api.get('/auth/organizations');
    return response.data;
  }

  async getUserPermissions(): Promise<{ permissions: string[]; role: string; organizationId: string }> {
    const response = await this.api.get('/auth/permissions');
    return response.data;
  }

  async refreshAccessToken(): Promise<{ accessToken: string }> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response: AxiosResponse<{ accessToken: string }> = await this.api.post('/auth/refresh', {
      refreshToken: this.refreshToken,
    });

    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout', {
        refreshToken: this.refreshToken,
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.user;
  }

  getUser(): User | null {
    return this.user;
  }

  getOrganization(): Organization | null {
    return this.organization;
  }

  getAvailableOrganizations(): OrganizationSummary[] {
    return this.availableOrganizations;
  }

  getPermissions(): string[] {
    return this.permissions;
  }

  getRole(): string | null {
    return this.role;
  }

  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.permissions.includes(permission));
  }

  hasRole(role: string): boolean {
    return this.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    return roles.includes(this.role || '');
  }

  canInviteUsers(): boolean {
    return this.hasPermission('user:invite') && this.hasAnyRole(['ORG_ADMIN', 'SUPER_ADMIN']);
  }

  canManageOrganization(): boolean {
    return this.hasPermission('organization:write') && this.hasAnyRole(['ORG_ADMIN', 'SUPER_ADMIN']);
  }

  // Private methods
  private setAuthData(authData: AuthResponse): void {
    this.user = authData.user;
    this.organization = authData.organization;
    this.availableOrganizations = authData.availableOrganizations || [];
    this.setTokens(authData.accessToken, authData.refreshToken);
    this.saveToStorage();
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  private clearAuth(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    this.organization = null;
    this.availableOrganizations = [];
    this.permissions = [];
    this.role = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('organization');
      localStorage.removeItem('availableOrganizations');
      localStorage.removeItem('permissions');
      localStorage.removeItem('role');
    }
  }

  private saveToStorage(): void {
    if (typeof window !== 'undefined') {
      if (this.user) localStorage.setItem('user', JSON.stringify(this.user));
      if (this.organization) localStorage.setItem('organization', JSON.stringify(this.organization));
      if (this.availableOrganizations.length > 0) {
        localStorage.setItem('availableOrganizations', JSON.stringify(this.availableOrganizations));
      }
      if (this.permissions.length > 0) {
        localStorage.setItem('permissions', JSON.stringify(this.permissions));
      }
      if (this.role) localStorage.setItem('role', this.role);
    }
  }

  private loadFromStorage(): void {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');

      const userStr = localStorage.getItem('user');
      if (userStr) this.user = JSON.parse(userStr);

      const orgStr = localStorage.getItem('organization');
      if (orgStr) this.organization = JSON.parse(orgStr);

      const availableOrgsStr = localStorage.getItem('availableOrganizations');
      if (availableOrgsStr) this.availableOrganizations = JSON.parse(availableOrgsStr);

      const permissionsStr = localStorage.getItem('permissions');
      if (permissionsStr) this.permissions = JSON.parse(permissionsStr);

      this.role = localStorage.getItem('role');
    }
  }
}

export const enhancedAuthService = new EnhancedAuthService();
export default enhancedAuthService;