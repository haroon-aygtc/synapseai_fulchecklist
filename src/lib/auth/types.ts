export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  DEVELOPER = 'DEVELOPER',
  VIEWER = 'VIEWER'
}

export enum Permission {
  // Agent permissions
  AGENT_CREATE = 'AGENT_CREATE',
  AGENT_READ = 'AGENT_READ',
  AGENT_UPDATE = 'AGENT_UPDATE',
  AGENT_DELETE = 'AGENT_DELETE',
  AGENT_EXECUTE = 'AGENT_EXECUTE',
  
  // Tool permissions
  TOOL_CREATE = 'TOOL_CREATE',
  TOOL_READ = 'TOOL_READ',
  TOOL_UPDATE = 'TOOL_UPDATE',
  TOOL_DELETE = 'TOOL_DELETE',
  TOOL_EXECUTE = 'TOOL_EXECUTE',
  
  // Workflow permissions
  WORKFLOW_CREATE = 'WORKFLOW_CREATE',
  WORKFLOW_READ = 'WORKFLOW_READ',
  WORKFLOW_UPDATE = 'WORKFLOW_UPDATE',
  WORKFLOW_DELETE = 'WORKFLOW_DELETE',
  WORKFLOW_EXECUTE = 'WORKFLOW_EXECUTE',
  
  // Organization permissions
  ORG_MANAGE = 'ORG_MANAGE',
  ORG_SETTINGS = 'ORG_SETTINGS',
  ORG_BILLING = 'ORG_BILLING',
  ORG_ANALYTICS = 'ORG_ANALYTICS',
  
  // User permissions
  USER_MANAGE = 'USER_MANAGE',
  USER_INVITE = 'USER_INVITE',
  USER_REMOVE = 'USER_REMOVE',
  
  // System permissions
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  AUDIT_READ = 'AUDIT_READ'
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: UserRole;
  organizationId: string;
  permissions: Permission[];
  isActive: boolean;
  lastLoginAt?: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  apiKeys: ApiKey[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customBranding: OrganizationBranding;
  settings: OrganizationSettings;
  subscription: Subscription;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationBranding {
  logo?: string;
  favicon?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  customCSS?: string;
  loginPageCustomization?: {
    backgroundImage?: string;
    welcomeMessage?: string;
    footerText?: string;
  };
}

export interface OrganizationSettings {
  allowedDomains: string[];
  ssoEnabled: boolean;
  ssoProvider?: 'saml' | 'oauth' | 'ad';
  ssoConfig?: Record<string, any>;
  twoFactorRequired: boolean;
  sessionTimeout: number;
  ipWhitelist: string[];
  auditLogRetention: number;
  dataRetention: number;
  apiRateLimit: number;
  maxUsers: number;
  maxAgents: number;
  maxWorkflows: number;
  features: string[];
}

export interface Subscription {
  id: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
  usage: {
    agents: number;
    workflows: number;
    apiCalls: number;
    storage: number;
  };
  limits: {
    agents: number;
    workflows: number;
    apiCalls: number;
    storage: number;
  };
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  userId: string;
  organizationId: string;
  permissions: Permission[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  organizationId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  lastActivityAt: Date;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string;
  organizationId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  organizationId: string;
  permissions: Permission[];
  sessionId: string;
  iat: number;
  exp: number;
}

export interface AuthContext {
  user: User | null;
  organization: Organization | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  switchOrganization: (organizationId: string) => Promise<void>;
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.ORG_ADMIN]: [
    Permission.AGENT_CREATE,
    Permission.AGENT_READ,
    Permission.AGENT_UPDATE,
    Permission.AGENT_DELETE,
    Permission.AGENT_EXECUTE,
    Permission.TOOL_CREATE,
    Permission.TOOL_READ,
    Permission.TOOL_UPDATE,
    Permission.TOOL_DELETE,
    Permission.TOOL_EXECUTE,
    Permission.WORKFLOW_CREATE,
    Permission.WORKFLOW_READ,
    Permission.WORKFLOW_UPDATE,
    Permission.WORKFLOW_DELETE,
    Permission.WORKFLOW_EXECUTE,
    Permission.ORG_SETTINGS,
    Permission.ORG_BILLING,
    Permission.ORG_ANALYTICS,
    Permission.USER_MANAGE,
    Permission.USER_INVITE,
    Permission.USER_REMOVE,
    Permission.AUDIT_READ
  ],
  [UserRole.DEVELOPER]: [
    Permission.AGENT_CREATE,
    Permission.AGENT_READ,
    Permission.AGENT_UPDATE,
    Permission.AGENT_DELETE,
    Permission.AGENT_EXECUTE,
    Permission.TOOL_CREATE,
    Permission.TOOL_READ,
    Permission.TOOL_UPDATE,
    Permission.TOOL_DELETE,
    Permission.TOOL_EXECUTE,
    Permission.WORKFLOW_CREATE,
    Permission.WORKFLOW_READ,
    Permission.WORKFLOW_UPDATE,
    Permission.WORKFLOW_DELETE,
    Permission.WORKFLOW_EXECUTE
  ],
  [UserRole.VIEWER]: [
    Permission.AGENT_READ,
    Permission.TOOL_READ,
    Permission.WORKFLOW_READ
  ]
};