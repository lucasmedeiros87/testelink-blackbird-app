"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { analyzeMessage } from "@/lib/actions"

interface AnalysisResult {
  verdict: "seguro" | "cautela" | "golpe"
  reason: string
}

/* ========== INLINE SVG ICONS (palette-only) ========== */

function IconShield() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M6 1L2 3v3c0 2.5 1.8 4 4 4.5C8.2 10 10 8.5 10 6V3L6 1z"
        stroke="#CBD8E4"
        strokeWidth="1"
      />
      <path
        d="M4 6l1.5 1.5L8 4.5"
        stroke="#CBD8E4"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconRadar() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" stroke="#CBD8E4" strokeWidth="1" />
      <circle cx="6" cy="6" r="1.5" fill="#CBD8E4" opacity="0.5" />
      <path
        d="M6 1.5v1M6 9.5v1M1.5 6h1M9.5 6h1"
        stroke="#CBD8E4"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  )
}

function IconChip() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="9"
        height="9"
        rx="2"
        stroke="#CBD8E4"
        strokeWidth="1"
      />
      <path
        d="M4 6h4M6 4v4"
        stroke="#CBD8E4"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  )
}

function IconEmail() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect
        x="1.5"
        y="3"
        width="12"
        height="9"
        rx="1.5"
        stroke="#CBD8E4"
        strokeWidth="1"
      />
      <path
        d="M1.5 5l6 3.5 6-3.5"
        stroke="#CBD8E4"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="1"
        width="7"
        height="13"
        rx="2"
        stroke="#CBD8E4"
        strokeWidth="1"
      />
      <line
        x1="4"
        y1="10.5"
        x2="11"
        y2="10.5"
        stroke="#CBD8E4"
        strokeWidth="0.8"
        opacity="0.5"
      />
      <circle cx="7.5" cy="12" r="0.8" fill="#CBD8E4" />
    </svg>
  )
}

function IconScanCTA() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="#121315" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="2" fill="#121315" />
      <path
        d="M8 2.5v1.5M8 12v1.5M2.5 8H4M12 8h1.5"
        stroke="#121315"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ========== COMPONENT ========== */

