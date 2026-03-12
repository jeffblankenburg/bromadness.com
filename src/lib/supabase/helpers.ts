/**
 * Safely extract a joined Supabase relation that may come back as
 * an object or a single-element array (depending on query shape).
 */
export function extractRelation<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return (value[0] as T) ?? null
  return value as T
}
