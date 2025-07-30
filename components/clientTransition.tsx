// components/ClientTransition.tsx
"use client"
import { useEffect } from "react"

export default function ClientTransition() {
  useEffect(() => {
    const transitionEl = document.getElementById("page-transition")
    if (transitionEl) {
      transitionEl.classList.remove("page-transition-enter")
    }
  }, [])

  return null
}
