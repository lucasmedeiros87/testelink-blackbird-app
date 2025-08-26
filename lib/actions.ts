"use server"

import { createClient } from "@/lib/supabase/server"

interface AnalysisResult {
  verdict: "seguro" | "cautela" | "golpe"
  reason: string
}

export async function analyzeMessage(formData: FormData): Promise<AnalysisResult> {
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const message = formData.get("message") as string
  const pageUrl = formData.get("pageUrl") as string

  // Sanitize input - strip HTML tags
  const sanitizedMessage = message.replace(/<[^>]*>/g, "").trim()

  try {
    const apiKey = process.env.GEMINI_API_KEY

    let analysisResult: AnalysisResult

    if (!apiKey) {
      console.error("[v0] GEMINI_API_KEY not found in environment variables")
      analysisResult = getMockAnalysis(sanitizedMessage)
    } else {
      const prompt = `Você é um analisador antifraude especializado. Classifique o texto a seguir como 'Seguro', 'Cautela' ou 'Golpe detectado' e dê um motivo curto e objetivo em português brasileiro. 

Texto para análise: "${sanitizedMessage}"

Responda apenas com a classificação seguida do motivo, separados por dois pontos. Exemplo: "Golpe detectado: Contém pedido urgente de dados pessoais e links suspeitos."`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        },
      )

      if (!response.ok) {
        console.error(`[v0] API request failed: ${response.status} ${response.statusText}`)
        const errorText = await response.text()
        console.error(`[v0] API error response:`, errorText)
        analysisResult = getMockAnalysis(sanitizedMessage)
      } else {
        const data = await response.json()
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

        // Parse AI response
        const [classification, ...reasonParts] = aiResponse.split(":")
        const reason = reasonParts.join(":").trim()

        let verdict: "seguro" | "cautela" | "golpe" = "cautela"

        if (classification.toLowerCase().includes("seguro")) {
          verdict = "seguro"
        } else if (classification.toLowerCase().includes("golpe")) {
          verdict = "golpe"
        } else {
          verdict = "cautela"
        }

        analysisResult = {
          verdict,
          reason: reason || "Análise concluída. Verifique as recomendações de segurança.",
        }
      }
    }

    try {
      const supabase = await createClient()

      const { error: insertError } = await supabase.from("leads").insert({
        email,
        phone,
        page_url: pageUrl,
        message: sanitizedMessage,
        analysis_result: analysisResult,
      })

      if (insertError) {
        console.error("[v0] Error saving to Supabase:", insertError)
      } else {
        console.log("[v0] Lead saved successfully to Supabase:", {
          email,
          phone,
          pageUrl,
          verdict: analysisResult.verdict,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (supabaseError) {
      console.error("[v0] Supabase connection error:", supabaseError)
    }

    return analysisResult
  } catch (error) {
    console.error("[v0] Error analyzing message:", error)
    return getMockAnalysis(sanitizedMessage)
  }
}

function getMockAnalysis(message: string): AnalysisResult {
  const lowerMessage = message.toLowerCase()

  // Simple keyword-based analysis for demo
  const suspiciousKeywords = [
    "urgente",
    "clique aqui",
    "ganhe dinheiro",
    "prêmio",
    "parabéns",
    "conta bloqueada",
    "confirme seus dados",
    "pix",
    "transferência",
    "código de segurança",
    "whatsapp",
    "link",
    "cadastre-se",
  ]

  const safeKeywords = ["obrigado", "agradecimento", "informação", "newsletter", "confirmação de pedido", "recibo"]

  const suspiciousCount = suspiciousKeywords.filter((keyword) => lowerMessage.includes(keyword)).length

  const safeCount = safeKeywords.filter((keyword) => lowerMessage.includes(keyword)).length

  if (suspiciousCount >= 2) {
    return {
      verdict: "golpe",
      reason: "Mensagem contém múltiplas palavras-chave suspeitas típicas de golpes.",
    }
  } else if (suspiciousCount >= 1) {
    return {
      verdict: "cautela",
      reason: "Mensagem contém elementos que requerem atenção. Verifique a origem antes de agir.",
    }
  } else if (safeCount > 0) {
    return {
      verdict: "seguro",
      reason: "Mensagem parece ser legítima, mas sempre confirme a origem.",
    }
  } else {
    return {
      verdict: "cautela",
      reason: "Não foi possível determinar com certeza. Sempre verifique a origem da mensagem.",
    }
  }
}
