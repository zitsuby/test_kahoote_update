-- Submarine Game Scoring System
-- Custom scoring logic for submarine game mode

-- Function to calculate submarine-specific score
CREATE OR REPLACE FUNCTION calculate_submarine_score(
    p_session_id UUID,
    p_participant_id UUID
) RETURNS INTEGER AS $$
DECLARE
    base_score INTEGER := 0;
    bonus_score INTEGER := 0;
    penalty_score INTEGER := 0;
    final_score INTEGER := 0;
    
    -- Participant stats
    participant_data RECORD;
    
    -- Response stats
    correct_answers INTEGER := 0;
    total_answers INTEGER := 0;
    avg_response_time DECIMAL := 0;
    
    -- Submarine specific bonuses
    hold_button_bonus INTEGER := 0;
    survival_bonus INTEGER := 0;
    streak_bonus INTEGER := 0;
BEGIN
    -- Get participant submarine data
    SELECT fire_charges, hold_button_uses, correct_streak, wrong_streak, 
           shark_distance, submarine_level
    INTO participant_data
    FROM game_participants 
    WHERE id = p_participant_id AND session_id = p_session_id;
    
    -- Calculate base score from correct answers
    SELECT 
        COUNT(CASE WHEN a.is_correct THEN 1 END) as correct_count,
        COUNT(*) as total_count,
        AVG(CASE WHEN gr.response_time > 0 THEN gr.response_time ELSE NULL END) as avg_time
    INTO correct_answers, total_answers, avg_response_time
    FROM game_responses gr
    JOIN questions q ON gr.question_id = q.id
    JOIN answers a ON gr.answer_id = a.id
    WHERE gr.session_id = p_session_id 
    AND gr.participant_id = p_participant_id;
    
    -- Base score: points from correct answers
    SELECT COALESCE(SUM(CASE WHEN a.is_correct THEN q.points ELSE 0 END), 0)
    INTO base_score
    FROM game_responses gr
    JOIN questions q ON gr.question_id = q.id
    JOIN answers a ON gr.answer_id = a.id
    WHERE gr.session_id = p_session_id 
    AND gr.participant_id = p_participant_id;
    
    -- Submarine-specific bonuses
    
    -- Hold Button Bonus: 50 points per use
    hold_button_bonus := participant_data.hold_button_uses * 50;
    
    -- Survival Bonus: Based on final shark distance
    IF participant_data.shark_distance >= 80 THEN
        survival_bonus := 200; -- Excellent survival
    ELSIF participant_data.shark_distance >= 60 THEN
        survival_bonus := 150; -- Good survival
    ELSIF participant_data.shark_distance >= 40 THEN
        survival_bonus := 100; -- Fair survival
    ELSIF participant_data.shark_distance >= 20 THEN
        survival_bonus := 50;  -- Poor survival
    ELSE
        survival_bonus := 0;   -- Very poor survival
    END IF;
    
    -- Streak Bonus: Reward for maintaining correct streaks
    streak_bonus := participant_data.correct_streak * 10;
    
    -- Speed Bonus: Faster responses get more points
    IF avg_response_time > 0 AND avg_response_time < 5000 THEN -- Less than 5 seconds
        bonus_score := bonus_score + 100;
    ELSIF avg_response_time > 0 AND avg_response_time < 10000 THEN -- Less than 10 seconds
        bonus_score := bonus_score + 50;
    END IF;
    
    -- Accuracy Bonus: High accuracy gets bonus
    IF total_answers > 0 THEN
        DECLARE
            accuracy DECIMAL := (correct_answers::DECIMAL / total_answers::DECIMAL) * 100;
        BEGIN
            IF accuracy >= 90 THEN
                bonus_score := bonus_score + 150;
            ELSIF accuracy >= 80 THEN
                bonus_score := bonus_score + 100;
            ELSIF accuracy >= 70 THEN
                bonus_score := bonus_score + 50;
            END IF;
        END;
    END IF;
    
    -- Penalty for wrong streaks (submarine specific)
    IF participant_data.wrong_streak >= 5 THEN
        penalty_score := participant_data.wrong_streak * 10;
    END IF;
    
    -- Calculate final score
    final_score := base_score + hold_button_bonus + survival_bonus + streak_bonus + bonus_score - penalty_score;
    
    -- Ensure minimum score of 0
    final_score := GREATEST(0, final_score);
    
    -- Update participant score
    UPDATE game_participants 
    SET score = final_score
    WHERE id = p_participant_id AND session_id = p_session_id;
    
    -- Log scoring details
    INSERT INTO submarine_game_events (session_id, participant_id, event_type, event_data)
    VALUES (p_session_id, p_participant_id, 'score_calculation', 
            jsonb_build_object(
                'base_score', base_score,
                'hold_button_bonus', hold_button_bonus,
                'survival_bonus', survival_bonus,
                'streak_bonus', streak_bonus,
                'speed_bonus', CASE WHEN avg_response_time > 0 AND avg_response_time < 5000 THEN 100 
                                   WHEN avg_response_time > 0 AND avg_response_time < 10000 THEN 50 
                                   ELSE 0 END,
                'accuracy_bonus', bonus_score - CASE WHEN avg_response_time > 0 AND avg_response_time < 5000 THEN 100 
                                                    WHEN avg_response_time > 0 AND avg_response_time < 10000 THEN 50 
                                                    ELSE 0 END,
                'penalty', penalty_score,
                'final_score', final_score,
                'correct_answers', correct_answers,
                'total_answers', total_answers,
                'accuracy', CASE WHEN total_answers > 0 THEN (correct_answers::DECIMAL / total_answers::DECIMAL) * 100 ELSE 0 END,
                'avg_response_time', avg_response_time,
                'shark_distance', participant_data.shark_distance,
                'correct_streak', participant_data.correct_streak,
                'wrong_streak', participant_data.wrong_streak
            ));
    
    RETURN final_score;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate scores for all participants in a submarine game
