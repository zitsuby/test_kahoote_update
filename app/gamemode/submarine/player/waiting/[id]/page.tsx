"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface GameSession {
  id: string;
  quiz_id: string;
  status: string;
  started_at: string | null;
  total_time_minutes: number | null;
  countdown_started_at?: string | null;
  game_pin: string;
  game_mode: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Array<{
    id: string;
    question_text: string;
    time_limit: number;
    points: number;
  }>;
}

interface Participant {
  id: string;
  nickname: string;
  score: number;
  profiles?: {
    avatar_url?: string | null;
  };
}

export default function PlayerWaitingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const sessionId = params.id as string;
  const participantId = searchParams.get("participant") || "";
  
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [isGameStarting, setIsGameStarting] = useState(false);
  const [countdown, setCountdown] = useState(3);
  
  const nickname = participants.find(p => p.id === participantId)?.nickname || "";
  const avatar = participants.find(p => p.id === participantId)?.profiles?.avatar_url || "";
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string>("");

  // Fetch game data
  const fetchGameData = async () => {
    try {
      // Fetch game session
      const { data: session, error: sessionError } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError || !session) {
        setError("Game session tidak ditemukan");
        return;
      }

      setGameSession(session);

      // Check if status changed to active
      if (session.status === "active" && lastStatusRef.current === "waiting") {
        setIsGameStarting(true);
      }

      lastStatusRef.current = session.status;

      // Fetch quiz data
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select(
          `
          id,
          title,
          description,
          questions (
            id,
            question_text,
            time_limit,
            points
          )
        `
        )
        .eq("id", session.quiz_id)
        .single();

      if (quizError || !quizData) {
        setError("Quiz tidak ditemukan");
        return;
      }

      setQuiz(quizData);

      // Fetch participants
      const { data: participantsData, error: participantsError } = await supabase
        .from("game_participants")
        .select("id, nickname, score, profiles(avatar_url)")
        .eq("session_id", sessionId);

      if (participantsError) {
        console.error("Participants error:", participantsError);
      } else {
        setParticipants(participantsData || []);
      }
    } catch (error) {
      console.error("Error fetching game data:", error);
      setError("Gagal memuat data game");
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (!participantId) {
      router.push("/join");
      return;
    }

    fetchGameData().finally(() => {
      setLoading(false);
      
      // Prefetch game page based on mode
      if (gameSession?.game_mode === "submarine") {
        router.prefetch(`/gamemode/submarine/player/game/${sessionId}?participant=${participantId}`);
      } else {
        router.prefetch(`/play-active/${sessionId}?participant=${participantId}`);
      }
    });
  }, [sessionId, participantId]);

  // Setup real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`play_game_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          fetchGameData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_participants",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchGameData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Handle countdown for game start
  useEffect(() => {
    if (
      gameSession?.status === "active" &&
      gameSession?.countdown_started_at
    ) {
      const startTime = new Date(gameSession.countdown_started_at).getTime();
      const now = Date.now();
      const timeLeft = Math.ceil((startTime + 5000 - now) / 1000);
      
      if (timeLeft > 0) {
        setCountdownLeft(timeLeft);
        
        const interval = setInterval(() => {
          setCountdownLeft(prev => {
            if (prev === null) return null;
            const newValue = prev - 1;
            
            if (newValue <= 0) {
              clearInterval(interval);
              return 0;
            }
            
            return newValue;
          });
        }, 1000);
        
        return () => clearInterval(interval);
      }
    }
  }, [gameSession]);

  // Handle game start countdown animation
  useEffect(() => {
    if (isGameStarting && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isGameStarting && countdown === 0) {
      // Redirect to game page
      const timer = setTimeout(() => {
        if (gameSession?.game_mode === "submarine") {
          router.push(`/gamemode/submarine/player/game/${sessionId}?participant=${participantId}`);
        } else {
          router.push(`/play-active/${sessionId}?participant=${participantId}`);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isGameStarting, countdown, sessionId, participantId, gameSession]);

  // Trigger countdown animation when countdownLeft reaches 0
  useEffect(() => {
    if (countdownLeft === 0 && !isGameStarting) {
      setIsGameStarting(true);
      setCountdown(3);
    }
  }, [countdownLeft]);

  const leaveGame = async () => {
    if (!participantId || !gameSession) return;

    try {
      await supabase
        .from("game_participants")
        .delete()
        .eq("id", participantId);

      router.push("/dashboard");
    } catch (error) {
      console.error("Error leaving game:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#105981] via-[#09799E] to-[#58B8CE] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold mb-2">Memuat Game...</h2>
          <p className="text-white/80">Mohon tunggu sebentar</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#105981] via-[#09799E] to-[#58B8CE] flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button
            onClick={() => router.push("/join")}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Kembali ke Join
          </Button>
        </div>
      </div>
    );
  }

  if (!gameSession || !quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#105981] via-[#09799E] to-[#58B8CE] flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Game tidak ditemukan
          </h2>
          <Button
            onClick={() => router.push("/join")}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Kembali ke Join
          </Button>
        </div>
      </div>
    );
  }

  // Render countdown animation if game is starting
  if (isGameStarting) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('/textures/background.webp')`,
          }}
        />

        <div
          className="absolute top-0 left-0 right-0 h-32 bg-repeat-x z-10"
          style={{
            backgroundImage: `url('/textures/texture-top.webp')`,
            backgroundSize: "auto 100%",
          }}
        />

        <div
          className="absolute bottom-0 left-0 right-0 h-32 bg-repeat-x z-10"
          style={{
            backgroundImage: `url('/textures/texture-bottom.webp')`,
            backgroundSize: "auto 100%",
          }}
        />

        <div className="relative z-20 text-center">
          <div
            className={`
              w-40 h-40 mx-auto flex items-center justify-center
              font-black text-8xl mb-6 transition-all duration-500 ease-in-out
              text-white shadow-2xl rounded-none
              ${countdown === 3 ? "rotate-[0deg] bg-blue-800" : ""}
              ${countdown === 2 ? "rotate-[45deg] bg-yellow-500" : ""}
              ${countdown === 1 ? "rotate-[90deg] bg-red-600" : ""}
              ${countdown === 0 ? "rotate-[125deg] bg-black" : ""}
            `}
          >
            <div
              className={`
                transition-all duration-500 ease-in-out
                ${countdown === 3 ? "rotate-[0deg]" : ""}
                ${countdown === 2 ? "rotate-[-45deg]" : ""}
                ${countdown === 1 ? "rotate-[-90deg]" : ""}
                ${countdown === 0 ? "rotate-[-125deg]" : ""}
              `}
            >
              {countdown > 0 ? (
                <div className="text-8xl font-bold text-white mb-4 animate-pulse text-center">
                  {countdown}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-white text-xl">Loading game...</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-2xl text-white">Game starting...</p>
        </div>
      </div>
    );
  }

  // Render waiting room
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('/textures/background.webp')`,
        }}
      />

      {/* Top texture overlay */}
      <div
        className="absolute top-0 left-0 right-0 h-32 bg-repeat-x z-10"
        style={{
          backgroundImage: `url('/textures/texture-top.webp')`,
          backgroundSize: "auto 100%",
        }}
      />

      {/* Bottom texture overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 bg-repeat-x z-10"
        style={{
          backgroundImage: `url('/textures/texture-bottom.webp')`,
          backgroundSize: "auto 100%",
        }}
      />

      {/* Main content */}
      <div className="relative z-20 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <div className="text-white font-bold">GQ</div>
            </div>
            <span className="text-xl font-bold text-white">GolekQuiz</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-black/30 px-3 py-1 rounded-full text-white flex items-center">
              <span className="mr-1">PIN:</span>
              <span className="font-bold">{gameSession.game_pin}</span>
            </div>
            
            <Button 
              variant="ghost" 
              className="text-white hover:bg-black/20"
              onClick={leaveGame}
            >
              <ArrowLeft className="w-5 h-5 mr-1" />
              Keluar
            </Button>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* Player Avatar and Info */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
              <Avatar className="w-32 h-32 border-4 border-white shadow-2xl">
                <AvatarImage src={avatar || "/placeholder.svg"} />
                <AvatarFallback className="bg-blue-500 text-white text-4xl">
                  {nickname[0]}
                </AvatarFallback>
              </Avatar>
            </div>

            <h1 className="text-4xl font-bold text-white mb-2">{nickname}</h1>
            <p className="text-xl text-white/80">You're in! See your nickname on screen?</p>
          </div>

          {/* Quiz Info */}
          <div className="bg-black/30 p-6 rounded-xl max-w-md w-full mb-8">
            <h2 className="text-2xl font-bold text-white text-center mb-2">
              {quiz.title}
            </h2>
            <div className="flex justify-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">
                  {quiz.questions.length}
                </div>
                <div className="text-white/80">Pertanyaan</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">
                  {participants.length}
                </div>
                <div className="text-white/80">Pemain</div>
              </div>
            </div>
          </div>

          {/* Countdown timer */}
          {countdownLeft !== null && countdownLeft > 0 && (
            <div className="mb-8">
              <div className="text-2xl font-bold text-white mb-2">
                Game dimulai dalam:
              </div>
              <div className="text-5xl font-bold text-yellow-400">
                {countdownLeft}
              </div>
            </div>
          )}

          {/* Participants grid */}
          <div className="w-full max-w-2xl">
            <h2 className="text-xl font-bold text-white mb-4 text-center">
              Pemain ({participants.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {participants.map((participant) => {
                const avatarUrl = participant.profiles?.avatar_url || "";
                return (
                  <div
                    key={participant.id}
                    className={`flex flex-col items-center p-3 rounded-lg ${
                      participant.id === participantId
                        ? "bg-blue-500/30 border-2 border-blue-400"
                        : "bg-black/30"
                    }`}
                  >
                    <Avatar className="w-16 h-16 mb-2">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="bg-blue-500 text-white">
                        {participant.nickname[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`text-white truncate max-w-full text-center ${
                        participant.id === participantId ? "font-bold" : ""
                      }`}
                    >
                      {participant.nickname}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Waiting indicator */}
          {countdownLeft === null && (
            <div className="mt-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="animate-spin w-8 h-8 border-4 border-white/30 border-t-white rounded-full"></div>
              </div>
              <p className="text-white/80">Menunggu game dimulai...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}