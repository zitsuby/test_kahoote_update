"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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

interface GameSession {
  id: string;
  quiz_id: string;
  status: string;
  total_time_minutes: number;
  started_at: string;
  ended_at: string | null;
  shark_speed: number;
}

interface Participant {
  id: string;
  nickname: string;
  score: number;
  fire_charges: number;
  hold_button_uses: number;
  correct_streak: number;
  wrong_streak: number;
  shark_distance: number;
  submarine_level: number;
  profiles?: {
    avatar_url?: string | null;
  };
}

interface SubmarineGameEvent {
  id: string;
  participant_id: string;
  event_type: string;
  event_data: any;
  created_at: string;
}

export default function HostGamePage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.code as string

  // Game state
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [muted, setMuted] = useState(false)

  // Shark animation state
  const [sharkX, setSharkX] = useState(-900)
  const [sharkFrame, setSharkFrame] = useState(3)
  const [sharkSpeed, setSharkSpeed] = useState(1)
  const [averageSharkDistance, setAverageSharkDistance] = useState(100)
  const [submarineVisible, setSubmarineVisible] = useState(true)
  const [lastSharkAttack, setLastSharkAttack] = useState<Date | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const sharkAnimationRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch game data
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

      // Fetch participants with submarine data
      const { data: participantsData, error: participantsError } = await supabase
        .from("game_participants")
        .select(`
          id,
          nickname,
          score,
          fire_charges,
          hold_button_uses,
          correct_streak,
          wrong_streak,
          shark_distance,
          submarine_level,
          profiles (
            avatar_url
          )
        `)
        .eq("session_id", sessionId)
        .order("score", { ascending: false })

      if (participantsError) throw participantsError

      setParticipants(participantsData || [])

      // Calculate average shark distance for animation
      if (participantsData && participantsData.length > 0) {
        const avgDistance = participantsData.reduce((sum, p) => sum + (p.shark_distance || 100), 0) / participantsData.length
        setAverageSharkDistance(avgDistance)
      }

    } catch (error) {
      console.error("Error fetching game data:", error)
      toast.error("Gagal memuat data game")
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // Setup real-time subscriptions
  const setupSubscriptions = useCallback(() => {
    const channel = supabase
      .channel(`submarine_host_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("Participant updated:", payload)
          fetchGameData() // Refresh all data when participants change
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submarine_game_events",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("Submarine event:", payload)
          handleSubmarineEvent(payload.new as SubmarineGameEvent)
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
  }, [sessionId, fetchGameData])

  // Handle submarine events for animations
  const handleSubmarineEvent = (event: SubmarineGameEvent) => {
    switch (event.event_type) {
      case 'shark_attack':
        console.log("Shark attack detected!", event.event_data)
        setLastSharkAttack(new Date())
        // Trigger shark attack animation
        triggerSharkAttack()
        break
      case 'hold_button':
        console.log("Hold button used!", event.event_data)
        // Slow down shark temporarily
        slowDownShark()
        break
      case 'fire_charge':
        console.log("Fire charge gained!", event.event_data)
        break
    }
  }

  // Shark attack animation
  const triggerSharkAttack = () => {
    setSubmarineVisible(false)
    setSharkSpeed(0.5) // Slow down after attack
    
    setTimeout(() => {
      setSubmarineVisible(true)
      setSharkSpeed(1) // Resume normal speed
    }, 3000)
  }

  // Slow down shark when hold button is used
  const slowDownShark = () => {
    setSharkSpeed(0.2) // Very slow
    
    setTimeout(() => {
      setSharkSpeed(1) // Resume normal speed
    }, 5000)
  }

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
          handleEndGame()
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
  }, [gameSession])

  // Shark animation effect
  useEffect(() => {
    if (sharkAnimationRef.current) {
      clearInterval(sharkAnimationRef.current)
    }

    sharkAnimationRef.current = setInterval(() => {
      setSharkX((prev) => {
        const newX = prev + (2 * sharkSpeed)
        
        // Reset shark position when it goes off screen
        if (newX > 1400) {
          return -900
        }
        
        return newX
      })
    }, 60)

    return () => {
      if (sharkAnimationRef.current) {
        clearInterval(sharkAnimationRef.current)
      }
    }
  }, [sharkSpeed])

  // Update shark frame based on distance to submarine
  useEffect(() => {
    const submarineX = 600 // Approximate submarine position
    const distance = submarineX - sharkX

    if (distance > 500) {
      setSharkFrame(2) // Closed mouth
    } else if (distance > 325) {
      setSharkFrame(1) // Slightly open
    } else if (distance > 0) {
      setSharkFrame(0) // Wide open
    }
  }, [sharkX])

  // Update shark speed based on average participant performance
  useEffect(() => {
    // Lower shark distance = faster shark
    // Higher shark distance = slower shark
    const speedMultiplier = Math.max(0.2, Math.min(2.0, (100 - averageSharkDistance) / 50))
    setSharkSpeed(speedMultiplier)
  }, [averageSharkDistance])

  // Initialize component
  useEffect(() => {
    fetchGameData()
    const unsubscribe = setupSubscriptions()

    return () => {
      unsubscribe()
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (sharkAnimationRef.current) {
        clearInterval(sharkAnimationRef.current)
      }
    }
  }, [fetchGameData, setupSubscriptions])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleEndGame = async () => {
    try {
      // Update game session status
      const { error } = await supabase
        .from("game_sessions")
        .update({
          status: "finished",
          ended_at: new Date().toISOString(),
        })
        .eq("id", sessionId)

      if (error) throw error

      // Calculate final scores for all participants
      const { data: latestParticipants, error: participantsError } = await supabase
        .from("game_participants")
        .select("id, nickname")
        .eq("session_id", sessionId)

      if (participantsError) {
        console.error("Error fetching participants:", participantsError)
      } else if (latestParticipants && latestParticipants.length > 0) {
        console.log(`Calculating scores for ${latestParticipants.length} participants`)
        await Promise.all(
          latestParticipants.map(async (participant) => {
            try {
              await supabase.rpc("calculate_score", {
                session_id_input: sessionId,
                participant_id_input: participant.id,
              })
              console.log(`Score calculated for ${participant.nickname}`)
            } catch (err) {
              console.error(`Error calculating score for ${participant.nickname}:`, err)
            }
          })
        )
      }

      // Navigate to results
      router.push(`/gamemode/submarine/host/results/${sessionId}`)
    } catch (error) {
      console.error("Error ending game:", error)
      toast.error("Gagal mengakhiri game")
    }
  }

  const handleEndGameConfirm = () => {
    Swal.fire({
      title: "Akhiri permainan?",
      text: "Apakah Anda yakin ingin mengakhiri permainan dan melihat hasil?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, akhiri",
      cancelButtonText: "Batal",
    }).then((result) => {
      if (result.isConfirmed) {
        handleEndGame()
      }
    })
  }

  const toggleMute = () => {
    setMuted((prev) => !prev)
    const audio = document.getElementById("bg-audio") as HTMLAudioElement
    if (audio) {
      audio.muted = !audio.muted
    }
  }

  const getSharkDistanceColor = (distance: number) => {
    if (distance > 70) return "text-green-400"
    if (distance > 40) return "text-yellow-400"
    return "text-red-400"
  }

  const spriteOffsetX = sharkFrame * -900 // Each frame is 900px wide

  if (loading || !gameSession) {
    return (
      <div className="min-h-screen bg-deep-ocean flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-white">Memuat game...</p>
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
          {/* Game Info Header */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 w-[75%] mb-6 mx-auto">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Badge className="bg-blue-600/80 text-white">
                    <span className="font-medium">Submarine Mode</span>
                  </Badge>
                  <Badge className="bg-purple-600/80 text-white">
                    <span className="font-medium">{participants.length} Players</span>
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-600/80 text-white text-lg px-4 py-2">
                    <span className="font-medium">{formatTime(timeRemaining)}</span>
                  </Badge>
                </div>
              </div>
              
              {/* Average Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-white text-sm">
                  <span>Average Shark Distance</span>
                  <span className={getSharkDistanceColor(averageSharkDistance)}>
                    {Math.round(averageSharkDistance)}%
                  </span>
                </div>
                <Progress
                  value={averageSharkDistance}
                  className="h-3 bg-white/20"
                  indicatorClassName={
                    averageSharkDistance > 70 ? "bg-green-400" :
                    averageSharkDistance > 40 ? "bg-yellow-400" : "bg-red-400"
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Player Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {participants.map((participant) => (
              <Card key={participant.id} className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                      {participant.nickname[0]}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{participant.nickname}</p>
                      <p className="text-cyan-300 text-xs">Level {participant.submarine_level}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {/* Fire Charges */}
                    <div className="flex items-center justify-between">
                      <span className="text-white text-xs">🔥 Charges</span>
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              participant.fire_charges > i ? 'bg-orange-400' : 'bg-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    
                    {/* Shark Distance */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-xs">🦈 Distance</span>
                        <span className={`text-xs ${getSharkDistanceColor(participant.shark_distance)}`}>
                          {Math.round(participant.shark_distance)}%
                        </span>
                      </div>
                      <div className="w-full h-1 bg-gray-700 rounded-full">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            participant.shark_distance > 70 ? 'bg-green-400' :
                            participant.shark_distance > 40 ? 'bg-yellow-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${participant.shark_distance}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Score */}
                    <div className="flex items-center justify-between">
                      <span className="text-white text-xs">Score</span>
                      <span className="text-yellow-400 text-xs font-bold">{participant.score}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Shark Animation */}
        <div
          className="absolute top-[3%] w-[900px] h-[600px] bg-[url('/fish-sprite.svg')] bg-no-repeat bg-[length:auto_100%] transition-transform duration-75 ease-linear z-30"
          style={{
            transform: `translateX(${sharkX}px)`,
            backgroundPosition: `${spriteOffsetX}px 0px`,
          }}
        />

        {/* Submarine */}
        {submarineVisible && (
          <Image
            src="/submarine.svg"
            alt="Submarine"
            width={120}
            height={120}
            className="absolute right-[10%] top-[45%] drop-shadow-lg transition-opacity duration-300 z-20"
          />
        )}

        {/* Control Panel - Bottom Right */}
        <div className="absolute bottom-3 right-1 z-40">
          <div className="flex p-2 px-5 gap-2 text-white justify-end items-center">
            <div className="flex items-center gap-3 p-2 text-white bg-red-600 hover:bg-red-700 backdrop-blur-sm rounded-lg cursor-pointer">
              <Button
                onClick={handleEndGameConfirm}
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
