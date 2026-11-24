/** Honorifics are skipped so "Dr. Ramon Salazar" becomes "RS". */
const TITLES = new Set(['dr.', 'prof.', 'engr.', 'mr.', 'ms.', 'mrs.', 'atty.'])

/** Up to two letters for an avatar: first and last name ("Shauntie Velasco" → "SV"). */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p && !TITLES.has(p.toLowerCase()))
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? '')
  return (first + last).toUpperCase()
}
