import { getClinicFilter, isGlobalScope } from './clinic-scope';
import { UserRole } from '@jeevandata/shared-types';

describe('clinic-scope (8.5.1)', () => {
  describe('getClinicFilter', () => {
    it('returns {} when no user is provided (internal/system callers)', () => {
      expect(getClinicFilter()).toEqual({});
    });

    it('scopes a clinic user to their own clinicId', () => {
      expect(getClinicFilter({ role: UserRole.DOCTOR, clinicId: 'clinic-a' })).toEqual({
        clinicId: 'clinic-a',
      });
    });

    it('scopes a RECEPTIONIST to their clinicId', () => {
      expect(getClinicFilter({ role: UserRole.RECEPTIONIST, clinicId: 'clinic-b' })).toEqual({
        clinicId: 'clinic-b',
      });
    });

    it('returns {} for SYSTEM users (global scope)', () => {
      expect(getClinicFilter({ role: UserRole.SYSTEM, clinicId: 'clinic-a' })).toEqual({});
    });

    it('returns {} for ADMIN users (global scope)', () => {
      expect(getClinicFilter({ role: UserRole.ADMIN, clinicId: 'clinic-a' })).toEqual({});
    });

    it('returns {} for a user without a clinicId', () => {
      expect(getClinicFilter({ role: UserRole.DOCTOR })).toEqual({});
    });
  });

  describe('isGlobalScope', () => {
    it('is true for SYSTEM, ADMIN, and undefined users', () => {
      expect(isGlobalScope({ role: UserRole.SYSTEM })).toBe(true);
      expect(isGlobalScope({ role: UserRole.ADMIN })).toBe(true);
      expect(isGlobalScope()).toBe(true);
    });

    it('is false for clinic-scoped roles', () => {
      expect(isGlobalScope({ role: UserRole.DOCTOR, clinicId: 'clinic-a' })).toBe(false);
      expect(isGlobalScope({ role: UserRole.RECEPTIONIST, clinicId: 'clinic-a' })).toBe(false);
    });
  });
});
