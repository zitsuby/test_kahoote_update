"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { ArrowLeft, Clock, BookOpen, Play, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

// Dummy quiz data
const quizSets = [
  { id: "math", name: "Matematika Dasar", questions: 20 },
  { id: "science", name: "Sains & Alam", questions: 25 },
  { id: "history", name: "Sejarah Indonesia", questions: 30 },
  { id: "general", name: "Pengetahuan Umum", questions: 35 },
]

export default function HostSetupPage() {
  const router = useRouter()
  const [selectedQuiz, setSelectedQuiz] = useState("")
  const [gameTime, setGameTime] = useState([10]) // minutes

  const handleCreateRoom = () => {
    if (!selectedQuiz) return

    // Generate room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const roomUrl = `/host/room/${roomCode}?quiz=${selectedQuiz}&time=${gameTime[0]}`

    // Prefetch the room page
    router.prefetch(roomUrl)

    // Show transition overlay
    const transitionEl = document.getElementById("page-transition")
    if (transitionEl) {
      transitionEl.classList.add("page-transition-enter")
    }

    // Navigate to waiting room with delay for smooth transition
    setTimeout(() => {
      router.push(roomUrl)
    }, 300)
  }

  return (
    <div className="min-h-screen bg-deep-ocean relative overflow-hidden">
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

      <div className="relative z-10 min-h-screen p-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-6 mb-12 animate-slide-in-up">
            <Link href="/">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 rounded-xl p-3 transition-all duration-300"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Setup Game</h1>
              <p className="text-blue-200/80 text-lg">Konfigurasi permainan Submarine Squad</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Quiz Selection */}
            <div className="animate-slide-in-left">
              <Card className="glass border-cyan-300/30 hover:border-cyan-300/50 transition-all duration-500">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-3 text-2xl">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    Pilih Set Soal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
                    <SelectTrigger className="glass border-cyan-300/30 text-white text-lg py-4 rounded-xl focus:border-cyan-400/50 transition-all duration-300">
                      <SelectValue placeholder="Pilih kategori soal..." />
                    </SelectTrigger>
                    <SelectContent className="glass-dark border-cyan-300/30">
                      {quizSets.map((quiz) => (
                        <SelectItem key={quiz.id} value={quiz.id} className="text-white hover:bg-white/10 rounded-lg">
                          {quiz.name} ({quiz.questions} soal)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>

            {/* Game Duration */}
            <div className="animate-slide-in-right">
              <Card className="glass border-purple-300/30 hover:border-purple-300/50 transition-all duration-500">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-3 text-2xl">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    Durasi Permainan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-white text-lg font-medium">
                      Waktu: <span className="text-cyan-300 font-bold">{gameTime[0]} menit</span>
                    </Label>
                    <Slider value={gameTime} onValueChange={setGameTime} max={30} min={5} step={1} className="w-full" />
                  </div>
                  {/* <div className="space-y-3 text-blue-200/70">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <p>5-10 menit: Game cepat</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <p>10-20 menit: Game sedang</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <p>20-30 menit: Game panjang</p>
                    </div>
                  </div> */}
                </CardContent>
              </Card>
            </div>

            {/* Create Room Button */}
            <div className="animate-fade-in">
              <Button
                onClick={handleCreateRoom}
                disabled={!selectedQuiz}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 text-white py-6 text-xl font-semibold rounded-xl transition-all duration-300 group"
              >
                <Play className="w-6 h-6 mr-3" />
                Buat Room Game
                <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
