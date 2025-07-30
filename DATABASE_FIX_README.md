# Database Fix for game_model Error

## Problem
The submarine gamemode is encountering a database error:
```
Error code: "42703"
Error message: "record "old" has no field "game_model""
```

This error occurs because there's a database trigger or function that's trying to access `OLD.game_model` during UPDATE operations on the `game_sessions` table, but the field doesn't exist.

## Root Cause
The issue is likely caused by:
1. A database trigger that was created with the wrong field name (`game_model` instead of `game_end_mode`)
2. A mismatch between the database schema and the application code
3. Missing database migrations

## Solution

### 1. Run the Database Migration
Execute the migration script to fix any problematic triggers:
```sql
-- Run this script in your Supabase SQL editor or database console
\i scripts/14-fix-game-model-trigger.sql
```

### 2. Verify Database Schema
Ensure the `game_sessions` table has the correct columns:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'game_sessions' 
ORDER BY ordinal_position;
```

Expected columns should include:
- `game_end_mode` (TEXT, NOT NULL, DEFAULT 'wait_timer')
- `total_time_minutes` (INTEGER, NULLABLE)
- `countdown_started_at` (TIMESTAMP WITH TIME ZONE, NULLABLE)

### 3. Check for Problematic Triggers
List all triggers on the game_sessions table:
```sql
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'game_sessions';
```

If any triggers reference `game_model`, they need to be fixed or removed.

## Code Changes Made

### 1. Updated TypeScript Types
Updated `lib/supabase.ts` to include the missing database fields:
- `game_end_mode`
- `total_time_minutes` 
- `countdown_started_at`

### 2. Fixed Update Operations
In `app/gamemode/submarine/host/room/[code]/page.tsx`:
- Uncommented `game_end_mode` field in update operations
- Added proper default value fallback
- Enhanced error handling for database schema issues

### 3. Improved Error Handling
Added specific error handling for the "42703" error code to provide better debugging information and user feedback.

## Testing
After applying the fix:
1. Try starting a submarine game
2. Check that the countdown starts without database errors
3. Verify that game sessions are created with the correct `game_end_mode` value

## Prevention
To prevent similar issues in the future:
1. Always run database migrations in the correct order
2. Keep TypeScript types in sync with database schema
3. Test database operations after schema changes
4. Use proper error handling for database operations