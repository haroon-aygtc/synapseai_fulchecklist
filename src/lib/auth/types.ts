export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: UserRole;
  organizationId: string;
  permissions: Permission[];
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  plan: OrganizationPlan;
  settings: OrganizationSettings;
  members: OrganizationMember[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: UserRole;
  permissions: Permission[];
  invitedBy?: string;
  joinedAt: Date;
  user: User;
}

export interface OrganizationSettings {
  allowMemberInvites: boolean;
  requireTwoFactor: boolean;
  sessionTimeout: number;
  customBranding: {
    primaryColor?: string;
    logo?: string;
    favicon?: string;
  };
  integrations: {
    sso?: {
      enabled: boolean;
      provider: string;
      config: Record<string, any>;
    };
  };
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  DEVELOPER = 'DEVELOPER',
  VIEWER = 'VIEWER'
}

export enum Permission {
  // Agent permissions
  AGENTS_CREATE = 'AGENTS_CREATE',
  AGENTS_READ = 'AGENTS_READ',
  AGENTS_UPDATE = 'AGENTS_UPDATE',
  AGENTS_DELETE = 'AGENTS_DELETE',
  AGENTS_EXECUTE = 'AGENTS_EXECUTE',
  
  // Tool permissions
  TOOLS_CREATE = 'TOOLS_CREATE',
  TOOLS_READ = 'TOOLS_READ',
  TOOLS_UPDATE = 'TOOLS_UPDATE',
  TOOLS_DELETE = 'TOOLS_DELETE',
  TOOLS_EXECUTE = 'TOOLS_EXECUTE',
  
  // Workflow permissions
  WORKFLOWS_CREATE = 'WORKFLOWS_CREATE',
  WORKFLOWS_READ = 'WORKFLOWS_READ',
  WORKFLOWS_UPDATE = 'WORKFLOWS_UPDATE',
  WORKFLOWS_DELETE = 'WORKFLOWS_DELETE',
  WORKFLOWS_EXECUTE = 'WORKFLOWS_EXECUTE',
  
  // Organization permissions
  ORG_MANAGE = 'ORG_MANAGE',
  ORG_MEMBERS_MANAGE = 'ORG_MEMBERS_MANAGE',
  ORG_SETTINGS_MANAGE = 'ORG_SETTINGS_MANAGE',
  
  // Analytics permissions
  ANALYTICS_VIEW = 'ANALYTICS_VIEW',
  ANALYTICS_EXPORT = 'ANALYTICS_EXPORT',
  
  // Provider permissions
  PROVIDERS_MANAGE = 'PROVIDERS_MANAGE',
  
  // Knowledge base permissions
  KNOWLEDGE_CREATE = 'KNOWLEDGE_CREATE',
  KNOWLEDGE_READ = 'KNOWLEDGE_READ',
  KNOWLEDGE_UPDATE = 'KNOWLEDGE_UPDATE',
  KNOWLEDGE_DELETE = 'KNOWLEDGE_DELETE'
}

export enum OrganizationPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE'
}

export interface AuthState {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: Permission[];
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName?: string;
}

export interface AuthResponse {
  user: User;
  organization: Organization;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordReset {
  token: string;
  password: string;
}

export interface TwoFactorVerification {
  code: string;
  token: string;
}

export interface SessionInfo {
  id: string;
  userId: string;
  deviceInfo: string;
  ipAddress: string;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
}