"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, CheckCircle, AlertTriangle, XCircle, ScanSearch } from "lucide-react"
import { analyzeMessage } from "@/lib/actions"

interface AnalysisResult {
  verdict: "seguro" | "cautela" | "golpe"
  reason: string
}

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

  const getResultConfig = (verdict: string) => {
    switch (verdict) {
      case "seguro":
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          badge: "Seguro",
          color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          dot: "bg-emerald-400",
        }
      case "cautela":
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          badge: "Atenção",
          color: "bg-amber-500/10 border-amber-500/30 text-amber-400",
          dot: "bg-amber-400",
        }
      case "golpe":
        return {
          icon: <XCircle className="w-5 h-5" />,
          badge: "Golpe detectado",
          color: "bg-red-500/10 border-red-500/30 text-red-400",
          dot: "bg-red-400",
        }
      default:
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          badge: "Atenção",
          color: "bg-amber-500/10 border-amber-500/30 text-amber-400",
          dot: "bg-amber-400",
        }
    }
  }

  return (
    <section className="bb-sweep px-6 py-16 md:px-10 md:py-24">
      <div className="max-w-4xl mx-auto text-center">

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 bg-[#152132] border border-[#1e2d42] px-4 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#cbd8e4]" />
          <span className="text-[#cbd8e4] text-xs tracking-widest uppercase font-medium">
            Inteligência Operacional
          </span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-[1.05] tracking-tight">
          Detecte ameaças antes<br className="hidden md:block" />
          <span className="text-[#cbd8e4]"> de sofrerem dano real.</span>
        </h1>

        <p className="text-base md:text-lg text-[#7a8fa6] mb-12 max-w-xl mx-auto leading-relaxed">
          Cole a mensagem suspeita. Nossa inteligência artificial analisa e entrega
          um veredito em segundos.
        </p>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-14">
          {[
            { icon: <Shield className="w-3.5 h-3.5" />, label: "LGPD" },
            { icon: <Shield className="w-3.5 h-3.5" />, label: "Anti-fraude" },
            { icon: <Shield className="w-3.5 h-3.5" />, label: "Google GenAI" },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 bg-[#152132] border border-[#1e2d42] px-4 py-2 rounded-full"
            >
              <span className="text-[#cbd8e4]">{icon}</span>
              <span className="text-xs text-[#b9c7d6] font-medium tracking-wide">{label}</span>
            </div>
          ))}
        </div>

        {/* Form Card */}
        <Card className="bg-[#152132] border-[#1e2d42] p-7 md:p-10 max-w-2xl mx-auto shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5" action="/api/lead" method="POST">
            <div className="space-y-3.5">
              <Input
                type="email"
                placeholder="voce@exemplo.com"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#0e1621] border-[#1e2d42] text-white placeholder:text-[#4a5f75] focus-visible:ring-[#cbd8e4]/30 focus-visible:border-[#cbd8e4]/50 h-11"
                required
              />

              <Input
                type="tel"
                placeholder="(11) 99999-9999"
                name="phone"
                value={phone}
                onChange={handlePhoneChange}
                className="bg-[#0e1621] border-[#1e2d42] text-white placeholder:text-[#4a5f75] focus-visible:ring-[#cbd8e4]/30 focus-visible:border-[#cbd8e4]/50 h-11"
                maxLength={15}
                required
              />

              <div className="relative">
                <Textarea
                  placeholder="Cole aqui a mensagem ou link suspeito..."
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="bg-[#0e1621] border-[#1e2d42] text-white placeholder:text-[#4a5f75] focus-visible:ring-[#cbd8e4]/30 focus-visible:border-[#cbd8e4]/50 min-h-[120px] resize-none"
                  maxLength={1500}
                  required
                />
                <div className="absolute bottom-2.5 right-3 text-xs text-[#4a5f75]">
                  {message.length}/1500
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                className="border-[#1e2d42] data-[state=checked]:bg-[#cbd8e4] data-[state=checked]:border-[#cbd8e4] mt-0.5"
              />
              <label htmlFor="terms" className="text-sm text-[#7a8fa6] leading-relaxed cursor-pointer">
                Li e aceito a Política de Privacidade e o Termo do Crédito de R$ 50
              </label>
            </div>

            <div className="text-xs text-[#4a5f75] bg-[#0e1621] border border-[#1e2d42] p-3.5 rounded-lg text-left leading-relaxed">
              Você recebe <span className="text-[#cbd8e4] font-medium">R$ 50 em crédito</span> no lançamento do app BlackBird em 15/09.
              O crédito é para uso dentro do app.
            </div>

            <Button
              type="submit"
              disabled={isLoading || !isFormValid()}
              className="w-full bg-[#cbd8e4] hover:bg-[#b9c7d6] text-[#121315] font-semibold h-12 text-sm tracking-wide disabled:opacity-40 transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#121315]/30 border-t-[#121315] rounded-full animate-spin" />
                  Analisando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ScanSearch className="w-4 h-4" />
                  Escanear com IA
                </span>
              )}
            </Button>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-lg text-sm text-left">
                {error}
              </div>
            )}
          </form>
        </Card>

        {/* Result Card */}
        {result && (
          <Card className="bg-[#152132] border-[#1e2d42] p-7 md:p-10 max-w-2xl mx-auto mt-6 shadow-2xl text-left">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Badge
                  className={`${getResultConfig(result.verdict).color} border px-4 py-1.5 text-sm font-medium flex items-center gap-2`}
                >
                  {getResultConfig(result.verdict).icon}
                  {getResultConfig(result.verdict).badge}
                </Badge>
              </div>

              <p className="text-[#b9c7d6] leading-relaxed text-sm">{result.reason}</p>

              <div className="bg-[#0e1621] border border-[#1e2d42] p-5 rounded-lg">
                <h3 className="text-[#cbd8e4] text-xs font-medium uppercase tracking-widest mb-4">
                  Como se proteger agora
                </h3>
                <ul className="space-y-2.5">
                  {[
                    "Nunca clique em links encurtados ou de remetentes desconhecidos.",
                    "Confirme no canal oficial da empresa antes de responder.",
                    "Desconfie de urgência, prêmios e pedidos de códigos.",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-3 text-sm text-[#7a8fa6]">
                      <span className="w-1 h-1 rounded-full bg-[#cbd8e4] mt-2 shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                variant="outline"
                className="w-full border-[#1e2d42] text-[#cbd8e4] hover:bg-[#1e2d42] hover:text-white bg-transparent h-11 text-sm tracking-wide"
                onClick={() => {}}
              >
                Quero participar do beta do BlackBird
              </Button>
            </div>
          </Card>
        )}

        <p className="text-xs text-[#4a5f75] mt-8 max-w-2xl mx-auto leading-relaxed">
          Seus dados são utilizados exclusivamente para entrega do resultado e liberação do crédito no app.
          Proteção em conformidade com a LGPD.
        </p>
      </div>
    </section>
  )
}
