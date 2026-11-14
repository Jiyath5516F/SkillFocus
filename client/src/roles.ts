// Built-in roles plus the learner's custom aims (registered so the shared engine can resolve them).
import { registerRoles } from '../../shared/catalog';
import type { Profile, RoleDef } from '../../shared/types';
import type { Meta } from './api';

export function allRoles(meta: Meta, profile: Profile): RoleDef[] {
  registerRoles(profile.customRoles);
  return [...meta.roles, ...(profile.customRoles ?? [])];
}
