import { requirePermission } from './requirePermission';

// Compatibility wrapper for existing route declarations. Unlike the former scaffold,
// this guard always performs a database-backed permission check and fails closed.
export function rbac(needed: string) {
  return requirePermission(needed);
}
