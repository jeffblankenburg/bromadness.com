// Bracket generation algorithms for custom tournaments

export interface GeneratedParticipant {
  id: string
  user_id: string
  seed: number
}

export interface GeneratedMatch {
  id: string
  round: number
  match_number: number
  bracket_side: 'winners' | 'losers' | 'finals'
  participant1_id: string | null
  participant2_id: string | null
  winner_id: string | null
  loser_goes_to_match_id: string | null
  winner_goes_to_match_id: string | null
  winner_is_slot1: boolean | null
}

// Get next power of 2 >= n
export function getNextPowerOf2(n: number): number {
  let power = 1
  while (power < n) power *= 2
  return power
}

// Calculate byes needed
export function calculateByes(participantCount: number): number {
  const bracketSize = getNextPowerOf2(participantCount)
  return bracketSize - participantCount
}

// Shuffle array using Fisher-Yates
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Generate UUID (for client-side generation)
function generateUUID(): string {
  return crypto.randomUUID()
}

// Assign random seeds to participants
export function assignRandomSeeds(userIds: string[]): GeneratedParticipant[] {
  const shuffled = shuffleArray(userIds)
  return shuffled.map((userId, index) => ({
    id: generateUUID(),
    user_id: userId,
    seed: index + 1,
  }))
}

// Generate standard bracket seeding matchups
// For 8-player: [[1,8], [4,5], [2,7], [3,6]] ensures 1v2 in finals
function generateSeedMatchups(bracketSize: number): [number, number][] {
  if (bracketSize === 2) {
    return [[1, 2]]
  }

  // Build matchups recursively to maintain proper bracket structure
  const matchups: [number, number][] = []
  const halfSize = bracketSize / 2

  // Pair seeds: 1 vs bracketSize, 2 vs bracketSize-1, etc.
  // Then order them for proper bracket flow
  for (let i = 1; i <= halfSize; i++) {
    matchups.push([i, bracketSize - i + 1])
  }

  // Reorder for bracket structure (1v8, 4v5, 2v7, 3v6 for 8 players)
  // This ensures seeds 1 and 2 are on opposite sides
  const reordered: [number, number][] = []
  const used = new Set<number>()

  function addMatchup(topSeed: number) {
    const idx = matchups.findIndex(m => m[0] === topSeed && !used.has(matchups.indexOf(m)))
    if (idx !== -1) {
      reordered.push(matchups[idx])
      used.add(idx)
    }
  }

  // Standard bracket order for seeds 1-N
  if (bracketSize === 4) {
    addMatchup(1) // 1v4
    addMatchup(2) // 2v3
  } else if (bracketSize === 8) {
    addMatchup(1) // 1v8
    addMatchup(4) // 4v5
    addMatchup(2) // 2v7
    addMatchup(3) // 3v6
  } else if (bracketSize === 16) {
    addMatchup(1)  // 1v16
    addMatchup(8)  // 8v9
    addMatchup(4)  // 4v13
    addMatchup(5)  // 5v12
    addMatchup(2)  // 2v15
    addMatchup(7)  // 7v10
    addMatchup(3)  // 3v14
    addMatchup(6)  // 6v11
  } else {
    // For larger or non-standard sizes, use simple ordering
    return matchups
  }

  return reordered.length > 0 ? reordered : matchups
}

// Generate single elimination bracket structure
export function generateSingleEliminationBracket(
  participants: GeneratedParticipant[]
): GeneratedMatch[] {
  const bracketSize = getNextPowerOf2(participants.length)
  const byeCount = bracketSize - participants.length
  const matchups = generateSeedMatchups(bracketSize)
  const matches: GeneratedMatch[] = []
  const totalRounds = Math.log2(bracketSize)

  // Create participant lookup by seed
  const participantBySeed = new Map<number, GeneratedParticipant>()
  participants.forEach(p => participantBySeed.set(p.seed, p))

  // Top seeds (1, 2, etc.) get byes - they face "ghost" opponents
  const byeSeeds = new Set<number>()
  for (let i = 1; i <= byeCount; i++) {
    byeSeeds.add(i)
  }

  // Generate round 1 matches
  matchups.forEach((matchup, idx) => {
    const [seed1, seed2] = matchup
    const p1 = participantBySeed.get(seed1)
    const p2 = participantBySeed.get(seed2)

    // Check if either seed is a bye (no opponent)
    const seed1IsBye = byeSeeds.has(seed1) && !p1
    const seed2IsBye = byeSeeds.has(seed2) && !p2

    const match: GeneratedMatch = {
      id: generateUUID(),
      round: 1,
      match_number: idx + 1,
      bracket_side: 'winners',
      participant1_id: p1?.id || null,
      participant2_id: p2?.id || null,
      winner_id: null,
      loser_goes_to_match_id: null,
      winner_goes_to_match_id: null,
      winner_is_slot1: null,
    }

    // Mark as bye match if one participant is missing
    // Don't set winner_id here - we'll handle advancement after linking
    if (seed1IsBye && p2) {
      match.winner_id = p2.id
    } else if (seed2IsBye && p1) {
      match.winner_id = p1.id
    }

    matches.push(match)
  })

  // Generate subsequent rounds
  let prevRoundMatches = matches.filter(m => m.round === 1)

  for (let round = 2; round <= totalRounds; round++) {
    const roundMatches: GeneratedMatch[] = []

    for (let i = 0; i < prevRoundMatches.length; i += 2) {
      const match: GeneratedMatch = {
        id: generateUUID(),
        round,
        match_number: Math.floor(i / 2) + 1,
        bracket_side: 'winners',
        participant1_id: null,
        participant2_id: null,
        winner_id: null,
        loser_goes_to_match_id: null,
        winner_goes_to_match_id: null,
        winner_is_slot1: null,
      }
      roundMatches.push(match)

      // Link previous round matches to this one
      prevRoundMatches[i].winner_goes_to_match_id = match.id
      prevRoundMatches[i].winner_is_slot1 = true
      if (prevRoundMatches[i + 1]) {
        prevRoundMatches[i + 1].winner_goes_to_match_id = match.id
        prevRoundMatches[i + 1].winner_is_slot1 = false
      }
    }

    matches.push(...roundMatches)
    prevRoundMatches = roundMatches
  }

  // Now propagate bye winners to their next matches
  propagateByeWinners(matches)

  return matches
}