CREATE OR REPLACE FUNCTION calculate_all_submarine_scores(
    p_session_id UUID
) RETURNS TABLE(participant_id UUID, nickname TEXT, final_score INTEGER) AS $$
BEGIN
    -- Check if this is a submarine game
    IF NOT EXISTS (
        SELECT 1 FROM game_sessions 
        WHERE id = p_session_id AND game_mode = 'submarine'
    ) THEN
        RAISE EXCEPTION 'This session is not a submarine game';
    END IF;
    
    -- Calculate scores for all participants
    RETURN QUERY
    SELECT 
        gp.id as participant_id,
        gp.nickname,
        calculate_submarine_score(p_session_id, gp.id) as final_score
    FROM game_participants gp
    WHERE gp.session_id = p_session_id
    ORDER BY final_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get submarine game leaderboard with detailed stats
CREATE OR REPLACE FUNCTION get_submarine_leaderboard(
    p_session_id UUID
) RETURNS TABLE(
    rank INTEGER,
    participant_id UUID,
    nickname TEXT,
    score INTEGER,
    fire_charges INTEGER,
    hold_button_uses INTEGER,
    shark_distance DECIMAL,
    correct_streak INTEGER,
    wrong_streak INTEGER,
    submarine_level INTEGER,
    correct_answers BIGINT,
    total_answers BIGINT,
    accuracy DECIMAL,
    avg_response_time DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH participant_stats AS (
        SELECT 
            gp.id,
            gp.nickname,
            gp.score,
            gp.fire_charges,
            gp.hold_button_uses,
            gp.shark_distance,
            gp.correct_streak,
            gp.wrong_streak,
            gp.submarine_level,
            COUNT(CASE WHEN a.is_correct THEN 1 END) as correct_count,
            COUNT(*) as total_count,
            AVG(CASE WHEN gr.response_time > 0 THEN gr.response_time ELSE NULL END) as avg_time
        FROM game_participants gp
        LEFT JOIN game_responses gr ON gp.id = gr.participant_id AND gp.session_id = gr.session_id
        LEFT JOIN questions q ON gr.question_id = q.id
        LEFT JOIN answers a ON gr.answer_id = a.id
        WHERE gp.session_id = p_session_id
        GROUP BY gp.id, gp.nickname, gp.score, gp.fire_charges, gp.hold_button_uses, 
                 gp.shark_distance, gp.correct_streak, gp.wrong_streak, gp.submarine_level
    )
    SELECT 
        ROW_NUMBER() OVER (ORDER BY ps.score DESC, ps.shark_distance DESC, ps.correct_streak DESC)::INTEGER as rank,
        ps.id as participant_id,
        ps.nickname,
        ps.score,
        ps.fire_charges,
        ps.hold_button_uses,
        ps.shark_distance,
        ps.correct_streak,
        ps.wrong_streak,
        ps.submarine_level,
        ps.correct_count as correct_answers,
        ps.total_count as total_answers,
        CASE WHEN ps.total_count > 0 THEN (ps.correct_count::DECIMAL / ps.total_count::DECIMAL) * 100 ELSE 0 END as accuracy,
        ps.avg_time as avg_response_time
    FROM participant_stats ps
    ORDER BY rank;
END;
$$ LANGUAGE plpgsql;

-- Function to get submarine game achievements
CREATE OR REPLACE FUNCTION get_submarine_achievements(
    p_session_id UUID,
    p_participant_id UUID
) RETURNS TABLE(
    achievement_name TEXT,
    achievement_description TEXT,
    achieved BOOLEAN,
    achievement_data JSONB
) AS $$
DECLARE
    participant_data RECORD;
    response_stats RECORD;
BEGIN
    -- Get participant data
    SELECT * INTO participant_data
    FROM game_participants 
    WHERE id = p_participant_id AND session_id = p_session_id;
    
    -- Get response statistics
    SELECT 
        COUNT(CASE WHEN a.is_correct THEN 1 END) as correct_answers,
        COUNT(*) as total_answers,
        MAX(CASE WHEN a.is_correct THEN 1 ELSE 0 END) as has_correct_answer
    INTO response_stats
    FROM game_responses gr
    JOIN answers a ON gr.answer_id = a.id
    WHERE gr.session_id = p_session_id AND gr.participant_id = p_participant_id;
    
    -- Return achievements
    RETURN QUERY VALUES
        ('Shark Survivor', 'Maintain shark distance above 80%', 
         participant_data.shark_distance >= 80.0,
         jsonb_build_object('shark_distance', participant_data.shark_distance)),
        
        ('Fire Master', 'Use hold button 3 or more times', 
         participant_data.hold_button_uses >= 3,
         jsonb_build_object('hold_button_uses', participant_data.hold_button_uses)),
        
        ('Streak Champion', 'Achieve 10+ correct answers in a row', 
         participant_data.correct_streak >= 10,
         jsonb_build_object('correct_streak', participant_data.correct_streak)),
        
        ('Perfect Score', 'Answer all questions correctly', 
         response_stats.total_answers > 0 AND response_stats.correct_answers = response_stats.total_answers,
         jsonb_build_object('accuracy', 100.0)),
        
        ('Submarine Captain', 'Reach submarine level 5 or higher', 
         participant_data.submarine_level >= 5,
         jsonb_build_object('submarine_level', participant_data.submarine_level)),
        
        ('Danger Zone Survivor', 'Survive with shark distance below 20%', 
         participant_data.shark_distance < 20.0 AND participant_data.shark_distance > 0,
         jsonb_build_object('shark_distance', participant_data.shark_distance));
END;
$$ LANGUAGE plpgsql;

-- Update the main calculate_score function to handle submarine mode
CREATE OR REPLACE FUNCTION calculate_score(
    session_id_input UUID,
    participant_id_input UUID
) RETURNS VOID AS $$
DECLARE
    game_mode_val TEXT;
BEGIN
    -- Check game mode
    SELECT game_mode INTO game_mode_val
    FROM game_sessions 
    WHERE id = session_id_input;
    
    -- Use submarine scoring for submarine games
    IF game_mode_val = 'submarine' THEN
        PERFORM calculate_submarine_score(session_id_input, participant_id_input);
    ELSE
        -- Use original scoring logic for classic games
        -- (Keep existing calculate_score logic here)
        UPDATE game_participants SET
            score = (
                SELECT COALESCE(SUM(points_earned), 0)
                FROM game_responses
                WHERE session_id = session_id_input
                AND participant_id = participant_id_input
            )
        WHERE id = participant_id_input;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION calculate_submarine_score(UUID, UUID) IS 'Calculate score for submarine game mode with bonuses and penalties';
COMMENT ON FUNCTION calculate_all_submarine_scores(UUID) IS 'Calculate scores for all participants in a submarine game session';
COMMENT ON FUNCTION get_submarine_leaderboard(UUID) IS 'Get detailed leaderboard for submarine game with stats';
COMMENT ON FUNCTION get_submarine_achievements(UUID, UUID) IS 'Get achievements for a participant in submarine game';