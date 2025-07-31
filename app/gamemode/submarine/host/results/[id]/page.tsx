"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trophy, Medal, Zap, Clock, Target, Home, RotateCcw } from "lucide-react"
import { useParams } from "next/navigation"
import Link from "next/link"

// Dummy results data
const resultsData = {
  gameStats: {
    totalTime: 600,
    timeElapsed: 480,
    totalQuestions: 15,
    totalProgress: 8,
    level: 3,
  },
  players: [
    {
      id: "1",
      nickname: "Captain_Blue",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=1",
      progress: 4,
      correctAnswers: 12,
      timeToComplete: 420,
      rank: 1,
    },
    {
      id: "2",
      nickname: "SeaExplorer",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=2",
      progress: 3,
      correctAnswers: 9,
      timeToComplete: 450,
      rank: 2,
    },
    {
      id: "3",
      nickname: "DeepDiver",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=3",
      progress: 1,
      correctAnswers: 6,
      timeToComplete: 480,
      rank: 3,
    },
  ],
  awards: {
    fastest: "Captain_Blue",
    mostCorrect: "Captain_Blue",
    mostProgress: "Captain_Blue",
    teamPlayer: "SeaExplorer",
  },
}

export default function HostResultsPage() {
  const params = useParams()
  const roomCode = params.code as string

  const [showConfetti, setShowConfetti] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />
      default:
        return <div className="w-6 h-6 flex items-center justify-center text-white font-bold">{rank}</div>
    }
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "border-yellow-400/50 bg-yellow-400/10"
      case 2:
        return "border-gray-400/50 bg-gray-400/10"
      case 3:
        return "border-amber-600/50 bg-amber-600/10"
      default:
        return "border-white/30 bg-white/5"
    }
  }

  return (
    <div className="min-h-screen bg-deep-ocean relative overflow-hidden">
      {/* Confetti effect */}
      {/* {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-30">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-yellow-400 animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )} */}

      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('/textures/background.webp')`,
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

      <div className="relative z-20 min-h-screen p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 animate-slide-in-up">
            <div className="flex items-center justify-center gap-4 mb-6">
              <Trophy className="w-16 h-16 text-yellow-400 animate-glow" />
              <h1 className="text-6xl font-bold bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
                Game Results
              </h1>
              <Trophy className="w-16 h-16 text-yellow-400 animate-glow" />
            </div>
            <p className="text-xl text-blue-100/80">Submarine Squad - Room {roomCode}</p>
          </div>

          {/* Game Stats */}
          <div className="grid md:grid-cols-4 gap-6 mb-12 animate-slide-in-left">
            <Card className="glass border-cyan-300/30">
              <CardContent className="p-6 text-center">
                <Clock className="w-8 h-8 text-cyan-300 mx-auto mb-3" />
                <p className="text-2xl font-bold text-white">{formatTime(resultsData.gameStats.timeElapsed)}</p>
                <p className="text-blue-200/80">Time Played</p>
              </CardContent>
            </Card>

            <Card className="glass border-purple-300/30">
              <CardContent className="p-6 text-center">
                <Target className="w-8 h-8 text-purple-300 mx-auto mb-3" />
                <p className="text-2xl font-bold text-white">{resultsData.gameStats.totalQuestions}</p>
                <p className="text-blue-200/80">Questions</p>
              </CardContent>
            </Card>

            <Card className="glass border-green-300/30">
              <CardContent className="p-6 text-center">
                <Zap className="w-8 h-8 text-green-300 mx-auto mb-3" />
                <p className="text-2xl font-bold text-white">{resultsData.gameStats.totalProgress}</p>
                <p className="text-blue-200/80">Total Progress</p>
              </CardContent>
            </Card>

            <Card className="glass border-yellow-300/30">
              <CardContent className="p-6 text-center">
                <Trophy className="w-8 h-8 text-yellow-300 mx-auto mb-3" />
                <p className="text-2xl font-bold text-white">Level {resultsData.gameStats.level}</p>
                <p className="text-blue-200/80">Reached</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Player Rankings */}
            <div className="lg:col-span-2 animate-slide-in-right">
              <Card className="glass border-white/20">
                <CardHeader>
                  <CardTitle className="text-white text-2xl flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                    Player Rankings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {resultsData.players.map((player) => (
                    <div
                      key={player.id}
                      className={`p-4 rounded-xl border transition-all duration-300 ${getRankColor(player.rank)}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          {getRankIcon(player.rank)}
                          <Avatar className="w-12 h-12 border-2 border-white/50">
                            <AvatarImage src={player.avatar || "/placeholder.svg"} />
                            <AvatarFallback>{player.nickname[0]}</AvatarFallback>
                          </Avatar>
                        </div>

                        <div className="flex-1">
                          <p className="text-white font-semibold text-lg">{player.nickname}</p>
                          <div className="flex items-center gap-4 text-sm text-blue-200/80">
                            <span>Progress: {player.progress}</span>
                            <span>Correct: {player.correctAnswers}</span>
                            {/* <span>Time: {formatTime(player.timeToComplete)}</span> */}
                          </div>
                        </div>

                        <Badge
                          className={`${
                            player.rank === 1
                              ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                              : player.rank === 2
                                ? "bg-gray-500/20 text-gray-300 border-gray-500/30"
                                : player.rank === 3
                                  ? "bg-amber-600/20 text-amber-300 border-amber-600/30"
                                  : "bg-white/10 text-white border-white/30"
                          }`}
                        >
                          #{player.rank}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Awards */}
            <div className="animate-fade-in">
              <Card className="glass border-yellow-300/30">
                <CardHeader>
                  <CardTitle className="text-white text-2xl flex items-center gap-3">
                    <Medal className="w-6 h-6 text-yellow-400" />
                    Special Awards
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="p-3 bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 rounded-lg border border-yellow-500/30">
                      <p className="text-yellow-300 font-semibold">🏃‍♂️ Fastest Player</p>
                      <p className="text-white">{resultsData.awards.fastest}</p>
                    </div>

                    <div className="p-3 bg-gradient-to-r from-green-500/20 to-green-600/20 rounded-lg border border-green-500/30">
                      <p className="text-green-300 font-semibold">🎯 Most Accurate</p>
                      <p className="text-white">{resultsData.awards.mostCorrect}</p>
                    </div>

                    <div className="p-3 bg-gradient-to-r from-purple-500/20 to-purple-600/20 rounded-lg border border-purple-500/30">
                      <p className="text-purple-300 font-semibold">⚡ Most Progress</p>
                      <p className="text-white">{resultsData.awards.mostProgress}</p>
                    </div>

                    <div className="p-3 bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-lg border border-blue-500/30">
                      <p className="text-blue-300 font-semibold">🤝 Team Player</p>
                      <p className="text-white">{resultsData.awards.teamPlayer}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 mt-12 animate-scale-in">
            <Link href="/host/setup" prefetch>
              <Button className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-4 text-lg">
                <RotateCcw className="w-5 h-5 mr-2" />
                Play Again
              </Button>
            </Link>

            <Link href="/" prefetch>
              <Button
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 px-8 py-4 text-lg"
              >
                <Home className="w-5 h-5 mr-2" />
                Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
