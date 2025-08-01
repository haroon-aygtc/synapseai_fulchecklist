import { useAuth } from './auth-context';

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export const usePermissions = () => {
  const { user, organization } = useAuth();

  const hasPermission = (permission: string): boolean => {
    if (!user || !organization) return false;
    
    // Get user's role in the organization
    const membership = user.organizationMemberships?.find(
      (m: any) => m.organizationId === organization.id
    );
    
    if (!membership) return false;
    
    const role = membership.role;
    
    // Super admin has all permissions
    if (role === 'SUPER_ADMIN') return true;
    
    // Admin has most permissions
    if (role === 'ADMIN') {
      const restrictedPermissions = ['ORGANIZATION_DELETE', 'USER_DELETE_ADMIN'];
      return !restrictedPermissions.includes(permission);
    }
    
    // Manager permissions
    if (role === 'MANAGER') {
      const managerPermissions = [
        'AGENTS_CREATE', 'AGENTS_READ', 'AGENTS_UPDATE', 'AGENTS_EXECUTE',
        'WORKFLOWS_CREATE', 'WORKFLOWS_READ', 'WORKFLOWS_UPDATE', 'WORKFLOWS_EXECUTE',
        'TOOLS_CREATE', 'TOOLS_READ', 'TOOLS_UPDATE', 'TOOLS_EXECUTE',
        'KNOWLEDGE_CREATE', 'KNOWLEDGE_READ', 'KNOWLEDGE_UPDATE',
        'ANALYTICS_READ', 'REPORTS_READ'
      ];
      return managerPermissions.includes(permission);
    }
    
    // Member permissions
    if (role === 'MEMBER') {
      const memberPermissions = [
        'AGENTS_READ', 'AGENTS_EXECUTE',
        'WORKFLOWS_READ', 'WORKFLOWS_EXECUTE',
        'TOOLS_READ', 'TOOLS_EXECUTE',
        'KNOWLEDGE_READ',
        'ANALYTICS_READ'
      ];
      return memberPermissions.includes(permission);
    }
    
    // Viewer permissions
    if (role === 'VIEWER') {
      const viewerPermissions = [
        'AGENTS_READ',
        'WORKFLOWS_READ',
        'TOOLS_READ',
        'KNOWLEDGE_READ'
      ];
      return viewerPermissions.includes(permission);
    }
    
    return false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  const canAccessResource = (resource: string, action: string): boolean => {
    return hasPermission(`${resource.toUpperCase()}_${action.toUpperCase()}`);
  };

  const getUserRole = (): string | null => {
    if (!user || !organization) return null;
    
    const membership = user.organizationMemberships?.find(
      (m: any) => m.organizationId === organization.id
    );
    
    return membership?.role || null;
  };

  const isAdmin = (): boolean => {
    const role = getUserRole();
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  };

  const isManager = (): boolean => {
    const role = getUserRole();
    return role === 'MANAGER' || isAdmin();
  };

  const canManageUsers = (): boolean => {
    return hasPermission('USERS_MANAGE');
  };

  const canManageOrganization = (): boolean => {
    return hasPermission('ORGANIZATION_MANAGE');
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessResource,
    getUserRole,
    isAdmin,
    isManager,
    canManageUsers,
    canManageOrganization
  };
};

export default usePermissions;