-- ═══════════════════════════════════════════════════════════════
-- MASSVISION Reap3r - Migration 002: Seed Data
-- Default organization, roles, and admin user
-- ═══════════════════════════════════════════════════════════════

-- Default organization
INSERT INTO organizations (id, name, slug, plan, max_agents) VALUES
  ('00000000-0000-0000-0000-000000000001', 'MASSVISION Default', 'default', 'enterprise', 1000);

-- Built-in roles
INSERT INTO roles (id, organization_id, name, description, permissions, is_system) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Super Admin', 'Full platform access', ARRAY[
    'agents.view','agents.manage','agents.delete','agents.enroll',
    'scripts.run','scripts.manage',
    'remote.shell','remote.desktop',
    'power.reboot','power.shutdown','power.wol',
    'services.manage','processes.kill',
    'agent.update',
    'artifacts.upload','artifacts.download',
    'webcam.capture',
    'jobs.view','jobs.create','jobs.cancel',
    'audit.view',
    'org.manage','org.users.manage','org.roles.manage','org.settings.manage',
    'dashboard.view',
    'reports.view','reports.export'
  ], TRUE),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Organization Admin', 'Full access within organization', ARRAY[
    'agents.view','agents.manage','agents.delete','agents.enroll',
    'scripts.run','scripts.manage',
    'remote.shell','remote.desktop',
    'power.reboot','power.shutdown','power.wol',
    'services.manage','processes.kill',
    'agent.update',
    'artifacts.upload','artifacts.download',
    'jobs.view','jobs.create','jobs.cancel',
    'audit.view',
    'org.manage','org.users.manage','org.roles.manage','org.settings.manage',
    'dashboard.view',
    'reports.view','reports.export'
  ], TRUE),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Operator', 'Can manage agents and run operations', ARRAY[
    'agents.view','agents.manage',
    'scripts.run',
    'remote.shell','remote.desktop',
    'power.reboot','power.wol',
    'services.manage','processes.kill',
    'artifacts.upload','artifacts.download',
    'jobs.view','jobs.create','jobs.cancel',
    'audit.view',
    'dashboard.view',
    'reports.view'
  ], TRUE),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Viewer', 'Read-only access', ARRAY[
    'agents.view',
    'jobs.view',
    'audit.view',
    'dashboard.view',
    'reports.view'
  ], TRUE);

-- Default admin user (password: Admin@123456)
-- bcrypt hash for "Admin@123456"
INSERT INTO users (id, organization_id, role_id, email, password_hash, full_name, is_active, is_super_admin) VALUES
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'admin@massvision.io', '$2b$12$LJ3m4ys3Lk0TSwHjfB0s2e8MKeIXRWJT0kXRj/2t4.xVqJzGHfSRe', 'System Administrator', TRUE, TRUE);

-- Default enrollment token (token: mv-enroll-default-token-change-me)
INSERT INTO enrollment_tokens (id, organization_id, token_hash, name, tags, policy) VALUES
  ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000001', 
   encode(digest('mv-enroll-default-token-change-me', 'sha256'), 'hex'),
   'Default Enrollment Token',
   ARRAY['default'],
   '{"metrics_interval_sec": 30, "inventory_interval_sec": 3600, "allowed_job_types": ["run_script","remote_shell_start","remote_shell_stop","remote_desktop_start","remote_desktop_stop","reboot","shutdown","service_restart","service_stop","service_start","process_kill"], "max_concurrent_jobs": 5, "update_channel": "stable"}'::jsonb
  );
