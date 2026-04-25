function IconDoc() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="12"
        height="12"
        rx="2"
        stroke="#CBD8E4"
        strokeWidth="1"
      />
      <path
        d="M5 6h6M5 9h4"
        stroke="#CBD8E4"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconRadarLg() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="#CBD8E4" strokeWidth="1" />
      <circle cx="8" cy="8" r="2" stroke="#CBD8E4" strokeWidth="1" />
      <path
        d="M8 2.5v1M8 12.5v1M2.5 8h1M12.5 8h1"
        stroke="#CBD8E4"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  )
}

function IconShieldLg() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5L3 4v4.5C3 11.5 5.5 13.5 8 14.5c2.5-1 5-3 5-6V4L8 1.5z"
        stroke="#CBD8E4"
        strokeWidth="1"
      />
      <path
        d="M5.5 8l2 2L11 6"
        stroke="#CBD8E4"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function HowItWorks() {
  const steps = [
    {
      icon: <IconDoc />,
      step: "01",
      title: "Cole o texto",
      description: "Link, WhatsApp ou e-mail suspeito — qualquer formato.",
    },
    {
      icon: <IconRadarLg />,
      step: "02",
      title: "IA analisa",
      description: "Padrões, domínios e conteúdo verificados em tempo real.",
    },
    {
      icon: <IconShieldLg />,
      step: "03",
      title: "Veredito imediato",
      description: "Seguro, atenção ou golpe — resposta em segundos.",
    },
  ]

  return (
    <section
      className="px-6 pt-14 pb-20 md:px-10 md:pt-20 md:pb-28"
      style={{ borderTop: "0.5px solid rgba(203,216,228,0.06)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <p
            className="text-xs uppercase tracking-widest font-medium mb-3"
            style={{ color: "#CBD8E4", opacity: 0.55 }}
          >
            Metodologia
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight"
            style={{ color: "#ffffff" }}
          >
            Como funciona
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((step, index) => (
            <div
              key={index}
              style={{
                background: "rgba(21,33,50,0.6)",
                border: "0.5px solid rgba(203,216,228,0.08)",
                borderRadius: "12px",
                padding: "18px 16px",
              }}
            >
              <p
                className="mb-5 select-none leading-none"
                style={{
                  color: "rgba(203,216,228,0.08)",
                  fontSize: "32px",
                  fontWeight: 800,
                }}
              >
                {step.step}
              </p>
              <div
                className="flex items-center justify-center mb-4"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "rgba(203,216,228,0.07)",
                }}
              >
                <span style={{ opacity: 0.55, display: "flex" }}>{step.icon}</span>
              </div>
              <h3
                className="text-base font-semibold mb-2 tracking-tight"
                style={{ color: "#CBD8E4", opacity: 0.75 }}
              >
                {step.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "#B9C7D6", opacity: 0.38 }}
              >
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
