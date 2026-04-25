function IconShieldSp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1L2.5 3v3.5c0 2.8 2 4.5 4.5 5.2 2.5-0.7 4.5-2.4 4.5-5.2V3L7 1z"
        stroke="#CBD8E4"
        strokeWidth="1"
      />
      <path
        d="M5 7l1.5 1.5L9 5.5"
        stroke="#CBD8E4"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLockSp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect
        x="2.5"
        y="6"
        width="9"
        height="6.5"
        rx="1.5"
        stroke="#CBD8E4"
        strokeWidth="1"
      />
      <path
        d="M4.5 6V4.5a2.5 2.5 0 015 0V6"
        stroke="#CBD8E4"
        strokeWidth="1"
      />
    </svg>
  )
}

function IconBadgeSp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="6" r="3.5" stroke="#CBD8E4" strokeWidth="1" />
      <path
        d="M5 9l-1 4 3-1.5L10 13 9 9"
        stroke="#CBD8E4"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SocialProof() {
  const badges = [
    { icon: <IconShieldSp />, label: "LGPD Compliant" },
    { icon: <IconLockSp />, label: "Anti-fraude" },
    { icon: <IconBadgeSp />, label: "Proteção de Dados" },
  ]

  return (
    <section
      className="px-6 py-16 md:px-10 md:py-20"
      style={{
        background: "rgba(21,33,50,0.4)",
        borderTop: "0.5px solid rgba(203,216,228,0.06)",
      }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center text-center gap-6">
          <div>
            <p
              className="text-2xl md:text-3xl tracking-tight"
              style={{ color: "#ffffff", fontWeight: 800 }}
            >
              +5.000 golpes detectados
            </p>
            <p className="text-sm mt-1" style={{ color: "#B9C7D6", opacity: 0.38 }}>
              com inteligência artificial
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {badges.map(({ icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg"
                style={{
                  background: "rgba(21,33,50,0.8)",
                  border: "0.5px solid rgba(203,216,228,0.1)",
                }}
              >
                <span style={{ display: "flex" }}>{icon}</span>
                <span
                  className="text-sm font-medium"
                  style={{ color: "#CBD8E4", opacity: 0.5 }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
