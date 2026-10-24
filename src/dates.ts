// Dates show in UTC, the zone Tamable publishes in, so a post never moves a day between build machines.

export function isoDay(iso: string): string {
  return iso.slice(0, 10)
}

export function monthDay(iso: string): string {
  return iso.slice(5, 10)
}

export function year(iso: string): string {
  return iso.slice(0, 4)
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
