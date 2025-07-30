"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Settings, Square, Volume2, VolumeX } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { FullscreenButton } from "../../room/[code]/page"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import Swal from "sweetalert2"

// Types for game data
type Player = {
  id: string
  nickname: string
  avatar: string
  progress: number
  isActive: boolean
  score: number
}

type Question = {
  id: string
  question_text: string
  options: string[]
  correctAnswer: number
  time_limit: number
  points: number
}

type GameData = {
  level: number
  progress: number
  requiredProgress: number
  timeRemaining: number
  totalTime: number
  players: Player[]
  currentQuestion: Question | null
  sharkDistance: number
  isTeamGame: boolean
  captain: string | null
  sessionId: string
  quizId: string
  questions: Question[]
}

export default function HostGamePage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.code as string

  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timerPaused, setTimerPaused] = useState(false)
  const [showTryAgain, setShowTryAgain] = useState(false)
  const [showFish, setShowFish] = useState(true)

  const [fishX, setFishX] = useState(-900)
  const [fishFrame, setFishFrame] = useState(3) // mulai dari Pola 3
  const [subVisible, setSubVisible] = useState(true)
  const [hasEaten, setHasEaten] = useState(false)
  const [fishPhase, setFishPhase] = useState<"idle" | "pause" | "exit">("idle")
  const submarineX = 600 // titik kira-kira posisi kapal selam (atur sesuai layout)

  // Load game session data and questions
  const loadGameData = async () => {
    try {
      // Get game session data
      const { data: session, error: sessionError } = await supabase
        .from("game_sessions")
        .select(`
          id,
          quiz_id,
          status,
          started_at,
          total_time_minutes,
          quizzes (
            id,
            title,
            questions (
              id,
              question_text,
              time_limit,
              points,
              order_index,
              answers (
                id,
                answer_text,
                is_correct,
                order_index
              )
            )
          )
        `)
        .eq("id", sessionId)
        .single()

      if (sessionError) {
        console.error("Error loading session:", sessionError)
        toast.error("Failed to load game session")
        return
      }

      // Get participants
      const { data: participants, error: participantsError } = await supabase
        .from("game_participants")
        .select("id, nickname, score, user_id, profiles(username)")
        .eq("session_id", sessionId)

      if (participantsError) {
        console.error("Error loading participants:", participantsError)
      }

      // Transform questions data
      const questions: Question[] = session.quizzes.questions
        .sort((a, b) => a.order_index - b.order_index)
        .map((q) => {
          const answers = q.answers.sort((a, b) => a.order_index - b.order_index)
          const correctAnswerIndex = answers.findIndex(a => a.is_correct)
          
          return {
            id: q.id,
            question_text: q.question_text,
            options: answers.map(a => a.answer_text),
            correctAnswer: correctAnswerIndex,
            time_limit: q.time_limit,
            points: q.points
          }
        })

      // Transform participants data
      const players: Player[] = (participants || []).map((p, index) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.nickname}`,
        progress: Math.floor(Math.random() * 5), // This will be updated with real progress
        isActive: true,
        score: p.score
      }))

      // Calculate time remaining
      const startedAt = new Date(session.started_at)
      const totalTimeMs = (session.total_time_minutes || 10) * 60 * 1000
      const elapsedMs = Date.now() - startedAt.getTime()
      const remainingMs = Math.max(0, totalTimeMs - elapsedMs)
      const timeRemaining = Math.floor(remainingMs / 1000)

      const initialGameData: GameData = {
        level: 1,
        progress: 0,
        requiredProgress: 100,
        timeRemaining,
        totalTime: (session.total_time_minutes || 10) * 60,
        players,
        currentQuestion: questions[0] || null,
        sharkDistance: 20,
        isTeamGame: false,
        captain: null,
        sessionId: session.id,
        quizId: session.quiz_id,
        questions
      }

      setGameData(initialGameData)
      setLoading(false)

    } catch (error) {
      console.error("Error loading game data:", error)
      toast.error("Failed to load game data")
      setLoading(false)
    }
  }

  // Load data on component mount
  useEffect(() => {
    loadGameData()
  }, [sessionId])

  // Set up real-time subscription for participants
  useEffect(() => {
    if (!gameData) return

    const participantsSubscription = supabase
      .channel(`game_participants_${sessionId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'game_participants',
          filter: `session_id=eq.${sessionId}`
        }, 
        (payload) => {
          console.log('Participant change:', payload)
          // Reload participants data
          loadGameData()
        }
      )
      .subscribe()

    return () => {
      participantsSubscription.unsubscribe()
    }
  }, [sessionId, gameData])

  // Gerakkan ikan maju terus
  useEffect(() => {
    // if (hasEaten) return // udah dimakan, ikannya jalan sendiri
    const interval = setInterval(() => {
      if (fishPhase === "idle") {
        setFishX((prev) => prev + 2)
      } else if (fishPhase === "exit") {
        setFishX((prev) => prev + 30) // setelah makan, lari lebih cepat
      }
    }, 60)

    return () => clearInterval(interval)
  }, [fishPhase, hasEaten])

  // Ubah frame sesuai jarak
  useEffect(() => {
    const distance = submarineX - fishX

    if (distance > 500) {
      setFishFrame(2) // Mingkem
    } else if (distance > 325) {
      setFishFrame(1) // Mangap dikit
    } else if (distance > 0) {
      setFishFrame(0) // Mangap penuh
    } else if (distance <= 0 && !hasEaten) {
      setHasEaten(true)
      setFishFrame(0)
      setFishPhase("pause") // berhenti sebentar
      setTimerPaused(true)
      Swal.fire({
        title: "TRY AGAIN!",
        text: "You were eaten by the shark. Progress has been reduced!",
        icon: "error",
        showConfirmButton: false,
        timer: 2800,
      })

      setTimeout(() => setFishFrame(1), 200)
      setTimeout(() => {
        setFishFrame(2)
        setSubVisible(false) // sembunyikan kapal
      }, 400)
      setTimeout(() => {
        setFishPhase("exit") // lanjut gerak kanan
        setTimerPaused(false)
        setShowTryAgain(false)
      }, 1000)
    }
  }, [fishX, hasEaten])

  // Restart fish animation when submarine is eaten
  useEffect(() => {
    if (fishPhase === "exit" && fishX > 1400) {
      setShowFish(false)
      // Delay sedikit agar reset gak kelihatan "lompat"
      setTimeout(() => {
        setFishX(-900) // mulai dari luar layar
        setFishFrame(3)
        setSubVisible(true)
        setHasEaten(false)
        setFishPhase("idle")
        setShowFish(true)

        // Reset progress turun (anggap -10%)
        setGameData((prev) => prev ? ({
          ...prev,
          progress: Math.max(0, prev.progress - 10),
        }) : null)
      }, 200) // biar smooth dikit
    }
  }, [fishX, fishPhase])

  const spriteOffsetX = fishFrame * -900 // frame lebar 300px

  useEffect(() => {
    if (!gameData) return

    const timer = setInterval(() => {
      setGameData((prev) => {
        if (prev && prev.timeRemaining > 0 && !timerPaused) {
          return {
            ...prev,
            timeRemaining: prev.timeRemaining - 1,
          }
        } else {
          return prev
        }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timerPaused, gameData])

  // Add this useEffect after the existing timer effect
  useEffect(() => {
    // Prefetch results page
    router.prefetch(`/gamemode/submarine/host/results/${sessionId}`)
  }, [router, sessionId])

  // Add this useEffect after the existing timer effect
  useEffect(() => {
    if (gameData && gameData.timeRemaining <= 0) {
      // Show transition overlay
      const transitionEl = document.getElementById("page-transition")
      if (transitionEl) {
        transitionEl.classList.add("page-transition-enter")
      }

      setTimeout(() => {
        router.push(`/gamemode/submarine/host/results/${sessionId}`)
      }, 300)
    }
  }, [gameData?.timeRemaining, router, sessionId])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleEndGame = () => {
    Swal.fire({
      title: "End the game?",
      text: "Are you sure you want to finish this game and view the results?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, end it",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        // Show transition overlay
        const transitionEl = document.getElementById("page-transition")
        if (transitionEl) {
          transitionEl.classList.add("page-transition-enter")
        }

        setTimeout(() => {
          router.push(`/gamemode/submarine/host/results/${sessionId}`)
        }, 300)
      }
    })
  }

  const [muted, setMuted] = useState(false)

  const toggleMute = () => {
    setMuted((prev) => !prev)
    const audio = document.getElementById("bg-audio") as HTMLAudioElement
    if (audio) {
      audio.muted = !audio.muted
    }
  }

  // Show loading state
  if (loading || !gameData) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div
          className="absolute inset-0 bg-cover bg-center animate-bg-left"
          style={{
            backgroundImage: `url('/textures/background.webp')`,
          }}
        />
        <div className="relative z-20 text-center">
          <div className="animate-spin w-20 h-20 border-4 border-white/30 border-t-white rounded-full mx-auto mb-6"></div>
          <p className="text-white text-2xl font-semibold">Loading Game...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <audio id="bg-audio" src="/first-wave-track.mp3" autoPlay loop />
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center animate-bg-left"
        style={{
          backgroundImage: `url('/textures/background.webp')`,
        }}
      />

      {/* Top texture overlay */}
      <div
        className="absolute top-0 left-0 right-0 h-32 bg-repeat-x z-10 animate-bg-left-tb"
        style={{
          backgroundImage: `url('/textures/texture-top.webp')`,
          backgroundSize: "auto 100%",
        }}
      />

      {/* Bottom texture overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 bg-repeat-x z-10 animate-bg-left-tb"
        style={{
          backgroundImage: `url('/textures/texture-bottom.webp')`,
          backgroundSize: "auto 100%",
        }}
      />

      <div className="relative z-20 min-h-screen p-4">
        <div className="max-w-7xl mx-auto">
          {/* Progress Bar */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 w-[75%] mb-6 mx-auto">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge>
                  <span className="text-white font-medium">Level {gameData.level}</span>
                </Badge>
                <div className="flex items-center gap-2">
                  <Badge>
                    <span className="text-white font-medium">{formatTime(gameData.timeRemaining)}</span>
                  </Badge>
                  <Badge variant="outline" className="text-white border-white/30">
                    <span className="text-white font-medium">{gameData.players.length} Players</span>
                  </Badge>
                </div>
              </div>
              <Progress
                value={(gameData.progress / gameData.requiredProgress) * 100}
                className="h-3 bg-white/20"
                indicatorClassName="bg-yellow-400"
              />
              <div className="mt-2 text-white/80 text-sm">
                Progress: {gameData.progress}% | Question: {gameData.currentQuestion?.question_text?.substring(0, 50)}...
              </div>
            </CardContent>
          </Card>

          {/* Players List */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
            <CardContent className="p-4">
              <h3 className="text-white font-semibold mb-3">Active Players</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {gameData.players.map((player) => (
                  <div key={player.id} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                      {player.nickname[0]}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{player.nickname}</p>
                      <p className="text-white/60 text-xs">Score: {player.score}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ml-auto ${player.isActive ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {showFish && (
          <div
            className="absolute top-[3%] w-[900px] h-[600px] bg-[url('/fish-sprite.svg')] bg-no-repeat bg-[length:auto_100%] transition-transform duration-75 ease-linear z-10"
            style={{
              transform: `translateX(${fishX}px)`,
              backgroundPosition: `${spriteOffsetX}px 0px`,
            }}
          />

        )}

        {subVisible && (
          <Image
            src="/submarine.svg"
            alt="Submarine"
            width={120}
            height={120}
            className="absolute right-[10%] top-[45%] drop-shadow-lg transition-opacity duration-300"
          />
        )}
        {/* End Game Button - Bottom Right */}
        <div className="absolute bottom-3 right-1 z-30">
          <div className="flex p-2 px-5 gap-2 text-white justify-end items-center">
            <div className="flex items-center gap-3 p-2 text-white bg-red-600 hover:bg-red-700 backdrop-blur-sm rounded-lg cursor-pointer">
              <Button
                onClick={handleEndGame}
                size="icon"
                className="bg-red-600 hover:bg-red-700 border-none"
                asChild
              >
                <Square className="w-5 h-5" />
              </Button>
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
    </div>
  )
}
