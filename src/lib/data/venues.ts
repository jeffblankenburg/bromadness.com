export interface Venue {
  location: string
  rounds: number[]
}

export const VENUES: Venue[] = [
  // Rounds 1 & 2
  { location: 'Buffalo, NY', rounds: [1, 2] },
  { location: 'Greenville, SC', rounds: [1, 2] },
  { location: 'Oklahoma City, OK', rounds: [1, 2] },
  { location: 'Portland, OR', rounds: [1, 2] },
  { location: 'Tampa, FL', rounds: [1, 2] },
  { location: 'Philadelphia, PA', rounds: [1, 2] },
  { location: 'San Diego, CA', rounds: [1, 2] },
  { location: 'St. Louis, MO', rounds: [1, 2] },
  // Sweet 16 & Elite 8
  { location: 'Houston, TX', rounds: [3, 4] },
  { location: 'San Jose, CA', rounds: [3, 4] },
  { location: 'Chicago, IL', rounds: [3, 4] },
  { location: 'Washington, D.C.', rounds: [3, 4] },
  // Final Four & Championship
  { location: 'Indianapolis, IN', rounds: [5, 6] },
]

export function getVenuesForRound(round: number): Venue[] {
  return VENUES.filter(v => v.rounds.includes(round))
}

export function formatVenue(venue: Venue): string {
  return venue.location
}
