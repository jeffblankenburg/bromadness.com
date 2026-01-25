// Types for custom tournament brackets

export interface CustomBracket {
  id: string
  name: string
  created_by: string
  bracket_type: 'single' | 'double'
  status: 'active' | 'completed'
  winner_id: string | null
  created_at: string
  updated_at: string
}

export interface CustomBracketParticipant {
  id: string
  bracket_id: string
  user_id: string
  seed: number
  is_eliminated: boolean
  eliminated_at: string | null
  created_at: string
  // Joined from users table
  display_name?: string
}

export interface CustomBracketMatch {
  id: string
  bracket_id: string
  round: number
  match_number: number
  bracket_side: 'winners' | 'losers' | 'finals'
  participant1_id: string | null
  participant2_id: string | null
  winner_id: string | null
  loser_goes_to_match_id: string | null
  winner_goes_to_match_id: string | null
  winner_is_slot1: boolean | null
  created_at: string
  updated_at: string
}

export interface BracketWithDetails extends CustomBracket {
  participants: CustomBracketParticipant[]
  matches: CustomBracketMatch[]
  participant_count?: number
}
