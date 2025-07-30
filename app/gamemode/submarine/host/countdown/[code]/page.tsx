"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

export default function HostCountdownPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.code as string

  const [countdown, setCountdown] = useState(3)

  // Prefetch game page immediately
  useEffect(() => {
    router.prefetch(`/host/game/${roomCode}`)
  }, [router, roomCode])

  // Countdown effect
  useEffect(() => {
    if (countdown > 1) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 1) {
      // Show transition overlay
      const transitionEl = document.getElementById("page-transition")
      if (transitionEl) {
        transitionEl.classList.add("page-transition-enter")
      }

      // Tampilkan "1" dulu sebentar, lalu push ke game
      const delayBeforeRedirect = setTimeout(() => {
        localStorage.setItem(`countdown-done-${roomCode}`, "true")
        router.push(`/host/game/${roomCode}`)
      }, 800)

      return () => clearTimeout(delayBeforeRedirect)
    }
  }, [countdown, router, roomCode])

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
            {countdown}
          </div>
        </div>
        <p className="text-2xl text-white">Get ready...</p>
      </div>
    </div>
  )
}
