"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { QRCodeSVG } from "qrcode.react";
import { ChatPanel } from "@/components/ui/chat-panel";
import {
  motion,
  useTransform,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "framer-motion";

import {
  ArrowLeft,
  Play,
  Users,
  Copy,
  Check,
  Slack,
  AlertCircle,
  User,
  Globe,
  Lock,
  Clock,
  ArrowBigLeft,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GamePageWithLoading } from "@/components/ui/page-with-loading";

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
  game_end_mode?: 'first_finish' | 'wait_timer'; // Game end setting
  allow_join_after_start?: boolean; // Allow players to join after game starts
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

function HostGamePageContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTimeSetup, setShowTimeSetup] = useState(false);
  const [totalTimeMinutes, setTotalTimeMinutes] = useState<number>(10);
  const [gameEndMode, setGameEndMode] = useState<'first_finish' | 'wait_timer'>('wait_timer'); // Game end mode state
  const [allowJoinAfterStart, setAllowJoinAfterStart] = useState<boolean>(false); // Allow join after start state
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
  const countdownDuration = 10; // 10 detik
  const [hostParticipantId, setHostParticipantId] = useState<string | null>(
    null
  );
  const [userProfile, setUserProfile] = useState<{
    username: string;
    avatar_url: string | null;
  } | null>(null);

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
          router.push(`/game/${gameSession.id}`);
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
      const diff = Math.ceil((startTime + 5000 - now) / 1000); // 5 detik countdown

      if (diff <= 0) {
        router.push(
          `/play-active/${resolvedParams.id}?participant=${hostParticipantId}`
        );
      } else {
        setCountdownLeft(diff);
        const interval = setInterval(() => {
          setCountdownLeft((prev) => {
            if (prev && prev > 1) return prev - 1;

            clearInterval(interval);
            router.push(
              `/play-active/${resolvedParams.id}?participant=${hostParticipantId}`
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
      console.log("🔍 Fetching quiz with ID:", resolvedParams.id);
      console.log("👤 Current user:", user?.id);

      if (gameSession) {
        console.log("⛔ Game session sudah ada, tidak membuat ulang.");
        return;
      }
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      if (!resolvedParams.id) {
        throw new Error("Quiz ID is required");
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
        .eq("id", resolvedParams.id)
        .single();

      console.log("📊 Quiz query result:", { quizData, quizError });

      if (quizError) {
        console.error("❌ Quiz fetch error:", quizError);
        if (quizError.code === "PGRST116") {
          setError({
            type: "not_found",
            message: "Quiz tidak ditemukan",
            details: "Quiz dengan ID tersebut tidak ada dalam database",
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
          quiz_id: resolvedParams.id,
          host_id: user.id,
          game_pin: gamePin,
          status: "waiting",
          total_time_minutes: null,
          game_end_mode: gameEndMode, // Add game end mode to session creation
          allow_join_after_start: allowJoinAfterStart, // Add allow join after start setting
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
        game_end_mode: session.game_end_mode || gameEndMode, // Add game end mode to state
        allow_join_after_start: session.allow_join_after_start || allowJoinAfterStart, // Add allow join after start to state
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
    } finally {
      // setLoading(false);
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
    } catch (error) {
      console.error("Failed to copy:", error);
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

    const countdownStartTime = new Date(); // Waktu countdown dimulai
    const startedTime = new Date(
      countdownStartTime.getTime() + countdownDuration * 1000
    );

    // 1. Simpan ke Supabase terlebih dahulu
    const { error } = await supabase
      .from("game_sessions")
      .update({
        countdown_started_at: countdownStartTime.toISOString(),
        started_at: startedTime.toISOString(),
        status: "active",
        total_time_minutes: totalTimeMinutes,
        game_end_mode: gameEndMode, // Update game end mode
        allow_join_after_start: allowJoinAfterStart, // Update allow join after start setting
      })
      .eq("id", gameSession.id);

    if (error) {
      console.error("Gagal menyimpan waktu countdown:", error);
      return;
    }

    // 2. Jalankan countdown lokal di host untuk ditampilkan
    setCountdownLeft(countdownDuration);
    let secondsLeft = countdownDuration;

    const interval = setInterval(() => {
      secondsLeft -= 1;
      setCountdownLeft(secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(interval);

        // 3. Setelah countdown selesai, redirect ke halaman pengerjaan
        router.push(`/game/${gameSession.id}`);
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

      // Insert participant jika belum
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

      // === START COUNTDOWN ===
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
      setCountdownLeft(countdownDuration); // untuk ditampilkan di UI

      let secondsLeft = countdownDuration;
      const interval = setInterval(() => {
        secondsLeft -= 1;
        setCountdownLeft(secondsLeft);

        if (secondsLeft <= 0) {
          clearInterval(interval);
          router.push(
            `/play-active/${gameSession.id}?participant=${participantId}`
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

  const endSession = async () => {
    if (!gameSession) return;

    try {
      // Update status game menjadi finished
      const { error } = await supabase
        .from("game_sessions")
        .update({
          status: "finished",
          ended_at: new Date().toISOString(),
        })
        .eq("id", gameSession.id);

      if (error) throw error;

      // Ambil data peserta terbaru
      const { data: latestParticipants, error: participantsError } =
        await supabase
          .from("game_participants")
          .select("id, nickname")
          .eq("session_id", gameSession.id);

      if (participantsError) {
        console.error("Error fetching latest participants:", participantsError);
      } else if (latestParticipants && latestParticipants.length > 0) {
        // Hitung skor untuk semua peserta
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

  // if (loading) {
  //   return (
  //     <div className="min-h-screen bg-gray-50 flex items-center justify-center">
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
  //         <p>Menyiapkan game...</p>
  //       </div>
  //     </div>
  //   );
  // }

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

  return (
    <div className="min-h-screen bg-white text-gray-900 relative">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 md:px-6 lg:px-8 border-b">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Play className="h-6 w-6 text-purple-600" />
          <span>GolekQuiz</span>
        </div>
        <Button
          onClick={endSession}
          variant="outline"
          className="border-gray-300 text-gray-700 hover:bg-gray-100 bg-transparent"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back & end session
        </Button>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Quiz Info Card */}
          <Card className="bg-white shadow-lg rounded-xl p-6">
            <CardHeader className="pb-4 px-0 pt-0">
              <CardTitle className="text-xl font-semibold">
                {quiz.title}
              </CardTitle>
              {quiz.description && (
                <p className="text-gray-600 text-sm">{quiz.description}</p>
              )}
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">
                    {quiz.questions.length}
                  </div>
                  <div className="text-sm text-gray-600">Pertanyaan</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">
                    {gameSession.participants.length}
                  </div>
                  <div className="text-sm text-gray-600">Pemain</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600 pt-4 border-t">
                <div className="flex items-center gap-1">
                  <Avatar className="h-8 w-8 bg-white border-2 border-white">
                    <AvatarImage
                      src={
                        quiz.profiles.avatar_url ||
                        (user?.email
                          ? `https://robohash.org/${encodeURIComponent(
                              user.email
                            )}.png`
                          : "/default-avatar.png") // fallback lokal
                      }
                      alt={user?.email || ""}
                      className="object-cover w-full h-full"
                    />
                    <AvatarFallback className="bg-white text-purple-600">
                      {displayName?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span>Maker {quiz.profiles.username}</span>
                </div>
                <div className="flex gap-2">
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      quiz.is_public
                        ? "bg-green-100 text-green-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {quiz.is_public ? "Public" : "Private"}
                  </div>

                  {isCreator && (
                    <div className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                      Quiz Anda
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Game Settings Card */}
          <Card className="bg-white shadow-lg rounded-xl p-6">
            <CardHeader className="pb-4 px-0 pt-0 flex flex-row items-center gap-2">
              <Slack className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-xl font-semibold">
                Game Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Time Settings Icon */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative group cursor-pointer"
                >
                  <motion.div 
                    className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-4 transition-all duration-300 group-hover:border-purple-300 group-hover:shadow-lg"
                    whileHover={{ 
                      boxShadow: "0 10px 25px -5px rgba(147, 51, 234, 0.1), 0 10px 10px -5px rgba(147, 51, 234, 0.04)"
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <motion.div 
                        className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center"
                        whileHover={{ 
                          scale: 1.1,
                          rotate: 5
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        <Clock className="w-5 h-5 text-white" />
                      </motion.div>
                      <motion.div 
                        className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded-full"
                        animate={{ 
                          scale: [1, 1.05, 1],
                          opacity: [1, 0.8, 1]
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        ⏱️ {totalTimeMinutes}m
                      </motion.div>
                    </div>
                    <h3 className="font-semibold text-gray-800 mb-2">Time Limit</h3>
                    <p className="text-xs text-gray-600 mb-3">Set total quiz duration</p>
                    <motion.div
                      whileFocus={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Input
                        type="number"
                        min="1"
                        max="120"
                        value={totalTimeMinutes}
                        onChange={(e) =>
                          setTotalTimeMinutes(
                            Number.parseInt(e.target.value) || 1
                          )
                        }
                        className="w-full text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                      />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Game End Mode Icon */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative group cursor-pointer"
                >
                  <motion.div 
                    className={`border-2 rounded-xl p-4 transition-all duration-300 group-hover:shadow-lg ${
                      gameEndMode === 'wait_timer' 
                        ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 group-hover:border-blue-300' 
                        : 'bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200 group-hover:border-orange-300'
                    }`}
                    whileHover={{ 
                      boxShadow: gameEndMode === 'wait_timer' 
                        ? "0 10px 25px -5px rgba(59, 130, 246, 0.1), 0 10px 10px -5px rgba(59, 130, 246, 0.04)"
                        : "0 10px 25px -5px rgba(249, 115, 22, 0.1), 0 10px 10px -5px rgba(249, 115, 22, 0.04)"
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <motion.div 
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          gameEndMode === 'wait_timer' 
                            ? 'bg-gradient-to-br from-blue-500 to-cyan-600' 
                            : 'bg-gradient-to-br from-orange-500 to-yellow-600'
                        }`}
                        whileHover={{ 
                          scale: 1.1,
                          rotate: gameEndMode === 'wait_timer' ? 5 : -5
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        {gameEndMode === 'wait_timer' ? (
                          <Clock className="w-5 h-5 text-white" />
                        ) : (
                          <Trophy className="w-5 h-5 text-white" />
                        )}
                      </motion.div>
                      <motion.div 
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          gameEndMode === 'wait_timer' 
                            ? 'text-blue-700 bg-blue-100' 
                            : 'text-orange-700 bg-orange-100'
                        }`}
                        animate={{ 
                          scale: [1, 1.05, 1],
                          opacity: [1, 0.8, 1]
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        {gameEndMode === 'wait_timer' ? '⏰ Timer' : '🏆 First'}
                      </motion.div>
                    </div>
                    <h3 className="font-semibold text-gray-800 mb-2">End Mode</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      {gameEndMode === 'wait_timer' 
                        ? 'Wait for timer to finish' 
                        : 'End when first player finishes'
                      }
                    </p>
                    <div className="space-y-2">
                      <motion.div 
                        className="flex items-center space-x-2 cursor-pointer"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <input
                          type="radio"
                          id="wait_timer"
                          name="gameEndMode"
                          value="wait_timer"
                          checked={gameEndMode === 'wait_timer'}
                          onChange={(e) => setGameEndMode(e.target.value as 'first_finish' | 'wait_timer')}
                          className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <label htmlFor="wait_timer" className="text-xs text-gray-700 cursor-pointer">
                          Wait Timer
                        </label>
                      </motion.div>
                      <motion.div 
                        className="flex items-center space-x-2 cursor-pointer"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <input
                          type="radio"
                          id="first_finish"
                          name="gameEndMode"
                          value="first_finish"
                          checked={gameEndMode === 'first_finish'}
                          onChange={(e) => setGameEndMode(e.target.value as 'first_finish' | 'wait_timer')}
                          className="w-3 h-3 text-orange-600 border-gray-300 focus:ring-orange-500"
                        />
                        <label htmlFor="first_finish" className="text-xs text-gray-700 cursor-pointer">
                          First Finish
                        </label>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>

                {/* Join Settings Icon */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative group cursor-pointer"
                >
                  <motion.div 
                    className={`border-2 rounded-xl p-4 transition-all duration-300 group-hover:shadow-lg ${
                      allowJoinAfterStart 
                        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 group-hover:border-green-300' 
                        : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200 group-hover:border-red-300'
                    }`}
                    whileHover={{ 
                      boxShadow: allowJoinAfterStart 
                        ? "0 10px 25px -5px rgba(34, 197, 94, 0.1), 0 10px 10px -5px rgba(34, 197, 94, 0.04)"
                        : "0 10px 25px -5px rgba(239, 68, 68, 0.1), 0 10px 10px -5px rgba(239, 68, 68, 0.04)"
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <motion.div 
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          allowJoinAfterStart 
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                            : 'bg-gradient-to-br from-red-500 to-pink-600'
                        }`}
                        whileHover={{ 
                          scale: 1.1,
                          rotate: allowJoinAfterStart ? 5 : -5
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        {allowJoinAfterStart ? (
                          <Users className="w-5 h-5 text-white" />
                        ) : (
                          <Lock className="w-5 h-5 text-white" />
                        )}
                      </motion.div>
                      <motion.div 
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          allowJoinAfterStart 
                            ? 'text-green-700 bg-green-100' 
                            : 'text-red-700 bg-red-100'
                        }`}
                        animate={{ 
                          scale: [1, 1.05, 1],
                          opacity: [1, 0.8, 1]
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        {allowJoinAfterStart ? '✓ Allow' : '✗ Block'}
                      </motion.div>
                    </div>
                    <h3 className="font-semibold text-gray-800 mb-2">Join After Start</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      {allowJoinAfterStart 
                        ? 'Players can join after game starts' 
                        : 'Players can only join before game starts'
                      }
                    </p>
                    <motion.div 
                      className="flex items-center space-x-2 cursor-pointer"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <input
                        type="checkbox"
                        id="allowJoinAfterStart"
                        checked={allowJoinAfterStart}
                        onChange={(e) => setAllowJoinAfterStart(e.target.checked)}
                        className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500 rounded"
                      />
                      <label htmlFor="allowJoinAfterStart" className="text-xs text-gray-700 cursor-pointer">
                        Allow late join
                      </label>
                    </motion.div>
                  </div>
                </motion.div>
              </div>
            </CardContent>
          </Card>

          {/* Game Control Card */}
          <Card className="bg-white shadow-lg rounded-xl p-6">
            {/* Countdown sedang berlangsung */}
            {countdownLeft !== null && countdownLeft > 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <CardContent className="p-8 text-center">
                  <motion.div 
                    className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 1,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Clock className="w-10 h-10 text-white" />
                  </motion.div>
                  <motion.h2 
                    className="text-4xl font-bold text-purple-700 mb-2"
                    animate={{ 
                      scale: [1, 1.2, 1],
                      color: ["#7c3aed", "#3b82f6", "#7c3aed"]
                    }}
                    transition={{ 
                      duration: 0.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    {countdownLeft}
                  </motion.h2>
                  <p className="text-gray-600 text-lg">detik lagi...</p>
                  <p className="text-sm text-gray-500 mt-2">Bersiaplah untuk mulai!</p>
                </CardContent>
              </motion.div>
            ) : (
              <>
                <CardHeader className="pb-4 px-0 pt-0 flex flex-row items-center gap-2">
                  <motion.div 
                    className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center"
                    whileHover={{ 
                      scale: 1.1,
                      rotate: 5
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <Play className="w-4 h-4 text-white" />
                  </motion.div>
                  <CardTitle className="text-xl font-semibold">
                    Game Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        onClick={startCountdownBeforeGame}
                        className="w-full h-16 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                        disabled={
                          gameSession.participants.length === 0 ||
                          !totalTimeMinutes ||
                          totalTimeMinutes < 1
                        }
                      >
                        <Play className="w-6 h-6 mr-3" />
                        Mulai Game
                      </Button>
                    </motion.div>
                    
                    {gameSession?.status === "waiting" &&
                      !gameSession?.countdown_started_at && (
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            onClick={joinAsHostAndStartCountdown}
                            disabled={isJoining}
                            className="w-full h-16 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            {isJoining ? (
                              <div className="flex items-center">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                                Memulai...
                              </div>
                            ) : (
                              <>
                                <User className="w-6 h-6 mr-3" />
                                Ikut sebagai Host
                              </>
                            )}
                          </Button>
                        </motion.div>
                      )}
                  </div>
                  
                  {/* Game Status Preview */}
                  <motion.div 
                    className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Game Status</span>
                      <motion.div 
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          gameSession?.status === "waiting" 
                            ? "bg-yellow-100 text-yellow-700" 
                            : "bg-green-100 text-green-700"
                        }`}
                        animate={{ 
                          scale: [1, 1.05, 1],
                          opacity: [1, 0.8, 1]
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        {gameSession?.status === "waiting" ? "Waiting" : "Active"}
                      </motion.div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <motion.div 
                        className="flex items-center justify-between"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.3 }}
                      >
                        <span className="text-gray-600">Players:</span>
                        <span className="font-semibold text-gray-800">{gameSession.participants.length}</span>
                      </motion.div>
                      <motion.div 
                        className="flex items-center justify-between"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.4 }}
                      >
                        <span className="text-gray-600">Time:</span>
                        <span className="font-semibold text-gray-800">{totalTimeMinutes}m</span>
                      </motion.div>
                      <motion.div 
                        className="flex items-center justify-between"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.5 }}
                      >
                        <span className="text-gray-600">Mode:</span>
                        <span className="font-semibold text-gray-800">
                          {gameEndMode === 'wait_timer' ? 'Timer' : 'First'}
                        </span>
                      </motion.div>
                      <motion.div 
                        className="flex items-center justify-between"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.6 }}
                      >
                        <span className="text-gray-600">Late Join:</span>
                        <span className={`font-semibold ${allowJoinAfterStart ? 'text-green-600' : 'text-red-600'}`}>
                          {allowJoinAfterStart ? 'Yes' : 'No'}
                        </span>
                      </motion.div>
                    </div>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Game PIN Card */}
          <Card className="bg-white shadow-lg rounded-xl p-6 text-center">
            <CardHeader className="pb-4 px-0 pt-0">
              <CardTitle className="text-xl font-semibold">Game PIN</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 space-y-6">
              <div className="flex items-center justify-center gap-3">
                <div className="text-6xl font-extrabold text-purple-600 left-[30px] relative">
                  {gameSession.game_pin}
                </div>
                <div className="relative inline-block left-[30px]">
                  <Button
                    onClick={copyGamePin}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onMouseMove={handleMouseMove}
                    variant="ghost"
                    size="icon"
                    className="text-purple-600 hover:bg-purple-50 relative bg-transparent border-2 "
                  >
                    {copied ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </Button>
                  <AnimatePresence mode="wait">
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.8 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          transition: {
                            type: "spring",
                            stiffness: 260,
                            damping: 15,
                          },
                        }}
                        exit={{ opacity: 0, y: 10, scale: 0.8 }}
                        style={{
                          translateX: translateX,
                          rotate: rotate,
                        }}
                        className="absolute -top-12 left-[-22px] z-50 flex -translate-x-1/2 flex-col items-center justify-center rounded-md bg-black px-3 py-1.5 text-xs shadow-xl min-w-[80px]"
                      >
                        <div className="absolute inset-x-10 -bottom-px z-30 h-px w-[20%] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                        <div className="absolute -bottom-px left-10 z-30 h-px w-[40%] bg-gradient-to-r from-transparent via-sky-500 to-transparent" />
                        <div className="relative z-30 text-sm font-medium text-white">
                          {copied ? "Tersalin!" : "Salin PIN"}
                        </div>
                        <div className="absolute bottom-[-4px] left-1/2 transform -translate-x-1/2 w-2 h-2 bg-black rotate-45 z-10"></div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="flex justify-center py-4 w-full">
                <div className="w-48 h-48 md:w-72 md:h-72 border border-gray-200 rounded-lg p-2">
                  <QRCodeSVG
                    value={`${window.location.origin}/join?pin=${gameSession.game_pin}`}
                    size="100%"
                    className="w-full h-full"
                    bgColor="#FFFFFF"
                    fgColor="#4C1D95"
                    level="H"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Bagikan PIN atau scan QRCode kepada pemain untuk bergabung
              </p>
            </CardContent>
          </Card>

          {/* Players Card */}
        </div>
        <Card className="bg-white shadow-lg rounded-xl p-6 w-full md:col-span-2">
          <CardHeader className="pb-4 px-0 pt-0 flex flex-row items-center gap-2 justify-center text-center">
            <Users className="w-5 h-5 text-gray-600" />
            <CardTitle className="text-xl font-semibold">
              Pemain ({gameSession.participants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {gameSession.participants.length === 0 ? (
              <div className="text-center py-4">
                <div className="flex justify-center py-4">
                  <Users className="w-24 h-24 text-gray-300" />
                </div>
                <p className="text-lg font-medium text-gray-700">
                  Menunggu pemain...
                </p>
                <p className="text-sm text-gray-600">
                  Bagikan Game PIN untuk mengundang pemain bergabung
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {gameSession.participants.map((participant, index) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                        <AvatarImage
                          src={
                            (participant.profiles &&
                              (Array.isArray(participant.profiles)
                                ? participant.profiles[0]?.avatar_url
                                : participant.profiles?.avatar_url)) ||
                            `https://robohash.org/${encodeURIComponent(
                              participant.nickname
                            )}.png`
                          }
                          alt={participant.nickname}
                          className="object-cover w-full h-full"
                        />
                      </Avatar>
                      <span className="font-medium">
                        {participant.nickname}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(participant.joined_at).toLocaleTimeString(
                        "id-ID",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Chat Panel */}
      {user && gameSession && (
        <ChatPanel
          sessionId={gameSession.id}
          userId={user.id}
          nickname={displayName}
          avatarUrl={userProfile?.avatar_url}
          position="right"
          isHost={true}
        />
      )}
    </div>
  );
}

export default function HostGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <GamePageWithLoading 
      animation="slide"
      customLoadingMessage="Memuat ruang host..."
    >
      <HostGamePageContent params={params} />
    </GamePageWithLoading>
  );
}
