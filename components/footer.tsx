import Link from "next/link"

export function Footer() {
  return (
    <footer id="privacy-policy" className="px-6 py-12 md:px-10 md:py-16 border-t border-[#1e2d42]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10">
          <div>
            <span className="text-white font-bold text-lg tracking-tight">BlackBird<sup className="text-xs font-normal ml-0.5">®</sup></span>
            <p className="mt-2 text-[#7a8fa6] text-sm max-w-xs leading-relaxed">
              Intelligence, Counter-Intelligence &amp; Asset Recovery for High-Risk Environments.
            </p>
          </div>

          <div className="text-sm text-[#7a8fa6]">
            <p className="font-medium text-[#cbd8e4] mb-3 uppercase tracking-widest text-xs">Legal</p>
            <div className="flex flex-col gap-2">
              <Link href="#privacy-policy" className="hover:text-[#cbd8e4] transition-colors">
                Política de Privacidade
              </Link>
              <Link href="#terms" className="hover:text-[#cbd8e4] transition-colors">
                Termos de Uso
              </Link>
              <Link href="#contact" className="hover:text-[#cbd8e4] transition-colors">
                Contato
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-[#1e2d42] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#4a5f75]">
            © {new Date().getFullYear()} Blackbird Inc. Todos os direitos reservados.
          </p>
          <p className="text-xs text-[#4a5f75]">blackbird.com.br</p>
        </div>
      </div>
    </footer>
  )
}
