"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface GameSession {
  id: string
  status: string
  game_pin: string
}

export default function JoinGamePage() {
  const router = useRouter()
  const params = useParams()
  const roomCode = params.code as string

  const [nickname, setNickname] = useState("")
  const [avatar, setAvatar] = useState("")
  const [isJoining, setIsJoining] = useState(false)

  useEffect(() => {
    // Generate random avatar for new users
    const randomSeed = Math.random().toString(36).substring(7)
    setAvatar(`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${randomSeed}`)
  }, [])

  const joinRoom = async () => {
    if (!nickname.trim()) return

    setIsJoining(true)
    const waitingUrl = `/gamemode/submarine/player/waiting/${roomCode}?nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`

    // Prefetch waiting page
    await router.prefetch(waitingUrl)

    // Show transition overlay
    const transitionEl = document.getElementById("page-transition")
    if (transitionEl) {
      transitionEl.classList.add("page-transition-enter")
    }

    // Simulate joining process with smooth transition
    setTimeout(() => {
      router.push(waitingUrl)
    }, 1000)
  }

  useEffect(() => {
    // Data statis
    const nickname = "Huda"
    const avatar = "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Huda"

    // Langsung redirect ke waiting room
    const waitingUrl = `/gamemode/submarine/player/waiting/${roomCode}?nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`

    // Prefetch waiting page
    router.prefetch(waitingUrl)

    // Show transition overlay
    const transitionEl = document.getElementById("page-transition")
    if (transitionEl) {
      transitionEl.classList.add("page-transition-enter")
    }

    // Langsung redirect tanpa delay untuk testing
    setTimeout(() => {
      router.push(waitingUrl)
    }, 500)
  }, [roomCode, router])

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Page transition overlay */}
      <div 
        id="page-transition"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 opacity-0 pointer-events-none transition-all duration-1000"
        style={{
          background: 'linear-gradient(45deg, rgba(16,89,129,0.9) 0%, rgba(9,121,158,0.9) 50%, rgba(88,184,206,0.9) 100%)'
        }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold mb-2">Joining Room...</h2>
            <p className="text-white/80">Get ready for an underwater adventure!</p>
          </div>
        </div>
      </div>

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
      <div className="relative z-20 min-h-screen flex items-center justify-center p-6">
        <div className="bg-black/40 backdrop-blur-md p-8 rounded-2xl border border-white/20 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Join Room</h1>
            <p className="text-white/80">Room Code: <span className="font-bold text-yellow-400">{roomCode}</span></p>
          </div>

          <div className="space-y-6">
            {/* Avatar selection */}
            <div className="text-center">
              <Label className="text-white text-sm font-medium mb-2 block">Your Avatar</Label>
              <Avatar className="w-20 h-20 mx-auto border-4 border-white/50">
                <AvatarImage src={avatar} />
                <AvatarFallback>?</AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white mt-2"
                onClick={() => {
                  const randomSeed = Math.random().toString(36).substring(7)
                  setAvatar(`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${randomSeed}`)
                }}
              >
                Change Avatar
              </Button>
            </div>

            {/* Nickname input */}
            <div>
              <Label htmlFor="nickname" className="text-white text-sm font-medium">
                Nickname
              </Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your nickname"
                className="mt-2 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && nickname.trim()) {
                    joinRoom()
                  }
                }}
              />
            </div>

            {/* Join button */}
            <Button
              onClick={joinRoom}
              disabled={!nickname.trim() || isJoining}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3"
            >
              {isJoining ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div>
                  Joining...
                </div>
              ) : (
                "Join Room"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
