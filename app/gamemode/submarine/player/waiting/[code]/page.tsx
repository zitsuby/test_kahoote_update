"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useParams, useSearchParams, useRouter } from "next/navigation"

export default function PlayerWaitingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const roomCode = params.code as string
  const nickname = searchParams.get("nickname") || ""
  const avatar = searchParams.get("avatar") || ""

  const [isGameStarting, setIsGameStarting] = useState(false)
  const [countdown, setCountdown] = useState(3)

  // Simulate game starting
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsGameStarting(true)
      setCountdown(3)
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  // Add prefetch for game page on component mount
  useEffect(() => {
    const gameUrl = `/player/game/${roomCode}?nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`
    router.prefetch(gameUrl)
  }, [router, roomCode, nickname, avatar])

  // Update the countdown effect with smooth transition
  useEffect(() => {
    if (countdown > 1) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 1 && isGameStarting) {
      // Show transition overlay
      const transitionEl = document.getElementById("page-transition")
      if (transitionEl) {
        transitionEl.classList.add("page-transition-enter")
      }

      // kasih waktu animasi loading muncul
      const delay = setTimeout(() => {
        const gameUrl = `/player/game/${roomCode}?nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`
        router.push(gameUrl)
      }, 800)

      return () => clearTimeout(delay)
    }
  }, [countdown, isGameStarting, roomCode, nickname, avatar, router])

  if (isGameStarting) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
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

        <div className="relative z-20 text-center">
          {/* Countdown */}
          <div className="relative z-20 text-center">
            <div
              className={`
            w-40 h-40 mx-auto flex items-center justify-center
            font-black text-8xl mb-6 transition-all duration-500 ease-in-out
            text-white shadow-2xl
            rounded-none
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
                  <div className="text-8xl font-bold text-white mb-4 animate-pulse text-center">{countdown}</div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-white text-xl">Loading game...</p>
                  </div>
                )}
              </div>
            </div>
            <p className="text-2xl text-white">Get ready...</p>
          </div>
          <p className="text-2xl text-white">Game starting...</p>
        </div>
      </div>
    )
  }

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
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-center p-6">
        {/* Player Avatar and Info */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-6">
            <Avatar className="w-32 h-32 border-4 border-white shadow-2xl">
              <AvatarImage src={avatar || "/placeholder.svg"} />
              <AvatarFallback className="bg-blue-500 text-white text-4xl">{nickname[0]}</AvatarFallback>
            </Avatar>
          </div>

          <h1 className="text-4xl font-bold text-white mb-2">{nickname}</h1>
          <p className="text-xl text-white/80">You're in! See your nickname on screen?</p>
        </div>

        {/* Waiting indicator */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="animate-spin w-8 h-8 border-4 border-white/30 border-t-white rounded-full"></div>
          </div>
          <p className="text-white/80">Waiting for game to start...</p>
        </div>
      </div>
    </div>
  )
}
