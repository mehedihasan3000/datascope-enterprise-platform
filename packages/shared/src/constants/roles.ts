/**
 * DataScope Role-Based Access Control (RBAC) Constants & Capabilities
 * Covers Section 2 (Platform Users) & Section 13 (Security & Authorization)
 */

export const ROLES = {
  ADMIN: 'ADMIN',
  ANALYST: 'ANALYST',
  VIEWER: 'VIEWER',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<RoleName, string> = {
  ADMIN: 'Administrator',
  ANALYST: 'Data Analyst',
  VIEWER: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  ADMIN:
    'Manage platform users, manage data collections, configure data access permissions, view platform-wide analytics, and manage system configurations.',
  ANALYST:
    'Explore available datasets, perform advanced searches, apply multiple filters, create/save/share search queries, analyze records, and export selected data.',
  VIEWER:
    'Browse authorized datasets, search records, apply basic filters, view record details, and access saved shared views.',
};

export const CAPABILITIES = {
  MANAGE_USERS: 'users:manage',
  MANAGE_DATASETS: 'datasets:manage',
  MANAGE_PERMISSIONS: 'permissions:manage',
  MANAGE_SYSTEM_CONFIG: 'system:manage',
  VIEW_PLATFORM_ANALYTICS: 'analytics:view',
  EXPLORE_DATASETS: 'datasets:explore',
  ADVANCED_SEARCH: 'search:advanced',
  BASIC_SEARCH: 'search:basic',
  SAVE_VIEWS: 'views:save',
  SHARE_VIEWS: 'views:share',
  VIEW_SHARED_VIEWS: 'views:read_shared',
  EXPORT_DATA: 'data:export',
  VIEW_RECORD_DETAILS: 'records:view_details',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

export const ROLE_CAPABILITIES: Record<RoleName, readonly Capability[]> = {
  ADMIN: [
    CAPABILITIES.MANAGE_USERS,
    CAPABILITIES.MANAGE_DATASETS,
    CAPABILITIES.MANAGE_PERMISSIONS,
    CAPABILITIES.MANAGE_SYSTEM_CONFIG,
    CAPABILITIES.VIEW_PLATFORM_ANALYTICS,
    CAPABILITIES.EXPLORE_DATASETS,
    CAPABILITIES.ADVANCED_SEARCH,
    CAPABILITIES.BASIC_SEARCH,
    CAPABILITIES.SAVE_VIEWS,
    CAPABILITIES.SHARE_VIEWS,
    CAPABILITIES.VIEW_SHARED_VIEWS,
    CAPABILITIES.EXPORT_DATA,
    CAPABILITIES.VIEW_RECORD_DETAILS,
  ],
  ANALYST: [
    CAPABILITIES.VIEW_PLATFORM_ANALYTICS,
    CAPABILITIES.EXPLORE_DATASETS,
    CAPABILITIES.ADVANCED_SEARCH,
    CAPABILITIES.BASIC_SEARCH,
    CAPABILITIES.SAVE_VIEWS,
    CAPABILITIES.SHARE_VIEWS,
    CAPABILITIES.VIEW_SHARED_VIEWS,
    CAPABILITIES.EXPORT_DATA,
    CAPABILITIES.VIEW_RECORD_DETAILS,
  ],
  VIEWER: [
    CAPABILITIES.EXPLORE_DATASETS,
    CAPABILITIES.BASIC_SEARCH,
    CAPABILITIES.VIEW_SHARED_VIEWS,
    CAPABILITIES.VIEW_RECORD_DETAILS,
  ],
};

export function hasCapability(role: RoleName, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}
