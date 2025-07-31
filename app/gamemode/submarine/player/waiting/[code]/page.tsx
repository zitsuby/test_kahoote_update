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

export default function PlayerWaitingCodePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const gameCode = params.code as string;
  const nickname = searchParams.get("nickname") || "";
  const avatar = searchParams.get("avatar") || "";
  
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string>("");
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [isGameStarting, setIsGameStarting] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string>("");

  // Join game function
  const joinGame = async () => {
    if (!nickname || !gameCode) {
      setError("Nickname dan kode game diperlukan");
      return;
    }

    try {
      // Find game session by PIN
      const { data: session, error: sessionError } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("game_pin", gameCode)
        .eq("status", "waiting")
        .single();

      if (sessionError || !session) {
        setError("Game tidak ditemukan atau sudah dimulai");
        return;
      }

      setGameSession(session);

      // Add participant
      const { data: participant, error: participantError } = await supabase
        .from("game_participants")
        .insert({
          session_id: session.id,
          nickname: nickname,
          score: 0,
        })
        .select()
        .single();

      if (participantError) {
        if (participantError.code === "23505") {
          setError("Nickname sudah digunakan dalam game ini");
        } else {
          setError("Gagal bergabung ke game");
        }
        return;
      }

      setParticipantId(participant.id);
      
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
      
    } catch (error) {
      console.error("Error joining game:", error);
      setError("Gagal bergabung ke game");
    }
  };

  // Fetch game data
  const fetchGameData = async () => {
    if (!gameSession) return;

    try {
      // Fetch updated session
      const { data: session, error: sessionError } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", gameSession.id)
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

      // Fetch participants
      const { data: participantsData, error: participantsError } = await supabase
        .from("game_participants")
        .select("id, nickname, score, profiles(avatar_url)")
        .eq("session_id", gameSession.id);

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

  // Initial setup
  useEffect(() => {
    if (!nickname || !gameCode) {
      router.push("/join");
      return;
    }

    joinGame().finally(() => {
      setLoading(false);
    });
  }, [gameCode, nickname]);

  // Setup real-time subscription
  useEffect(() => {
    if (!gameSession) return;

    const channel = supabase
      .channel(`play_game_${gameSession.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${gameSession.id}`,
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
          filter: `session_id=eq.${gameSession.id}`,
        },
        () => {
          fetchGameData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameSession]);

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
          router.push(`/gamemode/submarine/player/game/${gameSession.id}?participant=${participantId}`);
        } else {
          router.push(`/play-active/${gameSession.id}?participant=${participantId}`);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isGameStarting, countdown, gameSession, participantId]);

  // Trigger countdown animation when countdownLeft reaches 0
  useEffect(() => {
    if (countdownLeft === 0 && !isGameStarting) {
      setIsGameStarting(true);
      setCountdown(3);
    }
  }, [countdownLeft]);

  const leaveGame = async () => {
    if (!participantId || !gameSession) {
      router.push("/join");
      return;
    }

    try {
      await supabase
        .from("game_participants")
        .delete()
        .eq("id", participantId);

      router.push("/join");
    } catch (error) {
      console.error("Error leaving game:", error);
      router.push("/join");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#105981] via-[#09799E] to-[#58B8CE] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold mb-2">Bergabung ke Game...</h2>
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
              variant="destructive" 
              className="bg-red-600 hover:bg-red-700 text-white border-2 border-red-400 shadow-lg transition-all duration-200 hover:scale-105"
              onClick={leaveGame}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Keluar dari Sesi
            </Button>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* Player Avatar and Info */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-pulse"></div>
              <Avatar className="relative w-32 h-32 border-4 border-white shadow-2xl">
                <AvatarImage src={avatar || "/placeholder.svg"} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-4xl">
                  {nickname[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">{nickname}</h1>
            <div className="bg-gradient-to-r from-green-400 to-blue-500 text-white px-4 py-2 rounded-full inline-block">
              <p className="text-lg font-semibold">✅ Berhasil bergabung!</p>
            </div>
            <p className="text-lg text-white/90 mt-2">Lihat nama Anda di layar utama</p>
          </div>

          {/* Quiz Info */}
          <div className="bg-gradient-to-br from-black/40 to-black/20 backdrop-blur-md p-6 rounded-2xl max-w-md w-full mb-8 border border-white/20 shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-2xl mb-2">🎯</div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {quiz.title}
              </h2>
              <p className="text-white/70 text-sm">{quiz.description}</p>
            </div>
            <div className="flex justify-center gap-6">
              <div className="text-center bg-yellow-500/20 p-3 rounded-xl border border-yellow-400/30">
                <div className="text-3xl font-bold text-yellow-400 mb-1">
                  {quiz.questions.length}
                </div>
                <div className="text-white/90 text-sm font-medium">Pertanyaan</div>
              </div>
              <div className="text-center bg-green-500/20 p-3 rounded-xl border border-green-400/30">
                <div className="text-3xl font-bold text-green-400 mb-1">
                  {participants.length}
                </div>
                <div className="text-white/90 text-sm font-medium">Pemain</div>
              </div>
            </div>
          </div>

          {/* Countdown timer */}
          {countdownLeft !== null && countdownLeft > 0 && (
            <div className="mb-8 text-center">
              <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-md border border-red-400/30 rounded-2xl p-6 inline-block">
                <div className="text-xl font-bold text-white mb-3 flex items-center justify-center gap-2">
                  <span className="animate-pulse">⏰</span>
                  Game dimulai dalam:
                </div>
                <div className="relative">
                  <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500 animate-pulse">
                    {countdownLeft}
                  </div>
                  <div className="absolute inset-0 text-6xl font-bold text-yellow-400 animate-ping opacity-20">
                    {countdownLeft}
                  </div>
                </div>
                <div className="text-white/80 text-sm mt-2">detik</div>
              </div>
            </div>
          )}

          {/* Participants grid */}
          <div className="w-full max-w-3xl">
            <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-md border border-purple-400/30 rounded-2xl p-6 mb-6">
              <h2 className="text-2xl font-bold text-white mb-4 text-center flex items-center justify-center gap-2">
                <span>👥</span>
                Daftar Pemain ({participants.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {participants.map((participant) => {
                  const avatarUrl = participant.profiles?.avatar_url || "";
                  return (
                    <div
                      key={participant.id}
                      className={`flex flex-col items-center p-4 rounded-xl transition-all duration-200 hover:scale-105 ${
                        participant.id === participantId
                          ? "bg-gradient-to-br from-blue-500/40 to-purple-500/40 border-2 border-blue-400 shadow-lg"
                          : "bg-black/30 border border-white/20 hover:bg-black/40"
                      }`}
                    >
                      <div className="relative">
                        <Avatar className="w-16 h-16 mb-2 border-2 border-white/50">
                          <AvatarImage src={avatarUrl} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                            {participant.nickname[0]}
                          </AvatarFallback>
                        </Avatar>
                        {participant.id === participantId && (
                          <div className="absolute -top-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
                            <div className="text-white text-xs">✓</div>
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-white truncate max-w-full text-center text-sm ${
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
          </div>

          {/* Waiting indicator */}
          {countdownLeft === null && (
            <div className="mt-8 text-center">
              <div className="bg-gradient-to-r from-blue-500/20 to-green-500/20 backdrop-blur-md border border-blue-400/30 rounded-2xl p-6 inline-block">
                <div className="flex justify-center items-center gap-3 mb-4">
                  <div className="animate-spin w-6 h-6 border-3 border-white/30 border-t-white rounded-full"></div>
                  <div className="animate-bounce w-2 h-2 bg-white rounded-full"></div>
                  <div className="animate-bounce w-2 h-2 bg-white rounded-full" style={{animationDelay: '0.1s'}}></div>
                  <div className="animate-bounce w-2 h-2 bg-white rounded-full" style={{animationDelay: '0.2s'}}></div>
                </div>
                <p className="text-white font-semibold">Menunggu host memulai game...</p>
                <p className="text-white/70 text-sm mt-1">Pastikan Anda tetap di halaman ini</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
