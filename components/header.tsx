import Link from "next/link"

export function Header() {
  return (
    <header
      className="w-full px-6 py-5 md:px-10"
      style={{ borderBottom: "0.5px solid rgba(203,216,228,0.07)" }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/*
          Temporary text logo — preparado para receber <Image> da logo final.
          Ex.: <Image src="/blackbird-logo.svg" alt="BlackBird" width={140} height={28} />
        */}
        <span
          className="select-none"
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

        <nav className="flex items-center gap-6">
          <Link
            href="#privacy-policy"
            className="text-sm transition-opacity hover:opacity-100"
            style={{ color: "#B9C7D6", opacity: 0.5 }}
          >
            Política de Privacidade
          </Link>
        </nav>
      </div>
    </header>
  )
}
