export const STAFF_ROLES = ['owner', 'editor', 'contributor', 'catalogue'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  'catalogue',
  'orders',
  'delivery',
  'content.edit',
  'content.publish',
  'uploads',
  'audit',
  'users',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const GRANTS: Record<StaffRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  catalogue: ['catalogue', 'orders', 'delivery', 'uploads', 'audit'],
  editor: ['content.edit', 'content.publish', 'uploads', 'audit'],
  contributor: ['content.edit', 'uploads'],
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Owner: everything, including staff accounts',
  catalogue: 'Catalogue: products, prices, stock, orders and delivery',
  editor: 'Editor: writes and publishes site content',
  contributor: 'Contributor: writes content for an editor to publish',
};

export const can = (role: StaffRole, permission: Permission) => GRANTS[role].includes(permission);

export const permissionsOf = (role: StaffRole): Permission[] => [...GRANTS[role]];
