import { z } from 'zod';

/** Optional field that never fails the document: a malformed value becomes undefined. */
const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const stringOrNumber = z.union([z.string(), z.number()]);

/**
 * config/app. Public read, written by the backend (Plan 2 seed).
 * Passthrough keeps `comunidadeLeonina`, `updatedAt` and whatever Plan 2 adds.
 */
export const AppConfigSchema = z.looseObject({
  minVersion: z.object({ ios: z.string(), android: z.string() }),
  storeUrls: z.object({ ios: z.string().optional(), android: z.string().optional() }).optional(),
  texts: z
    .object({
      updateRequiredTitle: z.string().optional(),
      updateRequiredBody: z.string().optional(),
      updateButton: z.string().optional(),
    })
    .optional(),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

/** publicProfiles/{uid}: the only per-user data other users may see. Never holds an email. */
export const PublicProfileSchema = z.object({
  displayName: z.string(),
  avatarId: z.string().nullable().default(null),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

/** users/{uid}: private V2 profile. Every field optional; V2 data is not uniform. */
export const UserDocSchema = z.looseObject({
  name: lenient(z.string()),
  email: lenient(z.string()),
  displayName: lenient(z.string()),
  partnerNumber: lenient(stringOrNumber),
  gameboxNumber: lenient(stringOrNumber),
});
export type UserDoc = z.infer<typeof UserDocSchema>;
