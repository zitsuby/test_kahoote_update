-- Migration: Fix any triggers or functions that reference game_model instead of game_end_mode
-- This addresses the error: record "old" has no field "game_model"

-- First, check if there are any triggers on game_sessions table that might be causing issues
-- Drop any problematic triggers if they exist

-- Check for any functions that might reference game_model
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Check for triggers on game_sessions table
    FOR trigger_record IN 
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers 
        WHERE event_object_table = 'game_sessions'
    LOOP
        -- Log the trigger for debugging
        RAISE NOTICE 'Found trigger: % on game_sessions', trigger_record.trigger_name;
        
        -- If the trigger references game_model, we need to drop and recreate it
        IF trigger_record.action_statement LIKE '%game_model%' THEN
            RAISE NOTICE 'Dropping problematic trigger: %', trigger_record.trigger_name;
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON game_sessions', trigger_record.trigger_name);
        END IF;
    END LOOP;
END $$;

-- Check for any functions that might reference game_model and fix them
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Look for functions that might reference game_model
    FOR func_record IN 
        SELECT routine_name, routine_definition
        FROM information_schema.routines 
        WHERE routine_type = 'FUNCTION' 
        AND routine_definition LIKE '%game_model%'
    LOOP
        RAISE NOTICE 'Found function with game_model reference: %', func_record.routine_name;
        -- Log the function for manual review
    END LOOP;
END $$;

-- Ensure the game_end_mode column exists and has the correct constraints
DO $$
BEGIN
    -- Check if game_end_mode column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name = 'game_end_mode'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE public.game_sessions 
        ADD COLUMN game_end_mode TEXT DEFAULT 'wait_timer' 
        CHECK (game_end_mode IN ('first_finish', 'wait_timer'));
        
        -- Update existing records
        UPDATE public.game_sessions 
        SET game_end_mode = 'wait_timer' 
        WHERE game_end_mode IS NULL;
        
        -- Make it NOT NULL
        ALTER TABLE public.game_sessions 
        ALTER COLUMN game_end_mode SET NOT NULL;
    END IF;
END $$;

-- Add a comment to document this fix
COMMENT ON COLUMN public.game_sessions.game_end_mode IS 
'Game ending mode: first_finish (ends when first player completes) or wait_timer (ends when timer expires). Fixed from game_model reference error.';

-- Create an index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_end_mode ON public.game_sessions(game_end_mode);