"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Settings, Volume2, VolumeX } from "lucide-react"
import { FullscreenButton } from "@/app/host/room/[code]/page"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface Question {
  id: string;
  question_text: string;
  time_limit: number;
  points: number;
  order_index: number;
  answers: Array<{
    id: string;
    answer_text: string;
    is_correct: boolean;
    color: string;
    order_index: number;
  }>;
}

interface GameSession {
  id: string;
  quiz_id: string;
  status: string;
  total_time_minutes: number;
  started_at: string;
  ended_at: string | null;
}

interface ParticipantData {
  id: string;
  fire_charges: number;
  hold_button_uses: number;
  correct_streak: number;
  wrong_streak: number;
  shark_distance: number;
  score: number;
}

export default function PlayerGamePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const sessionId = params.code as string
  const participantId = searchParams.get("participant") || ""
  const nickname = searchParams.get("nickname") || ""
  const avatar = searchParams.get("avatar") || ""

  // Game state
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [participantData, setParticipantData] = useState<ParticipantData | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  
  // Submarine specific states
  const [gamePhase, setGamePhase] = useState<"questions" | "hold" | "finished">("questions")
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [canUseHoldButton, setCanUseHoldButton] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch initial game data
  const fetchGameData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch game session
      const { data: sessionData, error: sessionError } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId)
        .single()

      if (sessionError) throw sessionError

      setGameSession(sessionData)

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select(`
          id,
          question_text,
          time_limit,
          points,
          order_index,
          answers (
            id,
            answer_text,
            is_correct,
            color,
            order_index
          )
        `)
        .eq("quiz_id", sessionData.quiz_id)
        .order("order_index")

      if (questionsError) throw questionsError

      setQuestions(questionsData || [])

      // Fetch participant data
      const { data: participantInfo, error: participantError } = await supabase
        .from("game_participants")
        .select("id, fire_charges, hold_button_uses, correct_streak, wrong_streak, shark_distance, score")
        .eq("id", participantId)
        .single()

      if (participantError) throw participantError

      setParticipantData(participantInfo)
      setCanUseHoldButton(participantInfo.fire_charges >= 3)

    } catch (error) {
      console.error("Error fetching game data:", error)
      toast.error("Gagal memuat data game")
    } finally {
      setLoading(false)
    }
  }, [sessionId, participantId])

  // Setup real-time subscriptions
  const setupSubscriptions = useCallback(() => {
    const channel = supabase
      .channel(`submarine_game_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_participants",
          filter: `id=eq.${participantId}`,
        },
        (payload) => {
          console.log("Participant data updated:", payload)
          if (payload.new) {
            setParticipantData(payload.new as ParticipantData)
            setCanUseHoldButton((payload.new as ParticipantData).fire_charges >= 3)
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("Game session updated:", payload)
          if (payload.new) {
            setGameSession(payload.new as GameSession)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, participantId])

  // Timer effect
  useEffect(() => {
    if (gameSession && gameSession.status === "active" && gameSession.started_at) {
      const updateTimer = () => {
        const now = new Date()
        const startTime = new Date(gameSession.started_at)
        const totalTimeMs = gameSession.total_time_minutes * 60 * 1000
        const endTime = new Date(startTime.getTime() + totalTimeMs)
        const remaining = Math.max(0, endTime.getTime() - now.getTime())
        const timeLeftSeconds = Math.ceil(remaining / 1000)

        setTimeRemaining(timeLeftSeconds)

        if (timeLeftSeconds <= 0) {
          // Game ended
          router.push(
            `/gamemode/submarine/player/results/${sessionId}?participant=${participantId}&nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`
          )
        }
      }

      updateTimer()
      timerRef.current = setInterval(updateTimer, 1000)

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
      }
    }
  }, [gameSession, router, sessionId, participantId, nickname, avatar])

  // Initialize component
  useEffect(() => {
    fetchGameData()
    const unsubscribe = setupSubscriptions()

    return () => {
      unsubscribe()
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [fetchGameData, setupSubscriptions])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleAnswerSelect = async (answerIndex: number) => {
    if (selectedAnswer !== null || !questions[currentQuestionIndex]) return

    setSelectedAnswer(answerIndex)
    
    const currentQuestion = questions[currentQuestionIndex]
    const selectedAnswerData = currentQuestion.answers[answerIndex]
    const isCorrect = selectedAnswerData.is_correct

    try {
      // Record the response
      const { error: responseError } = await supabase
        .from("game_responses")
        .insert({
          session_id: sessionId,
          participant_id: participantId,
          question_id: currentQuestion.id,
          answer_id: selectedAnswerData.id,
          response_time: currentQuestion.time_limit * 1000, // Convert to milliseconds
          points_earned: isCorrect ? currentQuestion.points : 0,
        })

      if (responseError) throw responseError

      // Update shark distance and streaks
      const { error: sharkError } = await supabase.rpc("update_shark_distance", {
        p_participant_id: participantId,
        p_correct_answer: isCorrect,
      })

      if (sharkError) throw sharkError

      // Check if should add fire charge (every 3 correct answers)
      if (isCorrect) {
        const { data: fireChargeAdded, error: fireError } = await supabase.rpc("add_fire_charge", {
          p_participant_id: participantId,
        })

        if (fireError) throw fireError

        if (fireChargeAdded) {
          toast.success("🔥 Fire Charge Ready!")
        }
      }

      // Move to next question after delay
      setTimeout(() => {
        setSelectedAnswer(null)
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(currentQuestionIndex + 1)
        } else {
          // All questions answered, cycle back to first question
          setCurrentQuestionIndex(0)
        }
      }, 1500)

    } catch (error) {
      console.error("Error recording answer:", error)
      toast.error("Gagal menyimpan jawaban")
    }
  }

  // Hold button handlers
  const handleHoldStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (canUseHoldButton && participantData?.fire_charges >= 3) {
      setIsHolding(true)
      setGamePhase("hold")
    }
  }

  const handleHoldEnd = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsHolding(false)

    if (holdProgress >= 100 && canUseHoldButton && participantData?.fire_charges >= 3) {
      try {
        // Use hold button
        const { data: success, error } = await supabase.rpc("use_hold_button", {
          p_participant_id: participantId,
        })

        if (error) throw error

        if (success) {
          toast.success("🚀 Hold Button Activated!")
          setHoldProgress(0)
          setGamePhase("questions")
        }
      } catch (error) {
        console.error("Error using hold button:", error)
        toast.error("Gagal menggunakan hold button")
      }
    } else {
      setHoldProgress(0)
      setGamePhase("questions")
    }
  }

  // Hold progress effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isHolding && canUseHoldButton) {
      interval = setInterval(() => {
        setHoldProgress((prev) => Math.min(prev + 2, 100))
      }, 50)
    } else {
      setHoldProgress(0)
    }
    return () => clearInterval(interval)
  }, [isHolding, canUseHoldButton])

  // Global event listeners for hold button
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isHolding) {
        handleHoldEnd({ preventDefault: () => {} } as any)
      }
    }

    const handleGlobalTouchEnd = () => {
      if (isHolding) {
        handleHoldEnd({ preventDefault: () => {} } as any)
      }
    }

    document.addEventListener("mouseup", handleGlobalMouseUp)
    document.addEventListener("touchend", handleGlobalTouchEnd)

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp)
      document.removeEventListener("touchend", handleGlobalTouchEnd)
    }
  }, [isHolding])

  // Answer button colors (Kahoot style)
  const getButtonColor = (index: number) => {
    const colors = [
      "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
      "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
      "bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700",
      "bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
    ]
    return colors[index] || "bg-gradient-to-br from-gray-500 to-gray-600"
  }

  const getButtonShape = (index: number) => {
    const shapes = ["△", "◆", "○", "□"]
    return shapes[index] || "?"
  }

  if (loading || !gameSession || !participantData || questions.length === 0) {
    return (
      <div className="min-h-screen bg-deep-ocean flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-white">Memuat game...</p>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]

  return (
    <div className="min-h-screen bg-deep-ocean relative overflow-hidden">
      <style jsx>{`
        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.3);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes zoomOut {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.3);
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-zoom-in {
          animation: zoomIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        .animate-zoom-out {
          animation: zoomOut 0.3s ease-in;
        }
        
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out;
        }
        
        .question-transition {
          transition: all 0.3s ease-in-out;
        }
      `}</style>

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

      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-4 h-4 bg-cyan-300/30 rounded-full animate-float"></div>
        <div
          className="absolute top-40 right-20 w-6 h-6 bg-blue-300/20 rounded-full animate-float"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute bottom-40 left-20 w-3 h-3 bg-cyan-400/40 rounded-full animate-float"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      <div className="relative z-20 min-h-screen flex flex-col">
        {/* Fixed Header at Top */}
        <div className="p-4 flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between animate-slide-in-up">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border-2 border-white shadow-2xl animate-glow">
                  <AvatarImage src={avatar || "/placeholder.svg"} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold text-lg">
                    {nickname[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-white font-semibold text-xl">{nickname}</p>
                  <Badge
                    variant="outline"
                    className="text-white border-cyan-300/50 bg-cyan-500/20 text-xs backdrop-blur-sm rounded-lg"
                  >
                    Submarine Mode
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center text-white gap-6">
                {/* 🔥 Fire Charges */}
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map((chargeIndex) => (
                    <div key={chargeIndex} className="flex flex-col items-center">
                      <div
                        className={`text-xl transition-all duration-700 transform ${
                          participantData.fire_charges > chargeIndex
                            ? "filter drop-shadow-lg scale-110"
                            : "opacity-30 grayscale scale-100"
                        }`}
                      >
                        🔥
                      </div>
                    </div>
                  ))}
                </div>

                {/* Shark Distance Indicator */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">🦈</span>
                  <div className="w-20 h-2 bg-gray-700 rounded-full">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        participantData.shark_distance > 50 ? 'bg-green-500' :
                        participantData.shark_distance > 25 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${participantData.shark_distance}%` }}
                    />
                  </div>
                </div>

                {/* ⏱️ Timer */}
                <span className="text-2xl font-mono font-bold">{formatTime(timeRemaining)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Centered Phase Content */}
        <div className="fixed inset-0 flex items-center justify-center z-30">
          <div className="w-full max-w-4xl text-center px-4">
            {/* Questions Phase */}
            {gamePhase === "questions" && currentQuestion && (
              <div key={currentQuestion.id} className="animate-zoom-in">
                <Card
                  className={`glass border-purple-300/30 hover:border-purple-300/50 transition-all duration-500 transform hover:scale-[1.02] question-transition ${
                    selectedAnswer !== null ? "animate-zoom-out" : ""
                  }`}
                >
                  <CardContent className="space-y-6 pt-6">
                    <div className="text-center mb-6">
                      <p className="text-2xl text-white font-medium break-words">
                        {currentQuestion.question_text}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {currentQuestion.answers.map((answer, index) => (
                        <Button
                          key={answer.id}
                          onClick={() => handleAnswerSelect(index)}
                          disabled={selectedAnswer !== null}
                          className={`p-6 text-left justify-start text-white font-semibold text-xl h-auto rounded-xl transition-all duration-300 ${getButtonColor(index)} ${
                            selectedAnswer === index
                              ? answer.is_correct
                                ? "ring-4 ring-green-300 scale-105"
                                : "ring-4 ring-red-300 scale-105"
                              : "hover:scale-105"
                          }`}
                        >
                          <span className="text-3xl mr-4">{getButtonShape(index)}</span>
                          {answer.answer_text}
                        </Button>
                      ))}
                    </div>

                    {/* Hold Button Trigger */}
                    {canUseHoldButton && participantData.fire_charges >= 3 && (
                      <div className="mt-6">
                        <Button
                          onMouseDown={handleHoldStart}
                          onTouchStart={handleHoldStart}
                          className="bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-8 py-4 text-lg font-bold rounded-xl animate-pulse"
                        >
                          🔥 HOLD TO ACTIVATE 🔥
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Hold Button Phase */}
            {gamePhase === "hold" && (
              <div className="animate-fade-in">
                <Card className="glass border-orange-300/30 hover:border-orange-300/50 transition-all duration-500">
                  <CardHeader>
                    <CardTitle className="text-white text-center text-2xl">🔥 SUBMARINE POWER! 🔥</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center space-y-6">
                    <div className="space-y-3">
                      <Progress value={holdProgress} className="h-6 bg-white/20 rounded-full" />
                      <p className="text-white text-xl font-bold">{Math.round(holdProgress)}%</p>
                    </div>
                    <button
                      onMouseDown={handleHoldStart}
                      onMouseUp={handleHoldEnd}
                      onTouchStart={handleHoldStart}
                      onTouchEnd={handleHoldEnd}
                      className="w-48 h-48 rounded-full text-white text-3xl font-bold shadow-2xl transition-all duration-300 select-none bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 hover:scale-110 animate-glow"
                      style={{ userSelect: "none", WebkitUserSelect: "none" }}
                    >
                      {holdProgress >= 100 ? "🚀" : "HOLD"}
                    </button>
                    {holdProgress >= 100 && (
                      <p className="text-orange-300 font-semibold text-xl animate-scale-in">
                        🎉 Shark pushed away! Continuing questions...
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}