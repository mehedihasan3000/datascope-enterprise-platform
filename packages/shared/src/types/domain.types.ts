import type { FieldDataType, SearchMode } from '../constants/operators.js';
import type { RoleName } from '../constants/roles.js';
import type { FilterCondition, SortRule } from '../schemas/search.schema.js';

export interface RoleDTO {
  id: string;
  name: RoleName;
  description: string;
  permissions: string[];
}

export interface UserPreferencesDTO {
  id: string;
  userId: string;
  theme: 'dark' | 'light' | 'system';
  defaultPageSize: number;
  tableDensity: 'compact' | 'comfortable' | 'spacious';
  defaultDatasetId: string | null;
  columnConfigs: Record<
    string,
    {
      visibleColumns?: string[];
      columnSizing?: Record<string, number>;
    }
  >;
  updatedAt: string;
}

export interface UserDTO {
  id: string;
  email: string;
  fullName: string;
  role: RoleName;
  roleId: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  preferences?: UserPreferencesDTO;
}

export interface DatasetFieldDTO {
  id: string;
  datasetId: string;
  fieldKey: string;
  displayName: string;
  dataType: FieldDataType;
  isCoreColumn: boolean;
  isSortable: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  isDefaultVisible: boolean;
  enumValues: string[] | null;
  sortOrder: number;
}

export interface EffectiveDatasetPermissions {
  canView: boolean;
  canSearch: boolean;
  canExport: boolean;
  canManage: boolean;
}

export interface AccessPermissionDTO {
  id: string;
  datasetId: string;
  roleId: string | null;
  roleName?: RoleName | null;
  userId: string | null;
  userEmail?: string | null;
  canView: boolean;
  canSearch: boolean;
  canExport: boolean;
  canManage: boolean;
  createdAt: string;
}

export interface DatasetDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  dataSource: string;
  totalRecords: number;
  createdBy: string;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
  fields?: DatasetFieldDTO[];
  effectivePermissions?: EffectiveDatasetPermissions;
}

export interface DatasetRecordDTO {
  id: string;
  datasetId: string;
  recordCode: string;
  title: string;
  category: string;
  status: 'Active' | 'Pending' | 'Suspended' | 'Archived' | string;
  country: string;
  revenue: number;
  employeeCount: number;
  riskScore: number;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RecordRelationshipDTO {
  id: string;
  sourceRecordId: string;
  targetRecordId: string;
  relationshipType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  targetRecord?: {
    id: string;
    recordCode: string;
    title: string;
    category: string;
    status: string;
    country: string;
    revenue: number;
  };
}

export interface RecordHistoryDTO {
  id: string;
  recordId: string;
  changedBy: string | null;
  changedByName?: string | null;
  changeType: string;
  summary: string;
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown>;
  changedAt: string;
}

export interface RecordDetailDTO extends DatasetRecordDTO {
  relationships: RecordRelationshipDTO[];
  history: RecordHistoryDTO[];
}

export interface SavedViewDTO {
  id: string;
  name: string;
  description: string | null;
  datasetId: string;
  datasetName?: string;
  userId: string;
  ownerName?: string;
  searchQuery: string;
  searchMode: SearchMode;
  filters: FilterCondition[];
  sorting: SortRule[];
  visibleColumns: string[];
  isShared: boolean;
  sharedWithRoles: RoleName[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchHistoryDTO {
  id: string;
  userId: string;
  datasetId: string;
  datasetName?: string;
  searchQuery: string;
  filters: FilterCondition[];
  sorting: SortRule[];
  resultCount: number;
  executionTimeMs: number;
  executedAt: string;
}
