"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function WaitingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('Player waiting error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#105981] via-[#09799E] to-[#58B8CE] flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops! Ada Masalah</h2>
        <p className="text-gray-600 mb-6">
          Terjadi kesalahan saat memuat halaman waiting. 
          {error.message && (
            <span className="block text-sm mt-2 text-gray-500">
              Error: {error.message}
            </span>
          )}
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Coba Lagi
          </Button>
          <Button
            onClick={() => router.push("/join")}
            variant="outline"
          >
            Kembali ke Join
          </Button>
        </div>
      </div>
    </div>
  );
}