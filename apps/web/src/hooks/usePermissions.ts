'use client';

import { hasCapability, ROLES, type Capability, type RoleName } from '@datascope/shared';
import { useAppSelector } from '@/store';

export function usePermissions() {
  const user = useAppSelector((state) => state.auth.user);
  const role: RoleName | null = user?.role ?? null;

  const can = (capability: Capability): boolean => {
    if (!role) return false;
    if (user?.permissions?.includes(capability)) return true;
    return hasCapability(role, capability);
  };

  return {
    user,
    role,
    isAdmin: role === ROLES.ADMIN,
    isAnalyst: role === ROLES.ANALYST,
    isViewer: role === ROLES.VIEWER,
    can,
  };
}
