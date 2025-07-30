"use client"

import { useEffect, useState } from "react"

interface SubmarineAnimationProps {
  submarineProgress: number
  sharkDistance: number
  level: number
  isGameOver?: boolean
}

export function SubmarineAnimation({
  submarineProgress,
  sharkDistance,
  level,
  isGameOver = false,
}: SubmarineAnimationProps) {
  const [animationClass, setAnimationClass] = useState("")

  useEffect(() => {
    if (isGameOver) {
      setAnimationClass("animate-pulse")
    } else if (sharkDistance - submarineProgress < 20) {
      setAnimationClass("animate-bounce")
    } else {
      setAnimationClass("")
    }
  }, [submarineProgress, sharkDistance, isGameOver])

  const getSharkSpeed = (level: number) => {
    switch (level) {
      case 1:
        return "animate-pulse"
      case 2:
        return "animate-bounce"
      case 3:
        return "animate-ping"
      default:
        return "animate-pulse"
    }
  }

  return (
    <div className="relative h-40 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 rounded-lg overflow-hidden">
      {/* Ocean background effects */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-2 left-4 w-2 h-2 bg-blue-300 rounded-full animate-ping"></div>
        <div className="absolute top-8 right-8 w-1 h-1 bg-blue-200 rounded-full animate-pulse"></div>
        <div className="absolute bottom-4 left-12 w-3 h-3 bg-blue-400 rounded-full animate-bounce"></div>
      </div>

      {/* Submarine */}
      <div
        className={`absolute top-1/2 transform -translate-y-1/2 transition-all duration-1000 ${animationClass}`}
        style={{ left: `${Math.min(submarineProgress, 90)}%` }}
      >
        <div className="relative">
          <div className="w-16 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-2xl">🚢</span>
          </div>
          {/* Submarine trail */}
          <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-8 h-1 bg-white/30 rounded-full"></div>
        </div>
      </div>

      {/* Shark */}
      <div
        className={`absolute top-1/2 transform -translate-y-1/2 transition-all duration-1000 ${getSharkSpeed(level)}`}
        style={{ left: `${Math.max(sharkDistance, 5)}%` }}
      >
        <div className="relative">
          <div className="w-20 h-12 flex items-center justify-center">
            <span className="text-3xl">🦈</span>
          </div>
          {/* Danger indicator when close */}
          {sharkDistance - submarineProgress < 25 && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
              <span className="text-red-400 text-xs font-bold animate-pulse">⚠️</span>
            </div>
          )}
        </div>
      </div>

      {/* Finish Line */}
      <div className="absolute right-0 top-0 h-full w-2 bg-green-400 shadow-lg">
        <div className="absolute -left-8 top-1/2 transform -translate-y-1/2 text-green-300 text-xs font-bold">
          FINISH
        </div>
      </div>

      {/* Level indicator */}
      <div className="absolute top-2 left-2 bg-black/50 rounded px-2 py-1">
        <span className="text-white text-xs font-bold">Level {level}</span>
      </div>

      {/* Distance warning */}
      {sharkDistance - submarineProgress < 20 && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-red-500/80 rounded px-3 py-1">
          <span className="text-white text-xs font-bold animate-pulse">BAHAYA! Ikan semakin dekat!</span>
        </div>
      )}
    </div>
  )
}
