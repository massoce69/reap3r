// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Auth & RBAC Types
// ─────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// Permissions
// ═══════════════════════════════════════════════════════════════

export const PERMISSIONS = [
  // Agent management
  'agents.view',
  'agents.manage',
  'agents.delete',
  'agents.enroll',

  // Scripts
  'scripts.run',
  'scripts.manage',

  // Remote access
  'remote.shell',
  'remote.desktop',

  // Power management
  'power.reboot',
  'power.shutdown',
  'power.wol',

  // Service/process management
  'services.manage',
  'processes.kill',

  // Agent updates
  'agent.update',

  // Artifacts
  'artifacts.upload',
  'artifacts.download',

  // Webcam
  'webcam.capture',

  // Jobs
  'jobs.view',
  'jobs.create',
  'jobs.cancel',

  // Audit
  'audit.view',

  // Organization
  'org.manage',
  'org.users.manage',
  'org.roles.manage',
  'org.settings.manage',

  // Dashboard
  'dashboard.view',

  // Reports
  'reports.view',
  'reports.export',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// ═══════════════════════════════════════════════════════════════
// Built-in Roles
// ═══════════════════════════════════════════════════════════════

export const BUILT_IN_ROLES = {
  super_admin: {
    name: 'Super Admin',
    description: 'Full platform access',
    permissions: PERMISSIONS as unknown as Permission[],
  },
  org_admin: {
    name: 'Organization Admin',
    description: 'Full access within organization',
    permissions: [
      'agents.view', 'agents.manage', 'agents.delete', 'agents.enroll',
      'scripts.run', 'scripts.manage',
      'remote.shell', 'remote.desktop',
      'power.reboot', 'power.shutdown', 'power.wol',
      'services.manage', 'processes.kill',
      'agent.update',
      'artifacts.upload', 'artifacts.download',
      'jobs.view', 'jobs.create', 'jobs.cancel',
      'audit.view',
      'org.manage', 'org.users.manage', 'org.roles.manage', 'org.settings.manage',
      'dashboard.view',
      'reports.view', 'reports.export',
    ] as Permission[],
  },
  operator: {
    name: 'Operator',
    description: 'Can manage agents and run operations',
    permissions: [
      'agents.view', 'agents.manage',
      'scripts.run',
      'remote.shell', 'remote.desktop',
      'power.reboot', 'power.wol',
      'services.manage', 'processes.kill',
      'artifacts.upload', 'artifacts.download',
      'jobs.view', 'jobs.create', 'jobs.cancel',
      'audit.view',
      'dashboard.view',
      'reports.view',
    ] as Permission[],
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      'agents.view',
      'jobs.view',
      'audit.view',
      'dashboard.view',
      'reports.view',
    ] as Permission[],
  },
} as const;

export type BuiltInRoleName = keyof typeof BUILT_IN_ROLES;

// ═══════════════════════════════════════════════════════════════
// JWT & Auth Types
// ═══════════════════════════════════════════════════════════════

export interface JwtPayload {
  sub: string; // user_id
  org_id: string;
  role: string;
  permissions: Permission[];
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: UserProfile;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_id: string;
  organization_name: string;
  permissions: Permission[];
  avatar_url?: string;
  created_at: string;
  last_login: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  role_id: string;
}

export interface UpdateUserRequest {
  full_name?: string;
  role_id?: string;
  is_active?: boolean;
}
