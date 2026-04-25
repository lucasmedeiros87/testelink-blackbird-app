import Link from "next/link"

export function Footer() {
  return (
    <footer
      id="privacy-policy"
      className="px-6 py-12 md:px-10 md:py-16"
      style={{ borderTop: "0.5px solid rgba(203,216,228,0.06)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10">
          <div>
            <span
              style={{
                color: "#ffffff",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                fontSize: "18px",
              }}
            >
              BlackBird
              <sup style={{ fontSize: "10px", fontWeight: 400, marginLeft: "1px" }}>
                ®
              </sup>
            </span>
            <p
              className="mt-2 text-sm max-w-xs leading-relaxed"
              style={{ color: "#B9C7D6", opacity: 0.28 }}
            >
              Inteligência, Contrainteligência e Recuperação de Ativos para Ambientes de Alto Risco.
            </p>
          </div>

          <div className="text-sm">
            <p
              className="mb-3 uppercase tracking-widest text-xs font-medium"
              style={{ color: "#CBD8E4", opacity: 0.55 }}
            >
              Legal
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="#privacy-policy"
                className="transition-opacity hover:opacity-80"
                style={{ color: "#CBD8E4", opacity: 0.3 }}
              >
                Política de Privacidade
              </Link>
              <Link
                href="#terms"
                className="transition-opacity hover:opacity-80"
                style={{ color: "#CBD8E4", opacity: 0.3 }}
              >
                Termos de Uso
              </Link>
              <Link
                href="#contact"
                className="transition-opacity hover:opacity-80"
                style={{ color: "#CBD8E4", opacity: 0.3 }}
              >
                Contato
              </Link>
            </div>
          </div>
        </div>

        <div
          className="mt-10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: "0.5px solid rgba(203,216,228,0.06)" }}
        >
          <p className="text-xs" style={{ color: "#B9C7D6", opacity: 0.18 }}>
            © {new Date().getFullYear()} Blackbird Inc. Todos os direitos reservados.
          </p>
          <p className="text-xs" style={{ color: "#B9C7D6", opacity: 0.18 }}>
            blackbird.com.br
          </p>
        </div>
      </div>
    </footer>
  )
}
