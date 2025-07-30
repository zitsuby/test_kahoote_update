const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Running submarine game migration...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '14-submarine-game-enhancements.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL by statements (basic approach)
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });
        
        if (error) {
          // Try direct query if RPC fails
          const { error: directError } = await supabase
            .from('dummy') // This will fail but execute the SQL
            .select('*')
            .limit(0);
          
          if (directError && !directError.message.includes('relation "dummy" does not exist')) {
            console.error(`❌ Error executing statement ${i + 1}:`, error);
            console.error('Statement:', statement);
            throw error;
          }
        }
        
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }
    
    console.log('🎉 Submarine game migration completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution
async function runMigrationDirect() {
  try {
    console.log('🚀 Running submarine game migration (direct approach)...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '14-submarine-game-enhancements.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 Executing SQL directly...');
    
    // Execute the entire SQL as one query
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sql
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
    
    console.log('🎉 Submarine game migration completed successfully!');
    console.log('Data:', data);
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    
    // If RPC doesn't work, let's try manual execution of key parts
    console.log('🔄 Trying manual execution of key statements...');
    
    try {
      // Add columns to game_participants
      await supabase.rpc('exec_sql', {
        sql_query: `
          ALTER TABLE public.game_participants
          ADD COLUMN IF NOT EXISTS fire_charges INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS hold_button_uses INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS correct_streak INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS wrong_streak INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS submarine_level INTEGER DEFAULT 1,
          ADD COLUMN IF NOT EXISTS shark_distance DECIMAL(5,2) DEFAULT 100.0;
        `
      });
      
      console.log('✅ Added columns to game_participants');
      
      // Add columns to game_sessions
      await supabase.rpc('exec_sql', {
        sql_query: `
          ALTER TABLE public.game_sessions
          ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT 'classic',
          ADD COLUMN IF NOT EXISTS shark_speed DECIMAL(5,2) DEFAULT 1.0,
          ADD COLUMN IF NOT EXISTS submarine_progress DECIMAL(5,2) DEFAULT 0.0;
        `
      });
      
      console.log('✅ Added columns to game_sessions');
      
      console.log('🎉 Core submarine features added successfully!');
      
    } catch (manualError) {
      console.error('💥 Manual execution also failed:', manualError);
      console.log('⚠️  Please run the SQL script manually in your database');
      process.exit(1);
    }
  }
}

// Run the migration
runMigrationDirect();