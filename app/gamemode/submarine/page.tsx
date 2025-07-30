"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Gamepad2, Users, Waves, Play, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const [joinCode, setJoinCode] = useState("")
  const router = useRouter()

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
        <div
          className="absolute bottom-20 right-40 w-5 h-5 bg-blue-200/30 rounded-full animate-float"
          style={{ animationDelay: "0.5s" }}
        ></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-6xl w-full">
          {/* Header */}
          <div className="text-center mb-16 animate-slide-in-up">
            <div className="flex items-center justify-center gap-4 mb-6">
              <Waves className="w-16 h-16 text-cyan-300 animate-wave" />
              <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                Submarine Squad
              </h1>
              <Waves className="w-16 h-16 text-cyan-300 animate-wave" style={{ animationDelay: "2s" }} />
            </div>
            <p className="text-xl md:text-2xl text-blue-100/80 max-w-3xl mx-auto leading-relaxed">
              Kerja sama tim untuk mengendalikan kapal selam dari kejaran ikan raksasa!
            </p>
          </div>

          {/* Game Options */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {/* Host Game */}
            <div className="animate-slide-in-left">
              <Card className="glass border-cyan-300/30 hover:border-cyan-300/50 transition-all duration-500 group hover:scale-105">
                <CardHeader className="text-center pb-6">
                  <div className="mx-auto mb-6 p-4 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl w-fit group-hover:animate-glow transition-all duration-300">
                    <Gamepad2 className="w-10 h-10 text-white" />
                  </div>
                  <CardTitle className="text-3xl text-white mb-2">Host Game</CardTitle>
                  <CardDescription className="text-blue-200/80 text-lg">
                    Buat room baru dan undang pemain untuk bergabung
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Link href="/host/setup" className="block" prefetch>
                    <Button className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold py-4 text-lg rounded-xl transition-all duration-300 group">
                      <Play className="w-5 h-5 mr-2" />
                      Mulai sebagai Host
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Join Game */}
            <div className="animate-slide-in-right">
              <Card className="glass border-purple-300/30 hover:border-purple-300/50 transition-all duration-500 group hover:scale-105">
                <CardHeader className="text-center pb-6">
                  <div className="mx-auto mb-6 p-4 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl w-fit group-hover:animate-glow transition-all duration-300">
                    <Users className="w-10 h-10 text-white" />
                  </div>
                  <CardTitle className="text-3xl text-white mb-2">Join Game</CardTitle>
                  <CardDescription className="text-blue-200/80 text-lg">
                    Bergabung dengan room yang sudah ada
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Label htmlFor="joinCode" className="text-white text-lg font-medium">
                      Kode Room
                    </Label>
                    <Input
                      id="joinCode"
                      placeholder="Masukkan kode room..."
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      className="glass border-purple-300/30 text-white placeholder:text-blue-300/60 text-lg py-4 rounded-xl focus:border-purple-400/50 transition-all duration-300"
                      maxLength={6}
                    />
                  </div>
                  <div>
                    <Button
                      className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-semibold py-4 text-lg rounded-xl transition-all duration-300 group"
                      disabled={joinCode.length !== 6}
                      onClick={() => {
                        if (joinCode.length === 6) {
                          // Data statis
                          const nickname = "Huda"
                          const avatar = "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=MHuda"

                          // Langsung ke waiting room, skip join page
                          const waitingUrl = `/player/waiting/${joinCode}?nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`

                          // Prefetch waiting page
                          router.prefetch(waitingUrl)

                          // Show transition overlay
                          const transitionEl = document.getElementById("page-transition")
                          if (transitionEl) {
                            transitionEl.classList.add("page-transition-enter")
                          }

                          // Navigate with delay for smooth transition
                          setTimeout(() => {
                            router.push(waitingUrl)
                          }, 300)
                        }
                      }}
                    >
                      <Users className="w-5 h-5 mr-2" />
                      Bergabung ke Game
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Game Rules */}
          <div className="animate-fade-in">
            <Card className="glass border-blue-300/20 hover:border-blue-300/30 transition-all duration-500">
              <CardHeader>
                <CardTitle className="text-2xl text-white text-center mb-4">Cara Bermain</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8 text-blue-200/80">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-white text-xl mb-4 flex items-center gap-2">
                      <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>
                      Tujuan Game
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-cyan-300 rounded-full mt-2"></div>
                        <p>Kapal selam harus kabur dari ikan raksasa</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-cyan-300 rounded-full mt-2"></div>
                        <p>Kerjasama tim untuk naik level</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-cyan-300 rounded-full mt-2"></div>
                        <p>Jawab 3 soal benar untuk 1 progress</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-cyan-300 rounded-full mt-2"></div>
                        <p>Semakin tinggi level, semakin cepat ikan mengejar</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-white text-xl mb-4 flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                      Mini Game
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-purple-300 rounded-full mt-2"></div>
                        <p>Captain memberikan instruksi gambar</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-purple-300 rounded-full mt-2"></div>
                        <p>Crew memilih gambar yang tepat</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-purple-300 rounded-full mt-2"></div>
                        <p>3 gambar benar untuk naik level</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-purple-300 rounded-full mt-2"></div>
                        <p>Waktu terbatas setiap level</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
