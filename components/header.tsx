import Link from "next/link"

export function Header() {
  return (
    <header className="w-full px-4 py-6 md:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center">
           <img src="/logo.png" alt="Logo"/>
          </div>
          <span className="text-xl font-bold text-white">Escudo Pro </span>
        </div>

        <Link href="#privacy-policy" className="text-[#B3B3B3] hover:text-[#FFA500] transition-colors text-sm">
          Política de Privacidade
        </Link>
      </div>
    </header>
  )
}
