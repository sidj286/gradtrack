// src/lib/idUtils.ts

/**
 * Standardized Alumni ID formatter for CRMC Digital ID.
 * Strictly formatted without spaces as: CRMC-[first 8 characters of Supabase UUID] (e.g. CRMC-D333D112)
 */
export function getFormattedAlumniID(profile?: { id?: string | null } | null): string {
  if (profile?.id) {
    const first8 = profile.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    return `CRMC-${first8}`;
  }
  return 'CRMC-ALUMNI';
}