export function Hero() {
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState("")
  const [pageUrl, setPageUrl] = useState("")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPageUrl(window.location.href)
    }
  }, [])

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
    }
    return value
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value))
  }

  const isFormValid = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return (
      emailRegex.test(email) &&
      phone.replace(/\D/g, "").length === 11 &&
      message.length >= 10 &&
      acceptedTerms
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!isFormValid()) {
      setError("Por favor, preencha todos os campos corretamente.")
      return
    }

    setIsLoading(true)
    setError("")
    setResult(null)

    try {
      const analysisFormData = new FormData()
      analysisFormData.append("email", email)
      analysisFormData.append("phone", phone.replace(/\D/g, ""))
      analysisFormData.append("message", message)
      analysisFormData.append("pageUrl", pageUrl)

      const r = await analyzeMessage(analysisFormData)
      setResult(r)
    } catch (err) {
      console.error("Error analyzing message:", err)
      setError("Erro ao analisar a mensagem. Tente novamente.")
    }

    try {
      const phoneRaw = phone.replace(/\D/g, "")
      const formData = new FormData()
      formData.append("email", email)
      formData.append("phone", phoneRaw)
      formData.append("message", message)

      const res = await fetch("/api/lead", { method: "POST", body: formData, redirect: "follow" })
      const ok = res.ok || (res.status >= 200 && res.status < 400) || res.redirected

      if (ok) {
        const eventId = String(Date.now())
        ;(window as any).dataLayer = (window as any).dataLayer || []
        ;(window as any).dataLayer.push({
          event: "lead_submit_success",
          event_id: eventId,
          user_email: email,
          user_phone: phoneRaw,
          event_source_url: window.location.href,
        })
      }
    } catch (err) {
      console.error("Erro de rede no envio do formulário:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const verdictLabel = (v: string) =>
    v === "seguro" ? "Seguro" : v === "cautela" ? "Atenção" : "Golpe detectado"

  return (
    <section className="relative px-6 py-16 md:px-10 md:py-24">
      <div className="max-w-4xl mx-auto text-center">
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{
            background: "rgba(203,216,228,0.05)",
            border: "0.5px solid rgba(203,216,228,0.12)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#CBD8E4", opacity: 0.7 }}
          />
          <span
            className="text-xs tracking-widest uppercase font-medium"
            style={{ color: "#B9C7D6", opacity: 0.7 }}
          >
            Inteligência Operacional
          </span>
        </div>

        {/* Headline */}
        <h1
          className="text-4xl md:text-6xl font-bold mb-6 leading-[1.05] tracking-tight"
          style={{ color: "#ffffff" }}
        >
          Detecte ameaças antes
          <br className="hidden md:block" />{" "}
          <span style={{ color: "#B9C7D6", opacity: 0.45 }}>
            de sofrerem dano real.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-base md:text-lg mb-12 max-w-xl mx-auto leading-relaxed"
          style={{ color: "#B9C7D6", opacity: 0.6 }}
        >
          Recebeu uma mensagem estranha? Cola aqui. Em segundos você sabe se é golpe.
        </p>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-14">
          {[
            { icon: <IconShield />, label: "LGPD" },
            { icon: <IconRadar />, label: "Anti-fraude" },
            { icon: <IconChip />, label: "Google GenAI" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{
                background: "rgba(21,33,50,0.8)",
                border: "0.5px solid rgba(203,216,228,0.12)",
              }}
            >
              {icon}
              <span
                className="text-xs font-medium tracking-wide"
                style={{ color: "#CBD8E4", opacity: 0.7 }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div
          className="relative z-10 max-w-2xl mx-auto text-left"
          style={{
            background: "#152132",
            border: "0.5px solid rgba(203,216,228,0.1)",
            borderRadius: "16px",
            padding: "22px",
            boxShadow:
              "0 0 0 1px rgba(203,216,228,0.03), 0 40px 80px rgba(0,0,0,0.5)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4" action="/api/lead" method="POST">
            {/* Email */}
            <div
              className="bb-field flex items-center gap-[11px]"
              style={{
                background: "rgba(18,19,21,0.6)",
                border: "0.5px solid rgba(203,216,228,0.1)",
                borderRadius: "10px",
                padding: "11px 14px",
              }}
            >
              <span className="bb-field-icon" style={{ opacity: 0.3, display: "flex", transition: "opacity 150ms ease" }}>
                <IconEmail />
              </span>
              <input
                type="email"
                placeholder="voce@exemplo.com"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bb-input flex-1 bg-transparent text-sm outline-none"
              />
            </div>

            {/* Phone */}
            <div
              className="bb-field flex items-center gap-[11px]"
              style={{
                background: "rgba(18,19,21,0.6)",
                border: "0.5px solid rgba(203,216,228,0.1)",
                borderRadius: "10px",
                padding: "11px 14px",
              }}
            >
              <span className="bb-field-icon" style={{ opacity: 0.3, display: "flex", transition: "opacity 150ms ease" }}>
                <IconPhone />
              </span>
              <input
                type="tel"
                placeholder="(11) 99999-9999"
                name="phone"
                value={phone}
                onChange={handlePhoneChange}
                maxLength={15}
                required
                className="bb-input flex-1 bg-transparent text-sm outline-none"
              />
            </div>

            {/* Textarea */}
            <div
              className="bb-field relative"
              style={{
                background: "rgba(18,19,21,0.6)",
                border: "0.5px solid rgba(203,216,228,0.1)",
                borderRadius: "10px",
              }}
            >
              <textarea
                placeholder="Cole aqui o link, mensagem de WhatsApp ou e-mail suspeito..."
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1500}
                required
                className="bb-textarea w-full bg-transparent text-sm outline-none resize-none"
                style={{
                  padding: "13px 14px",
                  minHeight: "88px",
                  color: "#ffffff",
                  border: "none",
                }}
              />
              <div
                className="absolute bottom-2.5 right-3 text-xs pointer-events-none"
                style={{ color: "#B9C7D6", opacity: 0.3 }}
              >
                {message.length}/1500
              </div>
            </div>

            {/* Checkbox */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setAcceptedTerms(!acceptedTerms)}
                aria-pressed={acceptedTerms}
                aria-label="Aceitar política de privacidade"
                className="shrink-0 mt-0.5 flex items-center justify-center transition-colors"
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "4px",
                  border: "1.5px solid rgba(203,216,228,0.35)",
                  background: acceptedTerms ? "#CBD8E4" : "transparent",
                }}
              >
                {acceptedTerms && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5l2 2 4-4"
                      stroke="#121315"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <label
                onClick={() => setAcceptedTerms(!acceptedTerms)}
                className="text-sm leading-relaxed cursor-pointer select-none"
                style={{ color: "#CBD8E4", opacity: 0.55 }}
              >
                Li e aceito a Política de Privacidade e os Termos de Uso
              </label>
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={isLoading || !isFormValid()}
              className="w-full flex items-center justify-center gap-[9px] transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "#ffffff",
                borderRadius: "10px",
                padding: "14px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#121315",
                letterSpacing: "-0.02em",
              }}
            >
              {isLoading ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full animate-spin"
                    style={{
                      border: "2px solid rgba(18,19,21,0.25)",
                      borderTopColor: "#121315",
                    }}
                  />
                  Analisando...
                </>
              ) : (
                <>
                  <IconScanCTA />
                  Analisar agora — é grátis
                </>
              )}
            </button>

            {error && (
              <div
                className="p-3.5 rounded-lg text-sm text-left"
                style={{
                  background: "rgba(203,216,228,0.06)",
                  border: "0.5px solid rgba(203,216,228,0.18)",
                  color: "#CBD8E4",
                }}
              >
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Result Card — monochrome (palette-only) */}
        {result && (
          <div
            className="relative z-10 max-w-2xl mx-auto mt-6 text-left"
            style={{
              background: "#152132",
              border: "0.5px solid rgba(203,216,228,0.1)",
              borderRadius: "16px",
              padding: "22px",
              boxShadow:
                "0 0 0 1px rgba(203,216,228,0.03), 0 40px 80px rgba(0,0,0,0.5)",
            }}
          >
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{
                    background: "rgba(203,216,228,0.06)",
                    border: "0.5px solid rgba(203,216,228,0.18)",
                    color: "#CBD8E4",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "#CBD8E4",
                      opacity: result.verdict === "golpe" ? 1 : result.verdict === "cautela" ? 0.6 : 0.35,
                    }}
                  />
                  {verdictLabel(result.verdict)}
                </div>
              </div>

              <p className="text-sm leading-relaxed" style={{ color: "#B9C7D6", opacity: 0.8 }}>
                {result.reason}
              </p>

              <div
                className="p-5 rounded-lg"
                style={{
                  background: "rgba(18,19,21,0.6)",
                  border: "0.5px solid rgba(203,216,228,0.08)",
                }}
              >
                <h3
                  className="text-xs font-medium uppercase tracking-widest mb-4"
                  style={{ color: "#CBD8E4", opacity: 0.75 }}
                >
                  Como se proteger agora
                </h3>
                <ul className="space-y-2.5">
                  {[
                    "Nunca clique em links encurtados ou de remetentes desconhecidos.",
                    "Confirme no canal oficial da empresa antes de responder.",
                    "Desconfie de urgência, prêmios e pedidos de códigos.",
                  ].map((tip) => (
                    <li
                      key={tip}
                      className="flex items-start gap-3 text-sm"
                      style={{ color: "#B9C7D6", opacity: 0.55 }}
                    >
                      <span
                        className="w-1 h-1 rounded-full mt-2 shrink-0"
                        style={{ background: "#CBD8E4", opacity: 0.7 }}
                      />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <p
          className="text-xs mt-8 max-w-2xl mx-auto leading-relaxed"
          style={{ color: "#B9C7D6", opacity: 0.35 }}
        >
          Seus dados são utilizados exclusivamente para entrega do resultado da análise.
          Proteção em conformidade com a LGPD.
        </p>
      </div>
    </section>
  )
}
