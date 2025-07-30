"use client";

import { motion } from "framer-motion";

export function LoadingAnimation({
  variant = "default",
  message = "Memuat...",
  size = "md"
}: {
  variant?: "default" | "quiz" | "game" | "minimal";
  message?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16"
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {variant !== "minimal" && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className={`${sizeClasses[size]} border-4 border-white/30 border-t-white rounded-full`}
        />
      )}
      
      {variant === "minimal" && (
        <div className="flex space-x-2">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -10, 0] }}
              transition={{ 
                duration: 1.2, 
                repeat: Infinity, 
                delay: i * 0.2 
              }}
              className="w-3 h-3 bg-white rounded-full"
            />
          ))}
        </div>
      )}
      
      {variant !== "minimal" && (
        <p className="text-white font-medium">{message}</p>
      )}
    </div>
  );
}