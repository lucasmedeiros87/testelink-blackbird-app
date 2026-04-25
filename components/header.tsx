import Link from "next/link"

function BlackBirdLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="BlackBird"
    >
      {/* Bird silhouette */}
      <path
        d="M8 34 C8 34 10 28 14 25 C16 23.5 18 23 20 23.5 L24 18 C22 16 18 14 14 15 C10 16 6 19 4 23 L0 20 L2 28 L8 34Z"
        fill="white"
      />
      <path
        d="M20 23.5 C22 24 25 25.5 27 28 C29 30.5 29 33 27 35 C25 37 22 37.5 19 36.5 C16 35.5 14 33 14 30 C14 27 16 24.5 20 23.5Z"
        fill="white"
      />
      <path
        d="M27 28 C30 29 34 28 37 26 C40 24 42 21 41 18 C40 15 37 14 34 15 C31 16 29 18 28 21 L24 18 L20 23.5 C22 24 25 25.5 27 28Z"
        fill="white"
      />
      <path
        d="M19 36.5 L17 42 L20 43 L22 38 C21 37.5 20 37 19 36.5Z"
        fill="white"
      />
      <path
        d="M22 37.5 L21 43 L24 43.5 L24.5 38.5 C23.7 38.2 22.8 37.9 22 37.5Z"
        fill="white"
      />

      {/* Wordmark: BlackBird® */}
      <text
        x="52"
        y="34"
        fontFamily="var(--font-neue-haas), system-ui, sans-serif"
        fontWeight="700"
        fontSize="28"
        fill="white"
        letterSpacing="-0.5"
      >
        BlackBird
      </text>
      <text
        x="236"
        y="22"
        fontFamily="var(--font-neue-haas), system-ui, sans-serif"
        fontWeight="400"
        fontSize="11"
        fill="white"
      >
        ®
      </text>
    </svg>
  )
}

export function Header() {
  return (
    <header className="w-full px-6 py-5 md:px-10">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <BlackBirdLogo className="h-9 w-auto" />

        <nav className="flex items-center gap-6">
          <Link
            href="#privacy-policy"
            className="text-[#7a8fa6] hover:text-[#cbd8e4] transition-colors text-sm tracking-wide"
          >
            Política de Privacidade
          </Link>
        </nav>
      </div>
    </header>
  )
}
