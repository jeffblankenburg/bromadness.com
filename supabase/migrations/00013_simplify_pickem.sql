-- Simplify Pick'em: Use games table directly instead of pickem_games

-- Add game_id to pickem_picks (references games directly)
ALTER TABLE public.pickem_picks
  ADD COLUMN game_id uuid REFERENCES public.games(id);

-- Migrate existing data (if any) - copy game_id from pickem_games
UPDATE public.pickem_picks pp
SET game_id = pg.game_id
FROM public.pickem_games pg
WHERE pp.pickem_game_id = pg.id;

-- Make pickem_game_id nullable (keep for backwards compatibility)
ALTER TABLE public.pickem_picks
  ALTER COLUMN pickem_game_id DROP NOT NULL;

-- Add index for game_id lookups
CREATE INDEX idx_pickem_picks_game_id ON public.pickem_picks(game_id);
