import { 
  AuthResponse, 
  LoginCredentials, 
  RegisterData, 
  PasswordResetRequest, 
  PasswordReset,
  TwoFactorVerification,
  User,
  Organization,
  SessionInfo
} from './types';

class AuthService {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  private tokenKey = 'synapseai_token';
  private refreshTokenKey = 'synapseai_refresh_token';

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry with new token
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${this.getToken()}`,
          };
          const retryResponse = await fetch(url, config);
          if (!retryResponse.ok) {
            throw new Error(`HTTP error! status: ${retryResponse.status}`);
          }
          return retryResponse.json();
        } else {
          this.logout();
          throw new Error('Authentication failed');
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      this.clearTokens();
      window.location.href = '/auth/login';
    }
  }

  async getCurrentUser(): Promise<{ user: User; organization: Organization }> {
    return this.request('/auth/me');
  }

  async refreshToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await this.request<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });

      this.setTokens(response.accessToken, response.refreshToken);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      return false;
    }
  }

  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    await this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resetPassword(data: PasswordReset): Promise<void> {
    await this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyTwoFactor(data: TwoFactorVerification): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async enableTwoFactor(): Promise<{ qrCode: string; secret: string }> {
    return this.request('/auth/enable-2fa', { method: 'POST' });
  }

  async disableTwoFactor(code: string): Promise<void> {
    await this.request('/auth/disable-2fa', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async getSessions(): Promise<SessionInfo[]> {
    return this.request('/auth/sessions');
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.request(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return this.request('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async verifyEmail(token: string): Promise<void> {
    await this.request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async resendVerificationEmail(): Promise<void> {
    await this.request('/auth/resend-verification', { method: 'POST' });
  }

  // Token management
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.tokenKey);
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.refreshTokenKey);
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.tokenKey, accessToken);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  private clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const authService = new AuthService();