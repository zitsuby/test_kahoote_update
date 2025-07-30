"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Settings, Volume2, VolumeX } from "lucide-react"
import { FullscreenButton } from "@/app/host/room/[code]/page"

// Emoji objects for the image challenge
const emojiObjects = [
  { emoji: "🍎", name: "Apple" },
  { emoji: "🚗", name: "Car" },
  { emoji: "📱", name: "Phone" },
  { emoji: "⚽", name: "Ball" },
  { emoji: "🏠", name: "House" },
  { emoji: "📚", name: "Book" },
  { emoji: "☂️", name: "Umbrella" },
  { emoji: "👟", name: "Shoe" },
  { emoji: "🎸", name: "Guitar" },
  { emoji: "💻", name: "Laptop" },
  { emoji: "🍕", name: "Pizza" },
  { emoji: "🌸", name: "Flower" },
  { emoji: "🎒", name: "Backpack" },
  { emoji: "⌚", name: "Watch" },
  { emoji: "🔑", name: "Key" },
  { emoji: "🍌", name: "Banana" },
  { emoji: "🚲", name: "Bicycle" },
  { emoji: "📷", name: "Camera" },
  { emoji: "🎯", name: "Target" },
  { emoji: "🧸", name: "Teddy Bear" },
]

// All 9 questions
const allQuestions = [
  { id: 1, text: "Berapa hasil dari 15 + 27?", options: ["42", "41", "43", "40"], correctAnswer: 0 },
  { id: 2, text: "Apa ibu kota Indonesia?", options: ["Jakarta", "Bandung", "Surabaya", "Medan"], correctAnswer: 0 },
  { id: 3, text: "Berapa hasil dari 8 × 7?", options: ["54", "56", "58", "52"], correctAnswer: 1 },
  {
    id: 4,
    text: "Siapa presiden pertama Indonesia?",
    options: ["Soekarno", "Soeharto", "Habibie", "Megawati"],
    correctAnswer: 0,
  },
  { id: 5, text: "Berapa hasil dari 144 ÷ 12?", options: ["11", "12", "13", "14"], correctAnswer: 1 },
  {
    id: 6,
    text: "Planet terdekat dengan matahari?",
    options: ["Venus", "Merkurius", "Mars", "Bumi"],
    correctAnswer: 1,
  },
  { id: 7, text: "Berapa hasil dari 9²?", options: ["81", "72", "90", "63"], correctAnswer: 0 },
  { id: 8, text: "Benua terbesar di dunia?", options: ["Afrika", "Amerika", "Asia", "Eropa"], correctAnswer: 2 },
  { id: 9, text: "Berapa hasil dari 15 × 4?", options: ["50", "55", "60", "65"], correctAnswer: 2 },
]

