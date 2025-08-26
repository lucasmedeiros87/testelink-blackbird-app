import Link from "next/link"

export function Header() {
  return (
    <header className="w-full px-4 py-6 md:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-[#FFA500] rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-lg">A</span>
          </div>
          <span className="text-xl font-bold text-white">Alby Protect</span>
        </div>

        <Link href="#privacy-policy" className="text-[#B3B3B3] hover:text-[#FFA500] transition-colors text-sm">
          Política de Privacidade
        </Link>
      </div>
    </header>
  )
}
