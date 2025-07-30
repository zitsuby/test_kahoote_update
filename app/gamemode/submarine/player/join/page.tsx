"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Dice6, Users } from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"

export default function PlayerJoinPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const roomCode = searchParams.get("code") || ""

  const [nickname, setNickname] = useState("")
  const [avatar, setAvatar] = useState("https://api.dicebear.com/7.x/avataaars/svg?seed=1")
  const [isJoining, setIsJoining] = useState(false)

  const generateRandomAvatar = () => {
    const seed = Math.random().toString(36).substring(7)
    setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`)
  }

  const joinRoom = async () => {
    if (!nickname.trim()) return

    setIsJoining(true)
    const waitingUrl = `/player/waiting/${roomCode}?nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`

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
    const waitingUrl = `/player/waiting/${roomCode}?nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`

    // Prefetch waiting page
    router.prefetch(waitingUrl)

    // Show transition overlay
    const transitionEl = document.getElementById("page-transition")
    if (transitionEl) {
      transitionEl.classList.add("page-transition-enter")
    }

    // Navigate immediately
    setTimeout(() => {
      router.push(waitingUrl)
    }, 300)
  }, [roomCode, router])

  // Loading screen while redirecting
  if (isJoining) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mx-auto mb-4"></div>
          <p className="text-white text-xl">Joining as Kizuko...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Join Game</h1>
            <p className="text-blue-200">Room: {roomCode}</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Avatar Selection */}
          <Card className="bg-white/10 backdrop-blur-sm border-blue-300/30">
            <CardHeader>
              <CardTitle className="text-white text-center">Pilih Avatar</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <Avatar className="w-24 h-24 mx-auto">
                <AvatarImage src={avatar || "/placeholder.svg"} />
                <AvatarFallback>?</AvatarFallback>
              </Avatar>
              <Button
                onClick={generateRandomAvatar}
                variant="outline"
                className="bg-white/10 border-blue-300/30 text-white hover:bg-white/20"
              >
                <Dice6 className="w-4 h-4 mr-2" />
                Acak Avatar
              </Button>
            </CardContent>
          </Card>

          {/* Nickname Input */}
          <Card className="bg-white/10 backdrop-blur-sm border-blue-300/30">
            <CardHeader>
              <CardTitle className="text-white">Nickname</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nickname" className="text-white">
                  Masukkan nickname Anda
                </Label>
                <Input
                  id="nickname"
                  placeholder="Contoh: Captain_Blue"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="bg-white/10 border-blue-300/30 text-white placeholder:text-blue-300"
                  maxLength={20}
                />
              </div>
              <p className="text-sm text-blue-200">Nickname akan terlihat oleh pemain lain</p>
            </CardContent>
          </Card>

          {/* Join Button */}
          <Button
            onClick={joinRoom}
            disabled={!nickname.trim() || isJoining}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 text-lg"
          >
            {isJoining ? (
              "Bergabung..."
            ) : (
              <>
                <Users className="w-5 h-5 mr-2" />
                Bergabung ke Room
              </>
            )}
          </Button>

          {/* Room Info */}
          <Card className="bg-white/5 backdrop-blur-sm border-blue-300/20">
            <CardContent className="p-4 text-center">
              <p className="text-blue-200 text-sm">
                Pastikan kode room <span className="font-mono font-bold text-white">{roomCode}</span> sudah benar
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