// Propagate bye winners through the bracket
function propagateByeWinners(matches: GeneratedMatch[]) {
  const matchById = new Map<string, GeneratedMatch>()
  matches.forEach(m => matchById.set(m.id, m))

  let changed = true
  while (changed) {
    changed = false
    for (const match of matches) {
      // If this match has a winner and a next match
      if (match.winner_id && match.winner_goes_to_match_id) {
        const nextMatch = matchById.get(match.winner_goes_to_match_id)
        if (nextMatch) {
          const slot = match.winner_is_slot1 ? 'participant1_id' : 'participant2_id'
          // If the slot is empty, fill it
          if (nextMatch[slot] === null) {
            nextMatch[slot] = match.winner_id
            changed = true
          }
        }
      }
    }

    // Check if any matches now have only one participant (another bye situation)
    for (const match of matches) {
      if (!match.winner_id) {
        const hasP1 = match.participant1_id !== null
        const hasP2 = match.participant2_id !== null
        // If exactly one participant and no winner yet, auto-advance
        if (hasP1 && !hasP2) {
          match.winner_id = match.participant1_id
          changed = true
        } else if (!hasP1 && hasP2) {
          match.winner_id = match.participant2_id
          changed = true
        }
      }
    }
  }
}

// Generate double elimination bracket structure
// Pattern: L-R1 (W-R1 losers consolidate) → L-R2 (W-R2 drop-in) → L-R3 (consolidate) → L-R4 (W-R3 drop-in) → ...
export function generateDoubleEliminationBracket(
  participants: GeneratedParticipant[]
): GeneratedMatch[] {
  // Start with winners bracket (same as single elimination)
  const matches = generateSingleEliminationBracket(participants)
  const bracketSize = getNextPowerOf2(participants.length)
  const winnersRounds = Math.log2(bracketSize)

  const losersMatches: GeneratedMatch[] = []
  let currentLosersRound = 1

  // Get winners matches by round
  const getWinnersRoundMatches = (round: number) =>
    matches.filter(m => m.round === round && m.bracket_side === 'winners')

  // Get losers matches by round
  const getLosersRoundMatches = (round: number) =>
    losersMatches.filter(m => m.round === round && m.bracket_side === 'losers')

  // L-R1: W-R1 losers play each other (initial consolidation)
  const winnersR1Matches = getWinnersRoundMatches(1)
  const numL1Matches = Math.floor(winnersR1Matches.length / 2)

  for (let i = 0; i < numL1Matches; i++) {
    const match: GeneratedMatch = {
      id: generateUUID(),
      round: currentLosersRound,
      match_number: i + 1,
      bracket_side: 'losers',
      participant1_id: null,
      participant2_id: null,
      winner_id: null,
      loser_goes_to_match_id: null,
      winner_goes_to_match_id: null,
      winner_is_slot1: null,
    }
    losersMatches.push(match)

    // Link W-R1 losers to this match (two losers per L-R1 match)
    const wMatch1 = winnersR1Matches[i * 2]
    const wMatch2 = winnersR1Matches[i * 2 + 1]
    if (wMatch1) wMatch1.loser_goes_to_match_id = match.id
    if (wMatch2) wMatch2.loser_goes_to_match_id = match.id
  }
  currentLosersRound++

  // Now alternate: drop-in round, then consolidation round
  // For W-R2 through W-Finals
  for (let winnersRound = 2; winnersRound <= winnersRounds; winnersRound++) {
    const winnersRoundMatches = getWinnersRoundMatches(winnersRound)
    const prevLosersMatches = getLosersRoundMatches(currentLosersRound - 1)

    // DROP-IN ROUND: L-R(prev) winners face W-R(current) losers
    // Number of matches = number of winners round matches = number of prev losers winners
    for (let i = 0; i < winnersRoundMatches.length; i++) {
      const match: GeneratedMatch = {
        id: generateUUID(),
        round: currentLosersRound,
        match_number: i + 1,
        bracket_side: 'losers',
        participant1_id: null,
        participant2_id: null,
        winner_id: null,
        loser_goes_to_match_id: null,
        winner_goes_to_match_id: null,
        winner_is_slot1: null,
      }
      losersMatches.push(match)

      // Link W-R loser to slot 1 (drop-in from above)
      winnersRoundMatches[i].loser_goes_to_match_id = match.id

      // Link L-R(prev) winner to slot 2 (survivor from losers bracket)
      if (prevLosersMatches[i]) {
        prevLosersMatches[i].winner_goes_to_match_id = match.id
        prevLosersMatches[i].winner_is_slot1 = false // Survivor goes to slot 2
      }
    }
    currentLosersRound++

    // CONSOLIDATION ROUND (if more than 1 match in the drop-in round)
    const dropInMatches = getLosersRoundMatches(currentLosersRound - 1)

    if (dropInMatches.length > 1) {
      for (let i = 0; i < dropInMatches.length; i += 2) {
        const match: GeneratedMatch = {
          id: generateUUID(),
          round: currentLosersRound,
          match_number: Math.floor(i / 2) + 1,
          bracket_side: 'losers',
          participant1_id: null,
          participant2_id: null,
          winner_id: null,
          loser_goes_to_match_id: null,
          winner_goes_to_match_id: null,
          winner_is_slot1: null,
        }
        losersMatches.push(match)

        // Link drop-in round winners to this consolidation match
        dropInMatches[i].winner_goes_to_match_id = match.id
        dropInMatches[i].winner_is_slot1 = true
        if (dropInMatches[i + 1]) {
          dropInMatches[i + 1].winner_goes_to_match_id = match.id
          dropInMatches[i + 1].winner_is_slot1 = false
        }
      }
      currentLosersRound++
    }
  }

  // Grand Finals (match 1)
  // Winners bracket champion (slot 1) vs Losers bracket champion (slot 2)
  const grandFinals: GeneratedMatch = {
    id: generateUUID(),
    round: 1,
    match_number: 1,
    bracket_side: 'finals',
    participant1_id: null,
    participant2_id: null,
    winner_id: null,
    loser_goes_to_match_id: null,
    winner_goes_to_match_id: null,
    winner_is_slot1: null,
  }

  // Grand Finals Reset (match 2) - only played if losers bracket winner wins match 1
  // This gives the winners bracket champion their "second life"
  const grandFinalsReset: GeneratedMatch = {
    id: generateUUID(),
    round: 2,
    match_number: 1,
    bracket_side: 'finals',
    participant1_id: null,
    participant2_id: null,
    winner_id: null,
    loser_goes_to_match_id: null,
    winner_goes_to_match_id: null,
    winner_is_slot1: null,
  }

  // Link Grand Finals to Reset match
  // The winner of GF1 goes to GF2 (if reset is needed)
  grandFinals.winner_goes_to_match_id = grandFinalsReset.id
  grandFinals.winner_is_slot1 = true
  // The loser of GF1 also goes to GF2 (if reset is needed)
  grandFinals.loser_goes_to_match_id = grandFinalsReset.id

  // Link winners final to grand finals (slot 1 - winners bracket champion)
  const winnersFinal = matches.find(
    m => m.round === winnersRounds && m.bracket_side === 'winners'
  )
  if (winnersFinal) {
    winnersFinal.winner_goes_to_match_id = grandFinals.id
    winnersFinal.winner_is_slot1 = true
  }

  // Link losers final to grand finals (slot 2 - losers bracket champion)
  const losersFinal = losersMatches
    .filter(m => m.bracket_side === 'losers')
    .sort((a, b) => b.round - a.round)[0]
  if (losersFinal) {
    losersFinal.winner_goes_to_match_id = grandFinals.id
    losersFinal.winner_is_slot1 = false
  }

  const allMatches = [...matches, ...losersMatches, grandFinals, grandFinalsReset]

  // Propagate bye winners through both brackets
  propagateByeWinners(allMatches)

  return allMatches
}

// Generate bracket based on type
export function generateBracket(
  userIds: string[],
  bracketType: 'single' | 'double'
): { participants: GeneratedParticipant[]; matches: GeneratedMatch[] } {
  const participants = assignRandomSeeds(userIds)

  const matches = bracketType === 'single'
    ? generateSingleEliminationBracket(participants)
    : generateDoubleEliminationBracket(participants)

  return { participants, matches }
}
