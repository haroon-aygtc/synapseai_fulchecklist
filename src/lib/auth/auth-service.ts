import axios, { AxiosInstance, AxiosResponse } from 'axios';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'DEVELOPER' | 'VIEWER';
  organizationId: string;
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

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  organization: Organization;
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

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface Enable2FARequest {
  password: string;
}

export interface Verify2FARequest {
  token: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

class AuthService {
  private api: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load tokens from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
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

    // Response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            if (this.refreshToken) {
              const response = await this.refreshAccessToken();
              this.setTokens(response.accessToken, this.refreshToken);
              originalRequest.headers.Authorization = `Bearer ${response.accessToken}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            this.clearTokens();
            window.location.href = '/auth/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('organization');
    }
  }

  async register(data: RegisterRequest): Promise<{ message: string }> {
    try {
      const response: AxiosResponse<{ message: string }> = await this.api.post('/auth/register', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/login', data);
      const { user, accessToken, refreshToken, organization } = response.data;

      this.setTokens(accessToken, refreshToken);

      // Store user and organization data
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('organization', JSON.stringify(organization));
      }

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }

  async logout(refreshToken?: string): Promise<void> {
    try {
      await this.api.post('/auth/logout', { refreshToken });
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API call failed:', error);
    } finally {
      this.clearTokens();
    }
  }

  async refreshAccessToken(): Promise<{ accessToken: string }> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response: AxiosResponse<{ accessToken: string }> = await this.api.post('/auth/refresh', {
        refreshToken: this.refreshToken,
      });

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Token refresh failed');
    }
  }

  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string }> {
    try {
      const response: AxiosResponse<{ message: string }> = await this.api.post('/auth/forgot-password', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Password reset request failed');
    }
  }

  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    try {
      const response: AxiosResponse<{ message: string }> = await this.api.post('/auth/reset-password', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Password reset failed');
    }
  }

  async verifyEmail(data: VerifyEmailRequest): Promise<{ message: string }> {
    try {
      const response: AxiosResponse<{ message: string }> = await this.api.post('/auth/verify-email', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Email verification failed');
    }
  }

  async enable2FA(data: Enable2FARequest): Promise<{ qrCode: string; backupCodes: string[] }> {
    try {
      const response: AxiosResponse<{ qrCode: string; backupCodes: string[] }> = await this.api.post('/auth/2fa/enable', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || '2FA setup failed');
    }
  }

  async verify2FA(data: Verify2FARequest): Promise<{ message: string }> {
    try {
      const response: AxiosResponse<{ message: string }> = await this.api.post('/auth/2fa/verify', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || '2FA verification failed');
    }
  }

  async disable2FA(password: string): Promise<{ message: string }> {
    try {
      const response: AxiosResponse<{ message: string }> = await this.api.post('/auth/2fa/disable', { password });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || '2FA disable failed');
    }
  }

  async getProfile(): Promise<{ user: User; permissions: string[] }> {
    try {
      const response: AxiosResponse<{ user: User; permissions: string[] }> = await this.api.get('/auth/me');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get profile');
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getUser(): User | null {
    if (typeof window === 'undefined') return null;
    
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  getOrganization(): Organization | null {
    if (typeof window === 'undefined') return null;
    
    const orgStr = localStorage.getItem('organization');
    return orgStr ? JSON.parse(orgStr) : null;
  }
}

export const authService = new AuthService();