"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Settings, Square, Volume2, VolumeX } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { FullscreenButton } from "../../room/[id]/page"
import Swal from "sweetalert2"

// Dummy game data
const gameData = {
  level: 2,
  progress: 65,
  requiredProgress: 100,
  timeRemaining: 110, // seconds
  totalTime: 600,
  players: [
    {
      id: "1",
      nickname: "Captain_Blue",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=1",
      progress: 3,
      isActive: true,
    },
    {
      id: "2",
      nickname: "SeaExplorer",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=2",
      progress: 2,
      isActive: false,
    },
    {
      id: "3",
      nickname: "DeepDiver",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=3",
      progress: 1,
      isActive: true,
    },
  ],
  currentQuestion: {
    id: 1,
    text: "Berapa hasil dari 15 + 27?",
    options: ["42", "41", "43", "40"],
    correctAnswer: 0,
  },
  sharkDistance: 20, // percentage
  isTeamGame: false,
  captain: null,
}

export default function HostGamePage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.code as string

  const [currentData, setCurrentData] = useState(gameData)
  const [timerPaused, setTimerPaused] = useState(false)
  const [showTryAgain, setShowTryAgain] = useState(false)
  const [showFish, setShowFish] = useState(true)

  const [fishX, setFishX] = useState(-900)
  const [fishFrame, setFishFrame] = useState(3) // mulai dari Pola 3
  const [subVisible, setSubVisible] = useState(true)
  const [hasEaten, setHasEaten] = useState(false)
  const [fishPhase, setFishPhase] = useState<"idle" | "pause" | "exit">("idle")
  const submarineX = 600 // titik kira-kira posisi kapal selam (atur sesuai layout)

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
        setCurrentData((prev) => ({
          ...prev,
          progress: Math.max(0, prev.progress - 10),
        }))
      }, 200) // biar smooth dikit
    }
  }, [fishX, fishPhase])

  const spriteOffsetX = fishFrame * -900 // frame lebar 300px

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentData((prev) => {
        if (prev.timeRemaining > 0 && !timerPaused) {
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
  }, [timerPaused])

  // Add this useEffect after the existing timer effect
  useEffect(() => {
    // Prefetch results page
    router.prefetch(`/host/results/${roomCode}`)
  }, [router, roomCode])

  // Add this useEffect after the existing timer effect
  useEffect(() => {
    if (currentData.timeRemaining <= 0) {
      // Show transition overlay
      const transitionEl = document.getElementById("page-transition")
      if (transitionEl) {
        transitionEl.classList.add("page-transition-enter")
      }

      setTimeout(() => {
        router.push(`/host/results/${roomCode}`)
      }, 300)
    }
  }, [currentData.timeRemaining, router, roomCode])

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
          router.push(`/host/results/${roomCode}`)
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
                  <span className="text-white font-medium">Level {currentData.level}</span>
                </Badge>
                <div className="flex items-center gap-2">
                  <Badge>
                    <span className="text-white font-medium">{formatTime(currentData.timeRemaining)}</span>
                  </Badge>
                </div>
              </div>
              <Progress
                value={(currentData.progress / currentData.requiredProgress) * 100}
                className="h-3 bg-white/20"
                indicatorClassName="bg-yellow-400"
              />
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
