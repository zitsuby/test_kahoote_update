# Submarine Game Mode Setup Guide

Panduan lengkap untuk mengaktifkan mode permainan submarine pada aplikasi quiz.

## 1. Database Migration

Jalankan script SQL berikut di Supabase SQL Editor untuk menambahkan fitur submarine game:

```sql
-- Submarine Game Enhancements
-- Add submarine-specific fields to support the game mechanics

-- Add submarine-specific fields to game_participants
ALTER TABLE public.game_participants
ADD COLUMN IF NOT EXISTS fire_charges INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hold_button_uses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS correct_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS wrong_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS submarine_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS shark_distance DECIMAL(5,2) DEFAULT 100.0;

-- Add submarine-specific fields to game_sessions
ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT 'classic',
ADD COLUMN IF NOT EXISTS shark_speed DECIMAL(5,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS submarine_progress DECIMAL(5,2) DEFAULT 0.0;

-- Create submarine game events table to track special events
CREATE TABLE IF NOT EXISTS public.submarine_game_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES public.game_participants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'fire_charge', 'hold_button', 'shark_attack', 'level_up'
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_submarine_events_session ON public.submarine_game_events(session_id);
CREATE INDEX IF NOT EXISTS idx_submarine_events_participant ON public.submarine_game_events(participant_id);
CREATE INDEX IF NOT EXISTS idx_submarine_events_type ON public.submarine_game_events(event_type);
```

## 2. Database Functions

Tambahkan fungsi-fungsi berikut untuk mengelola logika submarine game:

```sql
-- Function to update shark distance based on player performance
CREATE OR REPLACE FUNCTION update_shark_distance(
    p_participant_id UUID,
    p_correct_answer BOOLEAN
) RETURNS VOID AS $$
DECLARE
    current_distance DECIMAL(5,2);
    new_distance DECIMAL(5,2);
    current_streak INTEGER;
BEGIN
    -- Get current shark distance and streaks
    SELECT shark_distance, 
           CASE WHEN p_correct_answer THEN correct_streak ELSE wrong_streak END
    INTO current_distance, current_streak
    FROM game_participants 
    WHERE id = p_participant_id;
    
    IF p_correct_answer THEN
        -- Correct answer: increase distance (safer)
        new_distance := LEAST(100.0, current_distance + 5.0);
        
        -- Update correct streak, reset wrong streak
        UPDATE game_participants 
        SET shark_distance = new_distance,
            correct_streak = correct_streak + 1,
            wrong_streak = 0
        WHERE id = p_participant_id;
    ELSE
        -- Wrong answer: decrease distance (more dangerous)
        new_distance := GREATEST(0.0, current_distance - 10.0);
        
        -- Update wrong streak, reset correct streak
        UPDATE game_participants 
        SET shark_distance = new_distance,
            wrong_streak = wrong_streak + 1,
            correct_streak = 0
        WHERE id = p_participant_id;
        
        -- If shark distance is very low, trigger shark attack event
        IF new_distance <= 10.0 THEN
            INSERT INTO submarine_game_events (session_id, participant_id, event_type, event_data)
            SELECT session_id, p_participant_id, 'shark_attack', 
                   jsonb_build_object('distance', new_distance, 'streak', wrong_streak + 1)
            FROM game_participants 
            WHERE id = p_participant_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to add fire charge when player gets 3 correct answers
CREATE OR REPLACE FUNCTION add_fire_charge(
    p_participant_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    current_charges INTEGER;
    current_streak INTEGER;
    session_id_val UUID;
BEGIN
    -- Get current fire charges and correct streak
    SELECT fire_charges, correct_streak, session_id
    INTO current_charges, current_streak, session_id_val
    FROM game_participants 
    WHERE id = p_participant_id;
    
    -- Add fire charge if correct streak is multiple of 3
    IF current_streak > 0 AND current_streak % 3 = 0 THEN
        UPDATE game_participants 
        SET fire_charges = LEAST(3, fire_charges + 1)
        WHERE id = p_participant_id;
        
        -- Log fire charge event
        INSERT INTO submarine_game_events (session_id, participant_id, event_type, event_data)
        VALUES (session_id_val, p_participant_id, 'fire_charge', 
                jsonb_build_object('charges', LEAST(3, current_charges + 1), 'streak', current_streak));
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to use hold button
CREATE OR REPLACE FUNCTION use_hold_button(
    p_participant_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    current_charges INTEGER;
    session_id_val UUID;
BEGIN
    -- Get current fire charges
    SELECT fire_charges, session_id
    INTO current_charges, session_id_val
    FROM game_participants 
    WHERE id = p_participant_id;
    
    -- Can only use hold button if has fire charges
    IF current_charges >= 3 THEN
        UPDATE game_participants 
        SET fire_charges = 0,
            hold_button_uses = hold_button_uses + 1,
            shark_distance = LEAST(100.0, shark_distance + 20.0) -- Hold button pushes shark away
        WHERE id = p_participant_id;
        
        -- Log hold button event
        INSERT INTO submarine_game_events (session_id, participant_id, event_type, event_data)
        VALUES (session_id_val, p_participant_id, 'hold_button', 
                jsonb_build_object('uses', (SELECT hold_button_uses FROM game_participants WHERE id = p_participant_id)));
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

## 3. Row Level Security (RLS)

Tambahkan policies untuk keamanan:

```sql
-- Enable RLS for new table
ALTER TABLE public.submarine_game_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for submarine_game_events
CREATE POLICY "Users can view submarine events for their sessions" ON public.submarine_game_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM game_participants gp
            WHERE gp.session_id = submarine_game_events.session_id
            AND gp.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM game_sessions gs
            WHERE gs.id = submarine_game_events.session_id
            AND gs.host_id = auth.uid()
        )
    );