export default function PlayerGamePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const roomCode = params.code as string
  const nickname = searchParams.get("nickname") || ""
  const avatar = searchParams.get("avatar") || ""

  // Game state
  const [timeRemaining, setTimeRemaining] = useState(120)
  const [gamePhase, setGamePhase] = useState<"questions" | "hold" | "loading" | "images">("questions")
  const [isCaptain, setIsCaptain] = useState(Math.random() < 0.5)

  // Global fire charges - 3 charges needed for hold button
  const [fireCharges, setFireCharges] = useState(0) // 0-3 charges
  const [holdButtonUnlocked, setHoldButtonUnlocked] = useState(false)
  const [holdButtonUsed, setHoldButtonUsed] = useState(0) // Track how many times hold button was used

  // Question management - cycle through all questions
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0) // 0-8 for all questions
  const [wrongQuestions, setWrongQuestions] = useState<number[]>([]) // Track wrong questions
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isRetryPhase, setIsRetryPhase] = useState(false) // Retrying wrong questions
  const [questionOrder, setQuestionOrder] = useState([0, 1, 2, 3, 4, 5, 6, 7, 8]) // Current order of questions
  const [completedCycles, setCompletedCycles] = useState(0)

  // Hold button state
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)

  // Image challenge state
  const [imageTimer, setImageTimer] = useState(15)
  const [currentImageChallenge, setCurrentImageChallenge] = useState({
    correctEmoji: "🍎",
    options: ["🍎", "🚗", "📱", "⚽"],
  })

  // Timer countdown effect
  useEffect(() => {
    if (timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining])

  useEffect(() => {
    // Prefetch halaman result (biar cepat saat waktunya habis)
    router.prefetch(
      `/player/results/${roomCode}?nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`
    )

    // Kalau waktu habis → redirect ke results
    if (timeRemaining <= 0) {
      router.push(
        `/player/results/${roomCode}?nickname=${encodeURIComponent(nickname)}&avatar=${encodeURIComponent(avatar)}`
      )
    }
  }, [timeRemaining, roomCode, nickname, avatar, router])



  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Generate random image challenge
  const generateImageChallenge = () => {
    const shuffled = [...emojiObjects].sort(() => Math.random() - 0.5)
    const correct = shuffled[0]
    const wrong = shuffled.slice(1, 4)
    const options = [correct, ...wrong].sort(() => Math.random() - 0.5)

    setCurrentImageChallenge({
      correctEmoji: correct.emoji,
      options: options.map((obj) => obj.emoji),
    })
  }

  // Get current question
  const getCurrentQuestion = () => {
    if (isRetryPhase) {
      // During retry, get question from wrong questions list
      const wrongQuestionIndex = wrongQuestions[currentQuestionIndex]
      return allQuestions[wrongQuestionIndex]
    } else {
      // Normal phase, get question from current order
      const questionIndex = questionOrder[currentQuestionIndex]
      return allQuestions[questionIndex]
    }
  }

  // Move to next question
  const moveToNextQuestion = () => {
    if (isRetryPhase) {
      // In retry phase
      if (currentQuestionIndex < wrongQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1)
      } else {
        // Finished retrying all wrong questions, start new cycle
        setIsRetryPhase(false)
        setWrongQuestions([])
        setCurrentQuestionIndex(0)
        setCompletedCycles((prev) => prev + 1)

        // Shuffle questions for next cycle
        const shuffled = [...questionOrder].sort(() => Math.random() - 0.5)
        setQuestionOrder(shuffled)
      }
    } else {
      // Normal phase
      if (currentQuestionIndex < questionOrder.length - 1) {
        // Move to next question
        setCurrentQuestionIndex(currentQuestionIndex + 1)
      } else {
        // Finished all questions in cycle
        if (wrongQuestions.length > 0) {
          // Have wrong questions, start retry phase
          setIsRetryPhase(true)
          setCurrentQuestionIndex(0)
        } else {
          // No wrong questions, start new cycle
          setCurrentQuestionIndex(0)
          setCompletedCycles((prev) => prev + 1)

          // Shuffle questions for next cycle
          const shuffled = [...questionOrder].sort(() => Math.random() - 0.5)
          setQuestionOrder(shuffled)
        }
      }
    }
  }

  // Continue after hold button or image challenge
  const continueGame = () => {
    setHoldButtonUnlocked(false)
    setFireCharges(0)
    setGamePhase("questions")
  }

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswer !== null) return // Prevent double click

    setSelectedAnswer(index)
    const currentQuestion = getCurrentQuestion()

    // Check if correct
    if (index === currentQuestion.correctAnswer) {
      // Correct answer - add fire charge (both normal and retry phase)
      const newCharges = Math.min(fireCharges + 1, 3)
      setFireCharges(newCharges)

      // Auto go to hold phase when reaching 3 charges
      if (newCharges === 3) {
        setTimeout(() => {
          setGamePhase("hold")
          setHoldButtonUnlocked(true)
        }, 1500) // Wait for answer feedback, then go to hold
      }
    } else {
      // Wrong answer - add to wrong questions list if not already there
      if (!isRetryPhase) {
        const questionIndex = questionOrder[currentQuestionIndex]
        if (!wrongQuestions.includes(questionIndex)) {
          setWrongQuestions([...wrongQuestions, questionIndex])
        }
      }
    }

    // Move to next question after delay
    setTimeout(() => {
      setSelectedAnswer(null)
      moveToNextQuestion()
    }, 1500)
  }

  // Hold button handlers
  const handleHoldStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (holdButtonUnlocked) {
      setIsHolding(true)
    }
  }

  const handleHoldEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsHolding(false)

    if (holdProgress >= 100 && holdButtonUnlocked) {
      setHoldProgress(0)
      setHoldButtonUsed((prev) => prev + 1)

      // Check if this is the second hold button use
      if (holdButtonUsed >= 1) {
        // Go to image challenge
        setGamePhase("loading")
        generateImageChallenge()
        setTimeout(() => {
          setGamePhase("images")
          setImageTimer(15)
        }, 2000)
      } else {
        // First hold button use, continue with questions
        continueGame()
      }
    }
  }

  // Global event listeners for hold button
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isHolding) {
        setIsHolding(false)
        if (holdProgress >= 100 && holdButtonUnlocked) {
          setHoldProgress(0)
          setHoldButtonUsed((prev) => prev + 1)

          if (holdButtonUsed >= 1) {
            setGamePhase("loading")
            generateImageChallenge()
            setTimeout(() => {
              setGamePhase("images")
              setImageTimer(15)
            }, 2000)
          } else {
            continueGame()
          }
        }
      }
    }

    const handleGlobalTouchEnd = () => {
      if (isHolding) {
        setIsHolding(false)
        if (holdProgress >= 100 && holdButtonUnlocked) {
          setHoldProgress(0)
          setHoldButtonUsed((prev) => prev + 1)

          if (holdButtonUsed >= 1) {
            setGamePhase("loading")
            generateImageChallenge()
            setTimeout(() => {
              setGamePhase("images")
              setImageTimer(15)
            }, 2000)
          } else {
            continueGame()
          }
        }
      }
    }

    document.addEventListener("mouseup", handleGlobalMouseUp)
    document.addEventListener("touchend", handleGlobalTouchEnd)

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp)
      document.removeEventListener("touchend", handleGlobalTouchEnd)
    }
  }, [isHolding, holdProgress, holdButtonUnlocked, holdButtonUsed])

  // Hold progress effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isHolding) {
      interval = setInterval(() => {
        setHoldProgress((prev) => Math.min(prev + 2, 100))
      }, 50)
    }
    return () => clearInterval(interval)
  }, [isHolding])

  // Answer button colors (Kahoot style)
  const getButtonColor = (index: number) => {
    const colors = [
      "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
      "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
      "bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700",
      "bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
    ]
    return colors[index] || "bg-gradient-to-br from-gray-500 to-gray-600"
  }

  const getButtonShape = (index: number) => {
    const shapes = ["△", "◆", "○", "□"]
    return shapes[index] || "?"
  }

  const currentQuestion = getCurrentQuestion()

  return (
    <div className="min-h-screen bg-deep-ocean relative overflow-hidden">
      <style jsx>{`
    @keyframes zoomIn {
      from {
        opacity: 0;
        transform: scale(0.3);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    @keyframes zoomOut {
      from {
        opacity: 1;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(0.3);
      }
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .animate-zoom-in {
      animation: zoomIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    
    .animate-zoom-out {
      animation: zoomOut 0.3s ease-in;
    }
    
    .animate-fade-in-up {
      animation: fadeInUp 0.5s ease-out;
    }
    
    .question-transition {
      transition: all 0.3s ease-in-out;
    }
  `}</style>
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
        className="absolute bottom-0 left-0 right-0 h-32 bg-repeat-x z-10 animate-bg-left-tb  "
        style={{
          backgroundImage: `url('/textures/texture-bottom.webp')`,
          backgroundSize: "auto 100%",
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

      <div className="relative z-20 min-h-screen flex flex-col">
        {/* Fixed Header at Top */}
        <div className="p-4 flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between animate-slide-in-up">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border-2 border-white shadow-2xl animate-glow">
                  <AvatarImage src={avatar || "/placeholder.svg"} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold text-lg">
                    {nickname[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-white font-semibold text-xl">{nickname}</p>
                  <Badge
                    variant="outline"
                    className="text-white border-cyan-300/50 bg-cyan-500/20 text-xs backdrop-blur-sm rounded-lg"
                  >
                    {roomCode}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center text-white gap-6">
                {/* 🔥 Charges */}
                <div className="flex items-center gap-2">
                  {[0, 1, 2].map((chargeIndex) => (
                    <div key={chargeIndex} className="flex flex-col items-center">
                      <div
                        className={`text-xl transition-all duration-700 transform ${fireCharges > chargeIndex
                          ? "filter drop-shadow-lg scale-110"
                          : "opacity-30 grayscale scale-100"
                          }`}
                      >
                        🔥
                      </div>
                    </div>
                  ))}
                </div>
                {/* ⏱️ Timer */}
                <span className="text-2xl font-mono font-bold">{formatTime(timeRemaining)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Centered Phase Content */}
        <div className="fixed inset-0 flex items-center justify-center z-30">
  <div className="w-full max-w-4xl text-center px-4">
            {/* Phase-based content */}
            {gamePhase === "questions" && currentQuestion && (
              <div key={`${currentQuestion.id}-${isRetryPhase ? "retry" : "normal"}`} className="animate-zoom-in">
                <Card
                  className={`glass border-purple-300/30 hover:border-purple-300/50 transition-all duration-500 transform hover:scale-[1.02] question-transition ${selectedAnswer !== null ? "animate-zoom-out" : ""
                    }`}
                >
                  <CardContent className="space-y-6 pt-6">
                    <div className="text-center mb-6">
                      <p className="text-2xl text-white font-medium break-words">{currentQuestion.text}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {currentQuestion.options.map((option, index) => (
                        <Button
                          key={index}
                          onClick={() => handleAnswerSelect(index)}
                          disabled={selectedAnswer !== null}
                          className={`p-6 text-left justify-start text-white font-semibold text-xl h-auto rounded-xl transition-all duration-300 ${getButtonColor(index)} ${selectedAnswer === index
                            ? index === currentQuestion.correctAnswer
                              ? "ring-4 ring-green-300 scale-105"
                              : "ring-4 ring-red-300 scale-105"
                            : "hover:scale-105"
                            }`}
                        >
                          <span className="text-3xl mr-4">{getButtonShape(index)}</span>
                          {option}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {gamePhase === "hold" && (
              <div className="animate-fade-in">
                <Card className="glass border-green-300/30 hover:border-green-300/50 transition-all duration-500">
                  <CardHeader>
                    <CardTitle className="text-white text-center text-2xl">Hold the Button!</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center space-y-6">
                    <div className="space-y-3">
                      <Progress value={holdProgress} className="h-6 bg-white/20 rounded-full" />
                      <p className="text-white text-xl font-bold">{Math.round(holdProgress)}%</p>
                    </div>
                    <button
                      onMouseDown={handleHoldStart}
                      onMouseUp={handleHoldEnd}
                      onTouchStart={handleHoldStart}
                      onTouchEnd={handleHoldEnd}
                      className={`w-48 h-48 rounded-full text-white text-3xl font-bold shadow-2xl transition-all duration-300 select-none ${holdButtonUnlocked
                        ? "bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:scale-110 animate-glow"
                        : "bg-gray-500 cursor-not-allowed opacity-50"
                        }`}
                      disabled={!holdButtonUnlocked || holdProgress >= 100}
                      style={{ userSelect: "none", WebkitUserSelect: "none" }}
                    >
                      {holdProgress >= 100 ? "✅" : holdButtonUnlocked ? "HOLD" : "LOCKED"}
                    </button>
                    {holdProgress >= 100 && (
                      <p className="text-green-300 font-semibold text-xl animate-scale-in">
                        {holdButtonUsed === 0 ? "🎉 Continuing questions..." : "🎉 Moving to image challenge..."}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {gamePhase === "loading" && (
              <div className="animate-fade-in">
                <Card className="glass border-blue-300/30">
                  <CardContent className="p-12 text-center">
                    <div className="animate-spin w-20 h-20 border-4 border-white/30 border-t-white rounded-full mx-auto mb-6"></div>
                    <p className="text-white text-3xl font-semibold mb-2">🎮 Preparing Image Challenge...</p>
                    <p className="text-blue-200/80 text-lg">Get ready for teamwork!</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {gamePhase === "images" && (
              <div className="animate-fade-in">
                <Card className="glass border-red-300/50 hover:border-red-300/70 transition-all duration-500 shadow-2xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-2xl flex items-center gap-3">🚨 IMAGE CHALLENGE</CardTitle>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-red-600/80 text-white text-xl px-4 py-2 animate-pulse">{imageTimer}s</Badge>
                        {/* Captain/Crew Toggle Button - Only during image phase */}
                        <Button
                          onClick={() => setIsCaptain(!isCaptain)}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-xs"
                        >
                          {isCaptain ? "Crew" : "Captain"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isCaptain ? (
                      <div className="text-center space-y-6">
                        <p className="text-yellow-300 text-2xl font-bold">👑 You are the CAPTAIN!</p>
                        <p className="text-white text-xl">Describe this object to your crew:</p>
                        <div className="bg-white/10 p-8 rounded-2xl border-2 border-yellow-400/50">
                          <div className="text-9xl mb-4">{currentImageChallenge.correctEmoji}</div>
                          <p className="text-white/80 text-lg">Use voice or gestures to help your crew!</p>
                        </div>
                        <p className="text-blue-200/80 text-lg">💡 Give hints without saying the exact name!</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <p className="text-cyan-300 text-2xl font-bold text-center">⚓ You are CREW!</p>
                        <p className="text-white text-xl text-center">
                          Listen to your captain and choose the correct object:
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          {currentImageChallenge.options.map((emoji, index) => (
                            <Button
                              key={index}
                              onClick={() => {
                                // Move back to questions after image challenge
                                setTimeout(() => {
                                  continueGame()
                                }, 1000)
                              }}
                              className={`p-5 text-white font-semibold text-xl h-auto rounded-xl transition-all duration-300 ${getButtonColor(index)} hover:scale-105 flex flex-col items-center gap-3`}
                            >
                              <span className="text-6xl">{emoji}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}