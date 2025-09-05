"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
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
  const [cooldownTime, setCooldownTime] = useState(0)
  const [lastSubmissionKey, setLastSubmissionKey] = useState("")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPageUrl(window.location.href)
    }
  }, [])

  // Effect para controlar o cooldown
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined
    
    if (cooldownTime > 0) {
      interval = setInterval(() => {
        setCooldownTime((prev) => {
          if (prev <= 1) {
            setLastSubmissionKey("")
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [cooldownTime])

  // Função para verificar se está no cooldown
  const checkCooldown = (email: string, message: string) => {
    const submissionKey = `${email.trim().toLowerCase()}|${message.trim()}`
    return lastSubmissionKey === submissionKey && cooldownTime > 0
  }

  // Função para iniciar o cooldown
  const startCooldown = (email: string, message: string) => {
    const submissionKey = `${email.trim().toLowerCase()}|${message.trim()}`
    setLastSubmissionKey(submissionKey)
    setCooldownTime(40) // 40 segundos
  }

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
    }
    return value
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value)
    setPhone(formatted)
  }

  const isFormValid = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return (
      emailRegex.test(email) &&
      phone.replace(/\D/g, "").length === 11 &&
      message.length >= 10 &&
      acceptedTerms &&
      !checkCooldown(email, message) // Adiciona verificação de cooldown
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!isFormValid()) {
      if (checkCooldown(email, message)) {
        setError(`Aguarde ${cooldownTime} segundos para analisar a mesma mensagem novamente.`)
      } else {
        setError("Por favor, preencha todos os campos corretamente.")
      }
      return
    }

    // Inicia o cooldown imediatamente
    startCooldown(email, message)

    setIsLoading(true)
    setError("")
    setResult(null)

    // 1) Tenta a análise, mas NÃO bloqueia o envio/pixel se falhar
    try {
      const analysisFormData = new FormData()
      analysisFormData.append("email", email)
      analysisFormData.append("phone", phone.replace(/\D/g, ""))
      analysisFormData.append("message", message)
      analysisFormData.append("pageUrl", pageUrl)

      const r = await analyzeMessage(analysisFormData)
      setResult(r)
    } catch (err) {
      console.error("[v0] Error analyzing message:", err)
      setError("Erro ao analisar a mensagem. Tente novamente.")
      // seguimos o fluxo mesmo assim
    }

    // 2) Envia para /api/lead e dispara o evento no sucesso real (2xx/3xx/redirect)
    try {
      const phoneRaw = phone.replace(/\D/g, "")

      const form = e.currentTarget as HTMLFormElement
      const action = form ? form.getAttribute("action") || "/api/lead" : "/api/lead"
      const method = form ? (form.getAttribute("method") || "POST").toUpperCase() : "POST"

      const formData = new FormData()
      formData.append("email", email)
      formData.append("phone", phoneRaw)
      formData.append("message", message)

      const res = await fetch(action, { method, body: formData, redirect: "follow" })
      const ok = res.ok || (res.status >= 200 && res.status < 400) || res.redirected

      if (ok) {
        const eventId = (window as any).uuidv4 ? (window as any).uuidv4() : String(Date.now())
        const fbp = (window as any).getCookie ? (window as any).getCookie("_fbp") : ""
        const fbc = (window as any).buildFBC ? (window as any).buildFBC() : ""

        ;(window as any).dataLayer = (window as any).dataLayer || []
        ;(window as any).dataLayer.push({
          event: "lead_submit_success",
          event_id: eventId,
          user_email: email,
          user_phone: phoneRaw,
          _fbp: fbp || "",
          _fbc: fbc || "",
          event_source_url: window.location.href,
        })

        try {
          form.reset()
        } catch {}
      } else {
        console.error("Falha no envio do formulário:", res.status, await res.text().catch(() => ""))
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
          badge: "✅ Seguro",
          color: "bg-green-500 border-green-500 text-white",
        }
      case "cautela":
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          badge: "⚠️ Cautela",
          color: "bg-amber-500 border-amber-500 text-white",
        }
      case "golpe":
        return {
          icon: <XCircle className="w-5 h-5" />,
          badge: "❌ Golpe detectado",
          color: "bg-red-500 border-red-500 text-white",
        }
      default:
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          badge: "⚠️ Cautela",
          color: "bg-amber-500 border-amber-500 text-white",
        }
    }
  }

  return (
    <section className="px-4 py-12 md:px-6 md:py-20">
      <div className="max-w-4xl mx-auto text-center">
        {/* Hero Title */}
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Escaneie agora se você está sendo enganado com IA
        </h1>

        <p className="text-lg md:text-xl text-[#B3B3B3] mb-8 max-w-2xl mx-auto">
          Cole a mensagem suspeita e nossa IA detecta fraude em segundos.
        </p>

        {/* Trust Indicators */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <div className="flex items-center gap-2 bg-[#1A1A1A] px-4 py-2 rounded-lg">
            <Shield className="w-4 h-4 text-[#FFA500]" />
            <span className="text-sm text-white">LGPD</span>
          </div>
          <div className="flex items-center gap-2 bg-[#1A1A1A] px-4 py-2 rounded-lg">
            <Shield className="w-4 h-4 text-[#FFA500]" />
            <span className="text-sm text-white">Anti-fraude</span>
          </div>
          <div className="flex items-center gap-2 bg-[#1A1A1A] px-4 py-2 rounded-lg">
            <Shield className="w-4 h-4 text-[#FFA500]" />
            <span className="text-sm text-white">Google GenAI</span>
          </div>
        </div>

        {/* Form Card */}
        <Card className="bg-[#1A1A1A] border-[#404040] p-6 md:p-8 max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6" action="/api/lead" method="POST">
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="voce@exemplo.com"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#1A1A1A] border-[#404040] text-white placeholder:text-[#666] focus:border-[#FFA500]"
                required
              />

              <Input
                type="tel"
                placeholder="(11) 99999-9999"
                name="phone"
                value={phone}
                onChange={handlePhoneChange}
                className="bg-[#1A1A1A] border-[#404040] text-white placeholder:text-[#666] focus:border-[#FFA500]"
                maxLength={15}
                required
              />

              <div className="relative">
                <Textarea
                  placeholder="Cole aqui a mensagem ou link suspeito..."
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="bg-[#1A1A1A] border-[#404040] text-white placeholder:text-[#666] focus:border-[#FFA500] min-h-[120px] resize-none"
                  maxLength={1500}
                  required
                />
                <div className="absolute bottom-2 right-2 text-xs text-[#666]">{message.length}/1500</div>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                className="border-[#404040] data-[state=checked]:bg-[#FFA500] data-[state=checked]:border-[#FFA500]"
              />
              <label htmlFor="terms" className="text-sm text-white leading-relaxed">
                Li e aceito a Política de Privacidade e o Termo do Crédito de R$ 50
              </label>
            </div>

            <div className="text-xs text-white bg-[#0D0D0D] p-3 rounded-lg">
              🎁 Você recebe R$ 50 em CRÉDITO no lançamento do app Escudo Pro em 30/09. O crédito é para uso dentro do
              app (não é transferência em dinheiro).
            </div>

            <Button
              type="submit"
              disabled={isLoading || !isFormValid() || checkCooldown(email, message)}
              className="w-full bg-[#FFA500] hover:bg-[#CC7A00] text-white font-semibold py-3 text-lg disabled:opacity-50"
            >
              {isLoading ? (
                "Analisando..."
              ) : checkCooldown(email, message) ? (
                `Aguarde ${cooldownTime}s para analisar novamente`
              ) : (
                "Escanear com IA agora"
              )}
            </Button>

            {checkCooldown(email, message) && !isLoading && (
              <div className="bg-amber-500/10 border border-amber-500 text-amber-400 p-3 rounded-lg text-sm text-center">
                ⏱️ Você já analisou esta mensagem recentemente. Aguarde <strong>{cooldownTime} segundos</strong> para analisar novamente.
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm">{error}</div>
            )}
          </form>
        </Card>

        {/* Resultados */}
        {result && (
          <Card className="bg-[#1A1A1A] border-[#404040] p-6 md:p-8 max-w-2xl mx-auto mt-8">
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-3">
                <Badge className={`${getResultConfig(result.verdict).color} px-4 py-2 text-base font-semibold`}>
                  {getResultConfig(result.verdict).badge}
                </Badge>
              </div>

              <p className="text-white text-center leading-relaxed">{result.reason}</p>

              <div className="bg-[#0D0D0D] p-4 rounded-lg">
                <h3 className="text-[#FFA500] font-semibold mb-3">Como se proteger agora:</h3>
                <ul className="space-y-2 text-sm text-[#B3B3B3]">
                  <li className="flex items-start gap-2">
                    <span className="text-[#FFA500] mt-1">•</span>
                    Nunca clique em links encurtados ou de remetentes desconhecidos.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FFA500] mt-1">•</span>
                    Confirme no canal oficial da empresa antes de responder.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#FFA500] mt-1">•</span>
                    Desconfie de urgência, prêmios e pedidos de códigos.
                  </li>
                </ul>
              </div>

              <Button
                variant="outline"
                className="w-full border-[#FFA500] text-[#FFA500] hover:bg-[#FFA500] hover:text-white bg-transparent"
                onClick={() => console.log("[v0] click_beta")}
              >
                Quero participar do beta do Escudo Pro
              </Button>
            </div>
          </Card>
        )}

        <div className="text-xs text-[#B3B3B3] mt-6 max-w-2xl mx-auto">
          Seus dados são usados somente para enviar o resultado e liberar o seu crédito no app. Proteção conforme LGPD.
        </div>
      </div>
    </section>
  )
}