CREATE POLICY "System can insert submarine events" ON public.submarine_game_events
    FOR INSERT WITH CHECK (true);
```

## 4. Cara Menggunakan Submarine Game Mode

### Untuk Host:
1. Pilih quiz dari dashboard
2. Klik tombol "Host Room" 
3. URL akan otomatis mengarah ke mode submarine: `/gamemode/submarine/host/room/[quiz-id]`
4. Set game mode ke "submarine" saat membuat session
5. Tunggu pemain bergabung
6. Mulai permainan dan monitor progress pemain dengan animasi shark

### Untuk Player:
1. Bergabung melalui game PIN
2. Jawab pertanyaan untuk mendapatkan fire charges
3. Setiap 3 jawaban benar = 1 fire charge
4. Gunakan hold button saat memiliki 3 fire charges untuk menjauhkan shark
5. Shark akan mendekat jika jawaban salah terus menerus

## 5. Fitur Submarine Game

### Fire Charges System:
- Pemain mendapat 1 fire charge setiap 3 jawaban benar berturut-turut
- Maksimal 3 fire charges
- Fire charges digunakan untuk mengaktifkan hold button

### Hold Button Mechanic:
- Tersedia saat pemain memiliki 3 fire charges
- Tekan dan tahan untuk mengaktifkan
- Menjauhkan shark dan memberikan waktu aman

### Shark Animation:
- Shark bergerak menuju submarine berdasarkan rata-rata performa pemain
- Melambat saat hold button digunakan
- Mempercepat saat banyak jawaban salah
- Animasi smooth dengan frame yang berbeda berdasarkan jarak

### Real-time Features:
- Host melihat progress semua pemain secara real-time
- Animasi shark berubah berdasarkan performa gabungan
- Event tracking untuk semua aksi penting

## 6. Troubleshooting

### Jika Database Migration Gagal:
1. Pastikan memiliki akses admin ke Supabase
2. Jalankan script SQL secara manual di Supabase SQL Editor
3. Periksa log error untuk detail masalah

### Jika Game Tidak Berfungsi:
1. Periksa koneksi database
2. Pastikan semua fungsi database sudah dibuat
3. Cek console browser untuk error JavaScript
4. Verifikasi environment variables

### Jika Animasi Tidak Smooth:
1. Periksa performa browser
2. Pastikan asset gambar tersedia
3. Cek CSS animations

## 7. Asset Requirements

Pastikan file-file berikut tersedia di folder `/public`:
- `/fish-sprite.svg` - Sprite animasi shark
- `/submarine.svg` - Gambar submarine
- `/textures/background.webp` - Background underwater
- `/textures/texture-top.webp` - Texture atas
- `/textures/texture-bottom.webp` - Texture bawah
- `/first-wave-track.mp3` - Background music

## 8. Testing

Untuk menguji submarine game mode:
1. Buat quiz dengan beberapa pertanyaan
2. Host game dengan mode submarine
3. Bergabung sebagai player dari device lain
4. Test semua fitur: fire charges, hold button, shark animation
5. Verifikasi real-time updates berfungsi
6. Test game completion dan results

## 9. Performance Considerations

- Gunakan database indexes untuk query yang sering
- Limit real-time subscriptions untuk menghindari overload  
- Optimize animasi untuk performa yang baik
- Monitor penggunaan bandwidth untuk real-time features

## 10. Future Enhancements

Fitur yang bisa ditambahkan di masa depan:
- Multiple submarine levels dengan kesulitan berbeda
- Power-ups tambahan selain hold button
- Team-based submarine battles
- Leaderboard khusus submarine mode
- Achievement system untuk submarine game