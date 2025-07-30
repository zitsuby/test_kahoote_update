-- Fix missing columns in game_sessions table for submarine mode

-- Add countdown_started_at column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name = 'countdown_started_at'
    ) THEN
        ALTER TABLE public.game_sessions 
        ADD COLUMN countdown_started_at TIMESTAMP WITH TIME ZONE;
        
        COMMENT ON COLUMN public.game_sessions.countdown_started_at IS 
        'Timestamp when countdown before game started';
    END IF;
END $$;

-- Ensure started_at column exists (should already exist from previous migrations)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name = 'started_at'
    ) THEN
        ALTER TABLE public.game_sessions 
        ADD COLUMN started_at TIMESTAMP WITH TIME ZONE;
        
        COMMENT ON COLUMN public.game_sessions.started_at IS 
        'Timestamp when game actually started';
    END IF;
END $$;

-- Ensure ended_at column exists (should already exist from previous migrations)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name = 'ended_at'
    ) THEN
        ALTER TABLE public.game_sessions 
        ADD COLUMN ended_at TIMESTAMP WITH TIME ZONE;
        
        COMMENT ON COLUMN public.game_sessions.ended_at IS 
        'Timestamp when game ended';
    END IF;
END $$;

-- Ensure total_time_minutes column exists (should already exist from previous migrations)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name = 'total_time_minutes'
    ) THEN
        ALTER TABLE public.game_sessions 
        ADD COLUMN total_time_minutes INTEGER;
        
        COMMENT ON COLUMN public.game_sessions.total_time_minutes IS 
        'Total game duration in minutes';
    END IF;
END $$;

-- Ensure game_end_mode column exists (should already exist from previous migrations)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name = 'game_end_mode'
    ) THEN
        ALTER TABLE public.game_sessions 
        ADD COLUMN game_end_mode TEXT DEFAULT 'wait_timer';
        
        COMMENT ON COLUMN public.game_sessions.game_end_mode IS 
        'How the game ends: wait_timer or first_finish';
    END IF;
END $$;

-- Add submarine game mode columns if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name = 'game_mode'
    ) THEN
        ALTER TABLE public.game_sessions 
        ADD COLUMN game_mode TEXT DEFAULT 'classic';
        
        COMMENT ON COLUMN public.game_sessions.game_mode IS 
        'Game mode: classic or submarine';
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name = 'shark_speed'
    ) THEN
        ALTER TABLE public.game_sessions 
        ADD COLUMN shark_speed DECIMAL(5,2) DEFAULT 1.0;
        
        COMMENT ON COLUMN public.game_sessions.shark_speed IS 
        'Speed of shark animation in submarine mode';
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name = 'submarine_progress'
    ) THEN
        ALTER TABLE public.game_sessions 
        ADD COLUMN submarine_progress DECIMAL(5,2) DEFAULT 0.0;
        
        COMMENT ON COLUMN public.game_sessions.submarine_progress IS 
        'Overall submarine progress in submarine mode';
    END IF;
END $$;

-- Add submarine columns to game_participants if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_participants' 
        AND column_name = 'fire_charges'
    ) THEN
        ALTER TABLE public.game_participants 
        ADD COLUMN fire_charges INTEGER DEFAULT 0,
        ADD COLUMN hold_button_uses INTEGER DEFAULT 0,
        ADD COLUMN correct_streak INTEGER DEFAULT 0,
        ADD COLUMN wrong_streak INTEGER DEFAULT 0,
        ADD COLUMN submarine_level INTEGER DEFAULT 1,
        ADD COLUMN shark_distance DECIMAL(5,2) DEFAULT 100.0;
        
        -- Add comments
        COMMENT ON COLUMN public.game_participants.fire_charges IS 
        'Number of fire charges (0-3) for submarine game';
        COMMENT ON COLUMN public.game_participants.hold_button_uses IS 
        'Number of times hold button has been used';
        COMMENT ON COLUMN public.game_participants.correct_streak IS 
        'Current streak of correct answers';
        COMMENT ON COLUMN public.game_participants.wrong_streak IS 
        'Current streak of wrong answers';
        COMMENT ON COLUMN public.game_participants.submarine_level IS 
        'Current submarine level';
        COMMENT ON COLUMN public.game_participants.shark_distance IS 
        'Distance from shark (0-100, lower is more dangerous)';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_game_sessions_countdown ON public.game_sessions(countdown_started_at);
CREATE INDEX IF NOT EXISTS idx_game_sessions_mode ON public.game_sessions(game_mode);
CREATE INDEX IF NOT EXISTS idx_game_participants_submarine ON public.game_participants(fire_charges, shark_distance);

-- Verify the columns exist
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('game_sessions', 'game_participants')
AND column_name IN (
    'countdown_started_at', 'game_mode', 'shark_speed', 'submarine_progress',
    'fire_charges', 'hold_button_uses', 'correct_streak', 'wrong_streak', 
    'submarine_level', 'shark_distance'
)
ORDER BY table_name, column_name;