import type { Role } from '@tl/types';
import { ForbiddenError } from './auth';

/**
 * Permisos por rol.
 *
 * Modelo simple y explícito: cada permiso es una cadena `recurso:acción`.
 * `SUPER_ADMIN` los tiene todos. No hay herencia implícita entre roles: si un
 * rol necesita un permiso, se escribe en su lista.
 */

export const PERMISSIONS = [
  'admin:access',
  'users:read',
  'users:write',
  'users:suspend',
  'users:export',
  'subscriptions:read',
  'subscriptions:write',
  'payments:read',
  'payments:refund',
  'content:read',
  'content:write',
  'content:publish',
  'simulations:audit',
  'simulations:reset-balance',
  'ai:read',
  'ai:configure',
  'data:read',
  'data:configure',
  'ads:read',
  'ads:write',
  'ads:approve',
  'ads:billing',
  'compliance:read',
  'compliance:write',
  'support:read',
  'support:write',
  'analytics:read',
  'audit:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  STUDENT: [],
  INSTRUCTOR: ['admin:access', 'content:read', 'content:write', 'analytics:read'],
  CONTENT_EDITOR: ['admin:access', 'content:read', 'content:write', 'content:publish', 'analytics:read'],
  SUPPORT: [
    'admin:access',
    'users:read',
    'subscriptions:read',
    'payments:read',
    'support:read',
    'support:write',
    'simulations:audit',
    'simulations:reset-balance',
  ],
  ADVERTISER_MANAGER: ['admin:access', 'ads:read', 'ads:write', 'ads:billing', 'analytics:read'],
  FINANCE_ADMIN: [
    'admin:access',
    'subscriptions:read',
    'subscriptions:write',
    'payments:read',
    'payments:refund',
    'ads:read',
    'ads:billing',
    'analytics:read',
  ],
  COMPLIANCE_ADMIN: [
    'admin:access',
    'users:read',
    'compliance:read',
    'compliance:write',
    'ads:read',
    'ads:approve',
    'ai:read',
    'simulations:audit',
    'audit:read',
    'analytics:read',
  ],
  SUPER_ADMIN: [...PERMISSIONS],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError(`Tu rol (${ROLE_LABEL[role]}) no tiene el permiso "${permission}".`);
  }
}

export function permissionsFor(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export const ROLE_LABEL: Record<Role, string> = {
  STUDENT: 'Estudiante',
  INSTRUCTOR: 'Instructor',
  CONTENT_EDITOR: 'Editor de contenido',
  SUPPORT: 'Soporte',
  ADVERTISER_MANAGER: 'Gestor de publicidad',
  FINANCE_ADMIN: 'Administración financiera',
  COMPLIANCE_ADMIN: 'Cumplimiento',
  SUPER_ADMIN: 'Administración general',
};
