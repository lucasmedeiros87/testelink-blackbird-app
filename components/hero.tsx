"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Shield, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
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
    const formatted = formatPhone(e.target.value)
    setPhone(formatted)
  }

  const isFormValid = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && phone.replace(/\D/g, "").length === 11 && message.length >= 10 && acceptedTerms
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid()) return

    setIsLoading(true)
    setError("")

    try {
      console.log("[v0] Lead salvo:", { email, phone: phone.replace(/\D/g, ""), pageUrl })

      const formData = new FormData()
      formData.append("email", email)
      formData.append("phone", phone.replace(/\D/g, ""))
      formData.append("message", message)
      formData.append("pageUrl", pageUrl)

      const analysisResult = await analyzeMessage(formData)
      setResult(analysisResult)

      // Analytics events
      console.log("[v0] form_submit")
      console.log("[v0] analysis_success")
      console.log(`[v0] verdict_${analysisResult.verdict}`)
    } catch (err) {
      setError("Não foi possível analisar agora. Tente novamente em instantes.")
      console.log("[v0] analysis_error")
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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#1A1A1A] border-[#404040] text-white placeholder:text-[#666] focus:border-[#FFA500]"
                required
              />

              <Input
                type="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={handlePhoneChange}
                className="bg-[#1A1A1A] border-[#404040] text-white placeholder:text-[#666] focus:border-[#FFA500]"
                maxLength={15}
                required
              />

              <div className="relative">
                <Textarea
                  placeholder="Cole aqui a mensagem ou link suspeito..."
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
              🎁 Você recebe R$ 50 em CRÉDITO no lançamento do app Alby Protect em 15/09. O crédito é para uso dentro do
              app (não é transferência em dinheiro).
            </div>

            <Button
              type="submit"
              disabled={!isFormValid() || isLoading}
              className="w-full bg-[#FFA500] hover:bg-[#CC7A00] text-white font-semibold py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analisando com IA…
                </>
              ) : (
                "Escanear com IA agora"
              )}
            </Button>

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm">{error}</div>
            )}
          </form>
        </Card>

        {/* Results Card */}
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
                Quero participar do beta do Alby Protect
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
