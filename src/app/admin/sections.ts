import type { Permission } from '@/lib/rbac';

/** Secciones del panel administrativo, cada una con el permiso que la protege. */
export const ADMIN_SECTIONS: Array<{ href: string; label: string; permission: Permission }> = [
  { href: '/admin', label: 'Resumen', permission: 'admin:access' },
  { href: '/admin/usuarios', label: 'Usuarios', permission: 'users:read' },
  { href: '/admin/suscripciones', label: 'Suscripciones', permission: 'subscriptions:read' },
  { href: '/admin/contenido', label: 'Contenido', permission: 'content:read' },
  { href: '/admin/simulaciones', label: 'Auditoría de simulaciones', permission: 'simulations:audit' },
  { href: '/admin/ia', label: 'Inteligencia artificial', permission: 'ai:read' },
  { href: '/admin/datos', label: 'Proveedores de datos', permission: 'data:read' },
  { href: '/admin/publicidad', label: 'Publicidad', permission: 'ads:read' },
  { href: '/admin/analitica', label: 'Analítica del negocio', permission: 'analytics:read' },
  { href: '/admin/cumplimiento', label: 'Cumplimiento', permission: 'compliance:read' },
  { href: '/admin/soporte', label: 'Soporte', permission: 'support:read' },
  { href: '/admin/auditoria', label: 'Registro de auditoría', permission: 'audit:read' },
];
