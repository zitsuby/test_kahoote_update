import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function WaitingNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#105981] via-[#09799E] to-[#58B8CE] flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Game Tidak Ditemukan</h2>
        <p className="text-gray-600 mb-6">
          Game yang Anda cari tidak dapat ditemukan. Mungkin kode game salah atau game sudah berakhir.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/join">
            <Button className="bg-purple-600 hover:bg-purple-700">
              Coba Join Game Lain
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">
              Ke Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}