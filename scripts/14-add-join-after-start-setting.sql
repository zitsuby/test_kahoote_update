-- Migration: Add allow_join_after_start column to game_sessions table
-- This adds support for allowing players to join after the game has started

-- Add allow_join_after_start column to game_sessions table
ALTER TABLE public.game_sessions 
ADD COLUMN allow_join_after_start BOOLEAN DEFAULT false;

-- Add comment to document the column
COMMENT ON COLUMN public.game_sessions.allow_join_after_start IS 
'Whether players can join the game after it has started (true) or only before (false)';

-- Update existing sessions to have default value
UPDATE public.game_sessions 
SET allow_join_after_start = false 
WHERE allow_join_after_start IS NULL;

-- Make the column NOT NULL after setting default values
ALTER TABLE public.game_sessions 
ALTER COLUMN allow_join_after_start SET NOT NULL;

-- Create index for better query performance
CREATE INDEX idx_game_sessions_allow_join_after_start ON public.game_sessions(allow_join_after_start);