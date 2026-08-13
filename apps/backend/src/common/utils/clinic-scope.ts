import { UserRole } from '@jeevandata/shared-types';

export interface ClinicScopeUser {
  role?: string;
  clinicId?: string;
}

/**
 * Build the Prisma `where` fragment that scopes a query to the authenticated
 * user's clinic. SYSTEM (and users without a clinic) can see everything;
 * everyone else is hard-scoped so Clinic A's staff can never read Clinic B's
 * patients, sessions, or briefs from the same database.
 */
export function getClinicFilter(user?: ClinicScopeUser): { clinicId?: string } {
  if (!user) {
    return {};
  }
  if (user.role === UserRole.SYSTEM || user.role === UserRole.ADMIN) {
    return {};
  }
  if (user.clinicId) {
    return { clinicId: user.clinicId };
  }
  return {};
}

/** True when the user is a global/system scope that may see every clinic. */
export function isGlobalScope(user?: ClinicScopeUser): boolean {
  if (!user) {
    return true;
  }
  return user.role === UserRole.SYSTEM || user.role === UserRole.ADMIN;
}
