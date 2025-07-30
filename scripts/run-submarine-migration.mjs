import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables manually since we're using ES modules
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  for (const line of envLines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Running submarine game migration...');
    
    // Test connection first
    const { data: testData, error: testError } = await supabase
      .from('game_sessions')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('❌ Database connection failed:', testError);
      throw testError;
    }
    
    console.log('✅ Database connection successful');
    
    // Add columns to game_participants
    console.log('📝 Adding columns to game_participants...');
    
    try {
      // Check if columns already exist
      const { data, error } = await supabase
        .from('game_participants')
        .select('fire_charges')
        .limit(1);
      
      if (error && error.message.includes('column "fire_charges" does not exist')) {
        console.log('⏳ Adding submarine columns to game_participants...');
        
        // We'll need to use raw SQL via a stored procedure or direct database access
        // For now, let's create a simple approach
        console.log('⚠️  Manual database migration required');
        console.log('Please run the following SQL in your Supabase SQL editor:');
        console.log('');
        console.log('-- Add submarine columns to game_participants');
        console.log('ALTER TABLE public.game_participants');
        console.log('ADD COLUMN IF NOT EXISTS fire_charges INTEGER DEFAULT 0,');
        console.log('ADD COLUMN IF NOT EXISTS hold_button_uses INTEGER DEFAULT 0,');
        console.log('ADD COLUMN IF NOT EXISTS correct_streak INTEGER DEFAULT 0,');
        console.log('ADD COLUMN IF NOT EXISTS wrong_streak INTEGER DEFAULT 0,');
        console.log('ADD COLUMN IF NOT EXISTS submarine_level INTEGER DEFAULT 1,');
        console.log('ADD COLUMN IF NOT EXISTS shark_distance DECIMAL(5,2) DEFAULT 100.0;');
        console.log('');
        console.log('-- Add submarine columns to game_sessions');
        console.log('ALTER TABLE public.game_sessions');
        console.log('ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT \'classic\',');
        console.log('ADD COLUMN IF NOT EXISTS shark_speed DECIMAL(5,2) DEFAULT 1.0,');
        console.log('ADD COLUMN IF NOT EXISTS submarine_progress DECIMAL(5,2) DEFAULT 0.0;');
        console.log('');
        
        // Read and display the full SQL file
        const sqlPath = path.join(__dirname, '14-submarine-game-enhancements.sql');
        if (fs.existsSync(sqlPath)) {
          console.log('📄 Full SQL migration script:');
          console.log('');
          const sql = fs.readFileSync(sqlPath, 'utf8');
          console.log(sql);
        }
        
      } else {
        console.log('✅ Submarine columns already exist in game_participants');
      }
      
    } catch (error) {
      console.error('❌ Error checking/adding columns:', error);
    }
    
    console.log('🎉 Migration check completed!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run the SQL script manually in Supabase SQL editor');
    console.log('2. Test the submarine game mode');
    console.log('3. Verify all features are working correctly');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();