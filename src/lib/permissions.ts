import type { Role, AuthPayload } from '@/types'

type Action =
  | 'clients:view_all'
  | 'clients:view_own'
  | 'clients:create'
  | 'clients:edit'
  | 'clients:delete'
  | 'clients:bulk_delete'
  | 'invoices:view'
  | 'invoices:manage'
  | 'users:manage'
  | 'settings:branding'
  | 'settings:smtp'
  | 'settings:plugins'
  | 'documents:upload'
  | 'documents:delete'
  | 'events:manage'
  | 'sales:register'
  | 'templates:manage'
  | 'deals:view'
  | 'deals:create'
  | 'deals:edit'
  | 'deals:delete'
  | 'tasks:view'
  | 'tasks:create'
  | 'tasks:edit'
  | 'tasks:delete'
  | 'tickets:view'
  | 'tickets:create'
  | 'tickets:manage'
  | 'hr:view'
  | 'hr:manage'

const PERMISSIONS: Record<Role, Action[]> = {
  HR: [
    'tasks:view',
    'hr:view', 'hr:manage',
  ],
  TECHNICIAN: [
    'tasks:view', 'tasks:create', 'tasks:edit',
    'tickets:view', 'tickets:create',
  ],
  SUPER_ADMIN: [
    'clients:view_all', 'clients:view_own', 'clients:create', 'clients:edit',
    'clients:delete', 'clients:bulk_delete',
    'invoices:view', 'invoices:manage',
    'users:manage',
    'settings:branding', 'settings:smtp', 'settings:plugins',
    'documents:upload', 'documents:delete',
    'events:manage',
    'sales:register',
    'templates:manage',
    'deals:view', 'deals:create', 'deals:edit', 'deals:delete',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete',
    'tickets:view', 'tickets:create', 'tickets:manage',
    'hr:view', 'hr:manage',
  ],
  ADMIN: [
    'clients:view_all', 'clients:view_own', 'clients:create', 'clients:edit',
    'clients:delete', 'clients:bulk_delete',
    'invoices:view', 'invoices:manage',
    'users:manage',
    'documents:upload', 'documents:delete',
    'events:manage',
    'sales:register',
    'templates:manage',
    'deals:view', 'deals:create', 'deals:edit', 'deals:delete',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete',
    'tickets:view', 'tickets:create', 'tickets:manage',
    'hr:view', 'hr:manage',
  ],
  SELLER: [
    'clients:view_own', 'clients:create', 'clients:edit',
    'invoices:view',
    'documents:upload',
    'events:manage',
    'sales:register',
    'deals:view', 'deals:create', 'deals:edit',
    'tasks:view', 'tasks:create', 'tasks:edit',
    'tickets:view', 'tickets:create',
  ],
}

export function can(user: AuthPayload | { role: Role }, action: Action): boolean {
  return PERMISSIONS[user.role as Role]?.includes(action) ?? false
}

export function canRole(role: Role, action: Action): boolean {
  return PERMISSIONS[role]?.includes(action) ?? false
}
