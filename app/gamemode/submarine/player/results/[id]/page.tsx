"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trophy, Target, Zap, Clock, Home, RotateCcw, Star, Rocket } from "lucide-react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"

// Dummy player results data
const playerResultsData = {
  playerStats: {
    progress: 2,
    correctAnswers: 9,
    correctImages: 7,
    level: 3,
    totalImages: 8,
    timeToComplete: 420,
    rank: 2,
    totalPlayers: 4,
  },
  achievements: [
    { id: 1, name: "Quick Thinker", description: "Answered 5 questions in under 30 seconds", icon: "⚡" },
    { id: 2, name: "Steady Progress", description: "Collected 3 progress points", icon: "📈" },
  ],
  personalBests: {
    fastestAnswer: 3.2,
    longestStreak: 5,
    accuracyRate: 75,
  },
}

export default function PlayerResultsPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const roomCode = params.code as string
  const nickname = searchParams.get("nickname") || ""
  const avatar = searchParams.get("avatar") || ""

  const [showCelebration, setShowCelebration] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowCelebration(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getRankMessage = (rank: number, total: number) => {
    if (rank === 1) return "🏆 Champion!"
    if (rank === 2) return "🥈 Great job!"
    if (rank === 3) return "🥉 Well done!"
    if (rank <= total / 2) return "👍 Good effort!"
    return "💪 Keep trying!"
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "from-yellow-400 to-yellow-600"
      case 2:
        return "from-gray-400 to-gray-600"
      case 3:
        return "from-amber-500 to-amber-700"
      default:
        return "from-blue-400 to-blue-600"
    }
  }

  return (
    <div className="min-h-screen bg-deep-ocean relative overflow-hidden">
      {/* Celebration effect */}
      {/* {showCelebration && (
        <div className="absolute inset-0 pointer-events-none z-30">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              {["🎉", "⭐", "🏆", "🎊", "✨"][Math.floor(Math.random() * 5)]}
            </div>
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
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 animate-slide-in-up">
            <div className="flex items-center justify-center gap-4 mb-6">
              <Avatar className="w-20 h-20 border-2 border-white shadow-2xl">
                <AvatarImage src={avatar || "/placeholder.svg"} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold text-2xl">
                  {nickname[0]}
                </AvatarFallback>
              </Avatar>
            </div>
            <h1 className="text-5xl font-bold text-white mb-2">{nickname}</h1>
            <p className="text-xl text-blue-100/80 mb-4">Your Game Results</p>
            <Badge variant="outline" className="text-white border-cyan-300/50 bg-cyan-500/20 backdrop-blur-sm">
              Room: {roomCode}
            </Badge>
          </div>

          {/* Rank Card */}
          <div className="mb-8 animate-slide-in-left">
            <Card
              className={`glass border-white/30 bg-gradient-to-r ${getRankColor(playerResultsData.playerStats.rank)}/10`}
            >
              <CardContent className="p-8 text-center">
                <div className="text-6xl mb-4">
                  {playerResultsData.playerStats.rank === 1
                    ? "🏆"
                    : playerResultsData.playerStats.rank === 2
                      ? "🥈"
                      : playerResultsData.playerStats.rank === 3
                        ? "🥉"
                        : "🏅"}
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Rank #{playerResultsData.playerStats.rank} of {playerResultsData.playerStats.totalPlayers}
                </h2>
                <p className="text-xl text-white/80">
                  {getRankMessage(playerResultsData.playerStats.rank, playerResultsData.playerStats.totalPlayers)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-6 mb-8 animate-slide-in-right">
            <Card className="glass border-green-300/30">
              <CardContent className="p-6 text-center">
                <Zap className="w-8 h-8 text-green-300 mx-auto mb-3" />
                <p className="text-3xl font-bold text-white">{playerResultsData.playerStats.progress}</p>
                <p className="text-blue-200/80">Progress</p>
              </CardContent>
            </Card>

            <Card className="glass border-purple-300/30">
              <CardContent className="p-6 text-center">
                <Rocket className="w-8 h-8 text-purple-300 mx-auto mb-3" />
                <p className="text-3xl font-bold text-white">
                  {playerResultsData.playerStats.level}
                </p>
                <p className="text-blue-200/80">Level</p>
              </CardContent>
            </Card>

            {/* <Card className="glass border-orange-300/30">
              <CardContent className="p-6 text-center">
                <div className="w-8 h-8 text-orange-300 mx-auto mb-3 text-2xl">🖼️</div>
                <p className="text-3xl font-bold text-white">
                  {playerResultsData.playerStats.correctImages}/{playerResultsData.playerStats.totalImages}
                </p>
                <p className="text-blue-200/80">Images</p>
              </CardContent>
            </Card> */}

            <Card className="glass border-cyan-300/30">
              <CardContent className="p-6 text-center">
                <Clock className="w-8 h-8 text-cyan-300 mx-auto mb-3" />
                <p className="text-3xl font-bold text-white">
                  {formatTime(playerResultsData.playerStats.timeToComplete)}
                </p>
                <p className="text-blue-200/80">Time</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Achievements */}
            <div className="animate-fade-in">
              <Card className="glass border-yellow-300/30">
                <CardHeader>
                  <CardTitle className="text-white text-2xl flex items-center gap-3">
                    <Star className="w-6 h-6 text-yellow-400" />
                    Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {playerResultsData.achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className="p-4 bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 rounded-lg border border-yellow-500/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{achievement.icon}</div>
                        <div>
                          <p className="text-yellow-300 font-semibold">{achievement.name}</p>
                          <p className="text-white/80 text-sm">{achievement.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Personal Bests */}
            <div className="animate-fade-in">
              <Card className="glass border-blue-300/30">
                <CardHeader>
                  <CardTitle className="text-white text-2xl flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-blue-400" />
                    Personal Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-blue-200">Fastest Answer</span>
                      <span className="text-white font-bold">{playerResultsData.personalBests.fastestAnswer}s</span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-blue-200">Longest Streak</span>
                      <span className="text-white font-bold">{playerResultsData.personalBests.longestStreak}</span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-blue-200">Accuracy Rate</span>
                      <span className="text-white font-bold">{playerResultsData.personalBests.accuracyRate}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 mt-12 animate-scale-in">

            <Link href="/">
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
