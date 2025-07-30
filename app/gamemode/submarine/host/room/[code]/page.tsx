"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Settings, Maximize, Minimize, Unlock, Volume2, VolumeX, ArrowLeft, Play, Copy, Check, AlertCircle, User, Globe, Lock, Clock } from "lucide-react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import QRCode from "react-qr-code"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { motion, useTransform, AnimatePresence, useMotionValue, useSpring } from "framer-motion"
import Link from "next/link"
import { use } from "react"
import { GamePageWithLoading } from "@/components/ui/page-with-loading"

export function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = () => {
    const elem = document.documentElement

    if (!document.fullscreenElement) {
      elem.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  return (
    <button onClick={toggleFullscreen} className="flex items-center">
      {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
    </button>
  )
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  creator_id: string;
  questions: Array<{
    id: string;
    question_text: string;
    time_limit: number;
    points: number;
  }>;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface GameSession {
  id: string;
  game_pin: string;
  status: string;
  total_time_minutes: number | null;
  countdown_started_at?: number | null;
  game_end_mode?: 'first_finish' | 'wait_timer';
  participants: Array<{
    id: string;
    nickname: string;
    joined_at: string;
    profiles?:
      | {
          avatar_url?: string | null;
        }
      | Array<{
          avatar_url?: string | null;
        }>;
  }>;
}

interface SupabaseQuizResponse {
  id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  creator_id: string;
  questions: Array<{
    id: string;
    question_text: string;
    time_limit: number;
    points: number;
  }>;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

function HostRoomPageContent({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTimeSetup, setShowTimeSetup] = useState(false);
  const [totalTimeMinutes, setTotalTimeMinutes] = useState<number>(10);
  const [gameEndMode, setGameEndMode] = useState<'first_finish' | 'wait_timer'>('wait_timer');
  const [isJoining, setIsJoining] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const springConfig = { stiffness: 100, damping: 5 };
  const x = useMotionValue(0);
  const rotate = useSpring(
    useTransform(x, [-100, 100], [-15, 15]),
    springConfig
  );
  const translateX = useSpring(
    useTransform(x, [-100, 100], [-20, 20]),
    springConfig
  );
  const [error, setError] = useState<{
    type:
      | "permission"
      | "not_found"
      | "no_questions"
      | "connection"
      | "unknown";
    message: string;
    details?: string;
  } | null>(null);
  const hasCreatedSession = useRef(false);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const countdownDuration = 10;
  const [hostParticipantId, setHostParticipantId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{
    username: string;
    avatar_url: string | null;
  } | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [showQRPopup, setShowQRPopup] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (user && !gameSession && !hasCreatedSession.current) {
      hasCreatedSession.current = true;
      fetchQuizAndCreateSession();
    }
  }, [user, gameSession]);

  useEffect(() => {
    if (!user) {
      router.push("/dashboard");
    }
    if (user) {
      fetchUserProfile();
    }
  }, [user, router]);

  useEffect(() => {
    if (gameSession) {
      fetchParticipants();

      const channel = supabase
        .channel(`game_${gameSession.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "game_participants",
            filter: `session_id=eq.${gameSession.id}`,
          },
          (payload) => {
            console.log("Participant change detected:", payload);
            fetchParticipants();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [gameSession]);

  useEffect(() => {
    if (gameSession?.countdown_started_at && gameSession.status === "active") {
      const interval = setInterval(() => {
        const now = new Date();
        const countdownStart = new Date(gameSession.countdown_started_at!);
        const remaining = Math.max(
          0,
          5 - Math.floor((now.getTime() - countdownStart.getTime()) / 1000)
        );

        setCountdownLeft(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
          setCountdownLeft(null);
          router.push(`/gamemode/submarine/host/game/${gameSession.id}`);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [gameSession, router]);

  useEffect(() => {
    if (
      gameSession?.countdown_started_at &&
      hostParticipantId &&
      gameSession.status === "waiting"
    ) {
      const startTime = new Date(gameSession.countdown_started_at).getTime();
      const now = Date.now();
      const diff = Math.ceil((startTime + 5000 - now) / 1000);

      if (diff <= 0) {
        router.push(
          `/gamemode/submarine/player/play?participant=${hostParticipantId}`
        );
      } else {
        setCountdownLeft(diff);
        const interval = setInterval(() => {
          setCountdownLeft((prev) => {
            if (prev && prev > 1) return prev - 1;

            clearInterval(interval);
            router.push(
              `/gamemode/submarine/player/play?participant=${hostParticipantId}`
            );
            return 0;
          });
        }, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [gameSession?.countdown_started_at, hostParticipantId]);

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      setUserProfile(data);
    } catch (error) {
      console.error("Error in fetchUserProfile:", error);
    }
  };

  const displayName = useMemo(() => {
    if (userProfile?.username) return userProfile.username;
    if (user && user.email) return user.email.split("@")[0];
    return "User";
  }, [userProfile, user]);

  const fetchQuizAndCreateSession = async () => {
    try {
      console.log("🔍 Fetching quiz with code:", resolvedParams.code);
      console.log("👤 Current user:", user?.id);

      if (gameSession) {
        console.log("⛔ Game session sudah ada, tidak membuat ulang.");
        return;
      }
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      if (!resolvedParams.code) {
        throw new Error("Quiz code is required");
      }

      const { data: testData, error: testError } = await supabase
        .from("quizzes")
        .select("id")
        .limit(1);

      if (testError) {
        console.error("❌ Supabase connection test failed:", testError);
        setError({
          type: "connection",
          message: "Tidak dapat terhubung ke database",
          details: testError.message,
        });
        return;
      }

      console.log("✅ Supabase connection test passed");

      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select(
          `
          id,
          title,
          description,
          is_public,
          creator_id,
          questions (
            id,
            question_text,
            time_limit,
            points
          ),
          profiles!quizzes_creator_id_fkey (
            username,
            avatar_url
          )
        `
        )
        .eq("code", resolvedParams.code)
        .single();

      console.log("📊 Quiz query result:", { quizData, quizError });

      if (quizError) {
        console.error("❌ Quiz fetch error:", quizError);
        if (quizError.code === "PGRST116") {
          setError({
            type: "not_found",
            message: "Quiz tidak ditemukan",
            details: "Quiz dengan kode tersebut tidak ada dalam database",
          });
        } else {
          setError({
            type: "unknown",
            message: "Gagal memuat quiz",
            details: quizError.message,
          });
        }
        return;
      }

      if (!quizData) {
        setError({
          type: "not_found",
          message: "Quiz tidak ditemukan",
          details: "Data quiz tidak tersedia",
        });
        return;
      }

      const quiz = quizData as unknown as SupabaseQuizResponse;

      console.log("🎯 Quiz details:", {
        id: quiz.id,
        title: quiz.title,
        creator_id: quiz.creator_id,
        is_public: quiz.is_public,
        current_user: user.id,
        is_creator: quiz.creator_id === user.id,
      });

      const isCreator = quiz.creator_id === user.id;
      const isPublic = quiz.is_public;

      if (!isCreator && !isPublic) {
        console.log("❌ Permission denied: Private quiz, not creator");
        setError({
          type: "permission",
          message: "Tidak dapat menghost quiz ini",
          details:
            "Quiz ini bersifat private dan hanya dapat dihost oleh pembuatnya",
        });
        return;
      }

      if (!quiz.questions || quiz.questions.length === 0) {
        setError({
          type: "no_questions",
          message: "Quiz tidak memiliki pertanyaan",
          details: "Tambahkan pertanyaan terlebih dahulu sebelum menghost quiz",
        });
        return;
      }

      console.log("✅ Permission check passed - User can host this quiz");

      const processedQuiz: Quiz = {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        is_public: quiz.is_public,
        creator_id: quiz.creator_id,
        questions: quiz.questions,
        profiles: {
          username: quiz.profiles.username,
          avatar_url: quiz.profiles.avatar_url || null,
        },
      };

      setQuiz(processedQuiz);

      console.log("🎮 Creating game session...");
      const gamePin = Math.floor(100000 + Math.random() * 900000).toString();

      const { data: session, error: createSessionError } = await supabase
        .from("game_sessions")
        .insert({
          quiz_id: resolvedParams.code,
          host_id: user.id,
          game_pin: gamePin,
          status: "waiting",
          total_time_minutes: null,
          game_end_mode: gameEndMode,
        })
        .select()
        .single();

      if (createSessionError) {
        console.error("❌ Session creation error:", createSessionError);
        throw createSessionError;
      }

      console.log("✅ Game session created:", session);

      setGameSession({
        id: session.id,
        game_pin: session.game_pin,
        status: session.status,
        total_time_minutes: session.total_time_minutes,
        game_end_mode: session.game_end_mode || gameEndMode,
        participants: [],
      });
    } catch (error) {
      console.error("💥 Error in fetchQuizAndCreateSession:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      if (!error || typeof error !== "object") {
        setError({
          type: "unknown",
          message: "Terjadi kesalahan tidak dikenal",
          details: errorMessage,
        });
      } else if (errorMessage.includes("not authenticated")) {
        setError({
          type: "permission",
          message: "Sesi login telah berakhir",
          details: "Silakan login ulang untuk melanjutkan",
        });
      } else if (errorMessage.includes("connection")) {
        setError({
          type: "connection",
          message: "Masalah koneksi database",
          details: "Periksa koneksi internet dan coba lagi",
        });
      } else {
        setError({
          type: "unknown",
          message: "Gagal menyiapkan game",
          details: errorMessage,
        });
      }
    }
  };

  const fetchParticipants = async () => {
    if (!gameSession) return;

    try {
      console.log("Fetching participants for session:", gameSession.id);

      const { data, error } = await supabase
        .from("game_participants")
        .select(
          `
          id, 
          nickname,
          joined_at,
          profiles (
          avatar_url
          )
          `
        )
        .eq("session_id", gameSession.id)
        .order("joined_at", { ascending: true });

      if (error) {
        console.error("Error fetching participants:", error);
        throw error;
      }

      console.log("Fetched participants:", data);

      setGameSession((prev) =>
        prev
          ? {
              ...prev,
              participants: data || [],
            }
          : null
      );
    } catch (error) {
      console.error("Error fetching participants:", error);
    }
  };

  const copyGamePin = async () => {
    if (!gameSession) return;

    try {
      await navigator.clipboard.writeText(gameSession.game_pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Game PIN copied!");
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy PIN");
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const halfWidth = rect.width / 2;
    x.set(event.clientX - rect.left - halfWidth);
  };

  const handleStartGame = () => {
    if (!gameSession || gameSession.participants.length === 0) return;
    setShowTimeSetup(true);
  };

  const startCountdownBeforeGame = async () => {
    if (!gameSession || !totalTimeMinutes) return;

    const countdownStartTime = new Date();
    const startedTime = new Date(
      countdownStartTime.getTime() + countdownDuration * 1000
    );

    const { error } = await supabase
      .from("game_sessions")
      .update({
        countdown_started_at: countdownStartTime.toISOString(),
        started_at: startedTime.toISOString(),
        status: "active",
        total_time_minutes: totalTimeMinutes,
      })
      .eq("id", gameSession.id);

    if (error) {
      console.error("Gagal menyimpan waktu countdown:", error);
      return;
    }

    setCountdownLeft(countdownDuration);
    let secondsLeft = countdownDuration;

    const interval = setInterval(() => {
      secondsLeft -= 1;
      setCountdownLeft(secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(interval);
        router.push(`/gamemode/submarine/host/game/${gameSession.id}`);
      }
    }, 1000);
  };

  const joinAsHostAndStartCountdown = async () => {
    if (!gameSession) return;

    setIsJoining(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!user) {
        setError({
          type: "unknown",
          message: "Gagal memuat quiz",
          details: "tidak ada user yang terautentikasi",
        });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (!profile) {
        setError({
          type: "unknown",
          message: "Gagal memuat quiz",
          details: "tidak ada profil yang ditemukan",
        });
        return;
      }

      const { data: existing } = await supabase
        .from("game_participants")
        .select("id")
        .eq("session_id", gameSession.id)
        .eq("nickname", profile.username)
        .maybeSingle();

      let participantId = existing?.id;

      if (!participantId) {
        const { data: newParticipant } = await supabase
          .from("game_participants")
          .insert({
            session_id: gameSession.id,
            user_id: user.id,
            nickname: profile.username,
          })
          .select()
          .single();

        participantId = newParticipant.id;
      }

      const countdownDuration = 10;
      const now = new Date();
      const startedTime = new Date(now.getTime() + countdownDuration * 1000);

      const { error: updateError } = await supabase
        .from("game_sessions")
        .update({
          countdown_started_at: now.toISOString(),
          started_at: startedTime.toISOString(),
          status: "active",
          total_time_minutes: totalTimeMinutes,
        })
        .eq("id", gameSession.id);

      if (updateError) {
        setError({
          type: "unknown",
          message: "Gagal memulai countdown",
          details: "Gagal menyimpan waktu mulai",
        });
        return;
      }

      setHostParticipantId(participantId);
      setCountdownLeft(countdownDuration);

      let secondsLeft = countdownDuration;
      const interval = setInterval(() => {
        secondsLeft -= 1;
        setCountdownLeft(secondsLeft);

        if (secondsLeft <= 0) {
          clearInterval(interval);
          router.push(
            `/gamemode/submarine/player/play?participant=${participantId}`
          );
        }
      }, 1000);
    } catch (err) {
      console.error(err);
      setError({
        type: "unknown",
        message: "Gagal memuat quiz",
        details: "Terjadi kesalahan saat bergabung sebagai host",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const startGame = async () => {
    if (!gameSession || gameSession.participants.length === 0) return;
    
    try {
      setShowCountdown(true);
      setCountdown(3);
      
      await supabase
        .from("game_sessions")
        .update({
          status: "active",
          game_end_mode: gameEndMode,
          total_time_minutes: totalTimeMinutes
        })
        .eq("id", gameSession.id);
        
      let counter = 3;
      const countdownInterval = setInterval(() => {
        counter -= 1;
        setCountdown(counter);
        
        if (counter === 0) {
          clearInterval(countdownInterval);
          router.push(`/gamemode/submarine/host/game/${gameSession.id}`);
        }
      }, 1000);
      
    } catch (error) {
      console.error("Error starting game:", error);
      toast.error("Failed to start game");
    }
  };

  const toggleMute = () => {
    setMuted((prev) => !prev);
    const audio = document.getElementById("bg-audio") as HTMLAudioElement;
    if (audio) {
      audio.muted = !audio.muted;
    }
  };

  const endSession = async () => {
    if (!gameSession) return;

    try {
      const { error } = await supabase
        .from("game_sessions")
        .update({
          status: "finished",
          ended_at: new Date().toISOString(),
        })
        .eq("id", gameSession.id);

      if (error) throw error;

      const { data: latestParticipants, error: participantsError } =
        await supabase
          .from("game_participants")
          .select("id, nickname")
          .eq("session_id", gameSession.id);

      if (participantsError) {
        console.error("Error fetching latest participants:", participantsError);
      } else if (latestParticipants && latestParticipants.length > 0) {
        console.log(
          `Calculating scores for ${latestParticipants.length} participants`
        );
        await Promise.all(
          latestParticipants.map(async (participant) => {
            try {
              await supabase.rpc("calculate_score", {
                session_id_input: gameSession.id,
                participant_id_input: participant.id,
              });
              console.log(`Score calculated for ${participant.nickname}`);
            } catch (err) {
              console.error(
                `Error calculating score for ${participant.nickname}:`,
                err
              );
            }
          })
        );
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("Error ending session:", error);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {error.message}
            </h2>
            <p className="text-gray-600 mb-4 text-sm">{error.details}</p>
          </div>

          <div className="space-y-3">
            {error.type === "permission" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-blue-800 mb-2">Solusi:</h3>
                <ul className="text-blue-700 text-sm space-y-1">
                  <li>
                    • Minta pembuat quiz untuk mengubah status menjadi public
                  </li>
                  <li>• Atau login dengan akun pembuat quiz</li>
                  <li>• Hubungi pembuat quiz untuk mendapatkan akses</li>
                </ul>
              </div>
            )}

            {error.type === "not_found" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-yellow-800 mb-2">
                  Kemungkinan penyebab:
                </h3>
                <ul className="text-yellow-700 text-sm space-y-1">
                  <li>• Quiz telah dihapus</li>
                  <li>• Link yang digunakan tidak valid</li>
                  <li>• Quiz belum dipublikasikan</li>
                </ul>
              </div>
            )}

            {error.type === "no_questions" && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-orange-800 mb-2">
                  Yang perlu dilakukan:
                </h3>
                <ul className="text-orange-700 text-sm space-y-1">
                  <li>• Buka halaman edit quiz</li>
                  <li>• Tambahkan minimal 1 pertanyaan</li>
                  <li>• Simpan perubahan</li>
                  <li>• Coba host ulang</li>
                </ul>
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                onClick={fetchQuizAndCreateSession}
                variant="outline"
                className="flex-1 bg-transparent border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Coba Lagi
              </Button>
              <Button
                onClick={() => router.push("/dashboard")}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                Kembali ke Dashboard
              </Button>
            </div>
          </div>

          {error.type === "connection" && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-left">
              <p className="font-semibold text-red-800">Tips Debugging:</p>
              <ul className="text-red-700 mt-1 space-y-1">
                <li>• Periksa koneksi internet</li>
                <li>• Refresh halaman</li>
                <li>• Coba beberapa saat lagi</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!quiz || !gameSession) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Quiz tidak ditemukan
          </h2>
          <Link href="/dashboard">
            <Button className="bg-purple-600 hover:bg-purple-700">
              Kembali ke Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isCreator = quiz.creator_id === user?.id;
  const formattedGamePin = gameSession?.game_pin?.replace(/(\d{3})(\d{3})/, "$1 $2") || "";

  return (
    <div className="min-h-screen overflow-hidden">
      <audio id="bg-audio" src="/lobby-submarine.mp3" autoPlay loop />

      {/* Countdown Overlay */}
      {showCountdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('/textures/background.webp')` }}
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
                {countdown}
              </div>
            </div>
            <p className="text-2xl text-white">Get ready...</p>
          </div>
        </div>
      )}

      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('/submarine-card.svg')` }}
      />

      {/* Main content */}
      <div className="relative z-20 min-h-screen flex flex-col">
        {/* Header with Game PIN */}
        <div className="flex justify-center items-start p-5 gap-4">
        <Card className="bg-transparent border-0">
          <CardContent className="p-1 rounded-xl text-center">
            <div className="flex gap-2">
              <div className="bg-white p-4 px-6 rounded-sm text-left">
                <h1 className="font-semibold">Game PIN:</h1>
                <h1
                  className="text-5xl font-black cursor-pointer hover:opacity-70 transition"
                  onClick={copyGamePin}
                >
                  {formattedGamePin}
                </h1>
                                  <p className="text-sm text-gray-600 mt-1">
                    {quiz.title} • {quiz.questions.length} questions
                  </p>
              </div>
              <div 
                className="bg-white p-1 rounded-sm cursor-pointer" 
                onClick={() => setShowQRPopup(true)}
              >
                <QRCode 
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/join?pin=${gameSession?.game_pin || ''}`} 
                  size={100} 
                />
              </div>
              
              {showQRPopup && gameSession && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="p-6 rounded-xl shadow-xl flex flex-col items-center gap-4">
                    <div className="bg-white p-4 px-6 rounded-sm text-left">
                      <h1 className="font-semibold">Game PIN:</h1>
                      <h1
                        className="text-7xl font-black cursor-pointer hover:opacity-70 transition"
                        onClick={copyGamePin}
                      >
                        {formattedGamePin}
                      </h1>
                    </div>
                    <div className="p-3 rounded-lg bg-white">
                      <QRCode 
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/join?pin=${gameSession.game_pin}`} 
                        size={325} 
                      />
                    </div>
                    <button
                      onClick={() => setShowQRPopup(false)}
                      className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

        {/* Main game area */}
        <div className="flex items-center justify-end mr-4 gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="bg-white/90 border-2 border-gray-300 hover:bg-white"
            onClick={endSession}
          >
            <Unlock className="w-5 h-5" />
          </Button>
          
          <Card className="bg-white/90 border-2 border-gray-300">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Total Time (minutes)</Label>
                <Input
                  type="number"
                  min="1"
                  max="60"
                  value={totalTimeMinutes}
                  onChange={(e) => setTotalTimeMinutes(Number(e.target.value))}
                  className="w-24"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Game End Mode</Label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="wait_timer"
                      name="gameEndMode"
                      checked={gameEndMode === 'wait_timer'}
                      onChange={() => setGameEndMode('wait_timer')}
                    />
                    <Label htmlFor="wait_timer" className="text-sm">Wait Timer</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="first_finish"
                      name="gameEndMode"
                      checked={gameEndMode === 'first_finish'}
                      onChange={() => setGameEndMode('first_finish')}
                    />
                    <Label htmlFor="first_finish" className="text-sm">First Finish</Label>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
          
          <Button
            onClick={startGame}
            disabled={participants.length === 0 || showCountdown}
            className="bg-white text-gray-800 hover:bg-gray-100 font-semibold py-3 text-lg border-2 border-gray-300 disabled:opacity-50"
          >
            {showCountdown ? "Starting..." : "Start"}
          </Button>
        </div>
        
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="relative w-full max-w-4xl">
            {/* Submarine */}
            <div className="flex">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4 mb-10">
                  {participants.slice(0, 4).map((player) => (
                    <div key={player.id} className="flex flex-col items-center">
                      <Avatar className="w-12 h-12 border-2 border-white shadow-lg">
                        <AvatarImage 
                          src={
                            player.profiles?.avatar_url || 
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.id}`
                          } 
                        />
                        <AvatarFallback className="bg-blue-500 text-white">
                          {player.nickname[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-white text-sm font-medium mt-1 bg-black/50 px-2 py-1 rounded">
                        {player.nickname}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Additional players grid */}
            {gameSession.participants.length === 0 && (
              <div className="flex justify-center">
                <p className="bg-blue-600 p-1 px-2 rounded-sm text-2xl font-medium text-white">
                  Waiting for participants
                </p>
              </div>
            )}
            
            {gameSession.participants.length > 4 && (
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 mt-8">
                {gameSession.participants.slice(4).map((player) => (
                  <div key={player.id} className="flex flex-col items-center">
                    <Avatar className="w-12 h-12 border-2 border-white shadow-lg">
                      <AvatarImage 
                        src={
                          player.profiles?.avatar_url || 
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.id}`
                        } 
                      />
                      <AvatarFallback className="bg-blue-500 text-white">
                        {player.nickname[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-white text-xs font-medium mt-1 bg-black/50 px-2 py-1 rounded truncate max-w-[80px]">
                      {player.nickname}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom info */}
        <div className="flex p-2 px-5 gap-2 text-white justify-end items-center">
          <div className="flex items-center gap-1 bg-black p-2 rounded-lg">
            <Users className="w-5 h-5" />
            <span className="font-semibold text-sm">{gameSession.participants.length}</span>
          </div>
          <div className="flex items-center gap-3 p-2 text-white bg-black backdrop-blur-sm rounded-lg">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="hover:text-white hover:bg-black cursor-pointer"
              asChild
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            <Settings className="w-5 h-5 text-white cursor-pointer" />
            <Button asChild>
              <FullscreenButton />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HostRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <GamePageWithLoading 
      animation="slide"
      customLoadingMessage="Memuat ruang submarine..."
    >
      <HostRoomPageContent params={params} />
    </GamePageWithLoading>
  );
}