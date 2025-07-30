"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Settings, Maximize, Minimize, Unlock, Volume2, VolumeX } from "lucide-react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import QRCode from "react-qr-code"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

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

interface GameSession {
  id: string;
  game_pin: string;
  status: string;
  participants: Array<{
    id: string;
    nickname: string;
    joined_at: string;
    profiles?: {
      avatar_url?: string | null;
    } | null;
  }>;
}

export default function HostRoomPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  
  const roomCode = params.code as string
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [showCountdown, setShowCountdown] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [copied, setCopied] = useState(false)
  const [showQRPopup, setShowQRPopup] = useState(false)
  const [muted, setMuted] = useState(false)
  const [quizTitle, setQuizTitle] = useState("Game Session")
  const [participants, setParticipants] = useState<any[]>([])
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [gameEndMode, setGameEndMode] = useState<'first_finish' | 'wait_timer'>('wait_timer')
  const hasCreatedSession = useRef(false)
  const [totalTimeMinutes, setTotalTimeMinutes] = useState<number>(10); // Tambah state waktu
  const [showTimeSetup, setShowTimeSetup] = useState(false); // Tambah state untuk menampilkan setup waktu

  // Prefetch game page
  useEffect(() => {
    if (gameSession?.id) {
      router.prefetch(`../game/${gameSession.id}`)
    }
  }, [router, gameSession])

  // Fetch quiz details
  useEffect(() => {
    const fetchQuizDetails = async () => {
      if (!roomCode) return
      
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from("game_sessions")
          .select("quiz_id")
          .eq("game_pin", roomCode)
          .single()
          
        if (sessionError || !sessionData) return
          
        const { data: quizData, error: quizError } = await supabase
          .from("quizzes")
          .select("title, questions(id)")
          .eq("id", sessionData.quiz_id)
          .single()
          
        if (!quizError && quizData) {
          setQuizTitle(quizData.title)
          setTotalQuestions(quizData.questions?.length || 0)
        }
      } catch (error) {
        console.error("Error fetching quiz details:", error)
      }
    }
    
    fetchQuizDetails()
  }, [roomCode])

  // Create game session
  useEffect(() => {
    const createGameSession = async () => {
      if (!user || !roomCode || hasCreatedSession.current) return;
      
      try {
        hasCreatedSession.current = true;
        
        // 1. Cari quiz berdasarkan roomCode (kode quiz)
        const { data: quizData, error: quizError } = await supabase
          .from("quizzes")
          .select("id")
          .eq("code", roomCode) // Gunakan kolom code untuk mencari quiz
          .single();
        
        if (quizError || !quizData) {
          throw new Error(quizError?.message || "Quiz not found");
        }
        
        const quizId = quizData.id;

        // 2. Generate unique PIN
        const generateUniquePin = async () => {
          let isUnique = false;
          let newPin = "";
          
          while (!isUnique) {
            newPin = Math.floor(100000 + Math.random() * 900000).toString();
            
            const { data: existingSession, error } = await supabase
              .from("game_sessions")
              .select("id")
              .eq("game_pin", newPin)
              .maybeSingle();
            
            if (!existingSession && !error) {
              isUnique = true;
            }
          }
          return newPin;
        };

        // 3. Check if session already exists
        const { data: existingSession, error: sessionError } = await supabase
          .from("game_sessions")
          .select("*")
          .eq("quiz_id", quizId)
          .eq("host_id", user.id)
          .eq("status", "waiting")
          .maybeSingle();
        
        if (sessionError) throw sessionError;
        
        if (existingSession) {
          setGameSession(existingSession as GameSession);
          return;
        }
        
        // 4. Create new session dengan PIN baru
        const newGamePin = await generateUniquePin();
        
        const { data: newSession, error: createError } = await supabase
          .from("game_sessions")
          .insert({
            quiz_id: quizId,
            host_id: user.id,
            game_pin: newGamePin,
            status: "waiting",
            game_end_mode: gameEndMode,
            total_time_minutes: totalTimeMinutes
          })
          .select()
          .single();
        
        if (createError) {
          throw new Error(`Failed to create session: ${createError.message}`);
        }
        
        setGameSession(newSession as GameSession);
      } catch (error: any) {
        console.error("Error creating game session:", error);
        toast.error(`Failed to create game session: ${error.message || "Unknown error"}`);
        
        // Reset flag agar bisa mencoba lagi
        hasCreatedSession.current = false;
      }
    }
    
    if (user) {
      createGameSession();
    }
  }, [user, roomCode, gameEndMode, totalTimeMinutes]);

  // Subscribe to participant changes
  useEffect(() => {
    if (!gameSession?.id) return
    
    const fetchParticipants = async () => {
      try {
        const { data, error } = await supabase
          .from("game_participants")
          .select(`
            id, 
            nickname,
            joined_at,
            profiles (
              avatar_url
            )
          `)
          .eq("session_id", gameSession.id)
          .order("joined_at", { ascending: true })
          
        if (error) throw error
        
        setParticipants(data || [])
      } catch (error) {
        console.error("Error fetching participants:", error)
      }
    }
    
    fetchParticipants()
    
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
        () => fetchParticipants()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameSession])

  const startGame = async () => {
    if (!gameSession || participants.length === 0) return
    
    try {
      setShowCountdown(true)
      setCountdown(3)
      
      // Update session status
      await supabase
        .from("game_sessions")
        .update({
          status: "active",
          game_end_mode: gameEndMode,
          total_time_minutes: totalTimeMinutes // Tambahkan waktu
        })
        .eq("id", gameSession.id)
        
      // Countdown effect
      let counter = 3
      const countdownInterval = setInterval(() => {
        counter -= 1
        setCountdown(counter)
        
        if (counter === 0) {
          clearInterval(countdownInterval)
          router.push(`../game/${gameSession.id}`)
        }
      }, 1000)
      
    } catch (error) {
      console.error("Error starting game:", error)
      toast.error("Failed to start game")
    }
  }

  

  const copyGamePin = async () => {
    if (!gameSession) return

    try {
      await navigator.clipboard.writeText(gameSession.game_pin)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("Game PIN copied!")
    } catch (error) {
      toast.error("Failed to copy PIN")
    }
  }

  const toggleMute = () => {
    setMuted((prev) => !prev)
    const audio = document.getElementById("bg-audio") as HTMLAudioElement
    if (audio) {
      audio.muted = !audio.muted
    }
  }

  const endSession = async () => {
    if (!gameSession) return

    try {
      await supabase
        .from("game_sessions")
        .update({ status: "finished" })
        .eq("id", gameSession.id)
        
      router.push("/dashboard")
    } catch (error) {
      console.error("Error ending session:", error)
      toast.error("Failed to end session")
    }
  }

  const formattedGamePin = gameSession?.game_pin?.replace(/(\d{3})(\d{3})/, "$1 $2") || ""

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
                  {quizTitle} • {totalQuestions} questions
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
            {participants.length === 0 && (
              <div className="flex justify-center">
                <p className="bg-blue-600 p-1 px-2 rounded-sm text-2xl font-medium text-white">
                  Waiting for participants
                </p>
              </div>
            )}
            
            {participants.length > 4 && (
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 mt-8">
                {participants.slice(4).map((player) => (
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
            <span className="font-semibold text-sm">{participants.length}</span>
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
  )
}