import Link from "next/link"

export function Footer() {
  return (
    <footer id="privacy-policy" className="px-4 py-12 md:px-6 md:py-16 border-t border-[#404040]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-[#FFA500] rounded-lg flex items-center justify-center">
              <span className="text-black font-bold">A</span>
            </div>
            <span className="text-lg font-bold text-white">Escudo Pro </span>
          </div>

          <div className="text-center">
            <p className="text-[#CC7A00] font-semibold text-lg">Lançamento oficial em 15 de setembro de 2025</p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-[#404040] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#B3B3B3]">
            <Link href="#privacy-policy" className="hover:text-[#FFA500] transition-colors">
              Política de Privacidade
            </Link>
            <Link href="#terms" className="hover:text-[#FFA500] transition-colors">
              Termos
            </Link>
            <Link href="#contact" className="hover:text-[#FFA500] transition-colors">
              Contato
            </Link>
          </div>

          <p className="text-sm text-[#666]">© 2025 Escudo Pro. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
