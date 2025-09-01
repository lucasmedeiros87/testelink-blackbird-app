"use server"

import { createClient } from "@/lib/supabase/server"

interface AnalysisResult {
  verdict: "seguro" | "cautela" | "golpe"
  reason: string
}

function summarizeHtml(raw: string, maxLen = 8000) {
  const noScripts = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
  return noScripts.replace(/\s+/g, " ").trim().slice(0, maxLen)
}

function buildReputationHints(url?: string, html?: string) {
  try {
    const u = url ? new URL(url) : null
    const domain = u?.hostname || ""
    const tld = domain.split(".").pop() || ""
    const hasWhatsApp = !!html?.match(/(api\.whatsapp|wa\.me)\//i)
    const mentionsPix = !!html?.match(/\bpix\b/i)
    const mentionsCnpj = !!html?.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/i)
    return { domain, tld, hasWhatsApp, mentionsPix, mentionsCnpj }
  } catch {
    return {}
  }
}

function buildPrompt(message: string, pageUrl?: string, htmlSummary?: string, reputationHintsJson?: string) {
  return `Você é um analisador antifraude especializado em websites no Brasil.

Analise:
1) Mensagem: "${message}"
2) URL: "${pageUrl || "não informada"}"
3) HTML resumido: "${htmlSummary || "indisponível"}"
4) Sinais de reputação: ${reputationHintsJson || "{}"}

Classifique como:
- "Seguro" → não há sinais de golpe relevantes.
- "Cautela" → sinais fracos/ambíguos.
- "Golpe detectado" → ≥2 sinais fortes ou 1 fortíssimo (ex: coleta de senha/PIX/código, domínio suspeito, urgência).

⚠️ Responda **apenas** no formato:
[Classificação]: [Motivo curto em português brasileiro]

Exemplo:
Golpe detectado: Contém pedido urgente de dados pessoais e links suspeitos.`
}

export async function analyzeMessage(formData: FormData): Promise<AnalysisResult> {
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const message = formData.get("message") as string
  const pageUrl = formData.get("pageUrl") as string

  const sanitizedMessage = (message || "").replace(/<[^>]*>/g, "").trim()

  let rawHtml = ""
  try {
    if (pageUrl) {
      const resp = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0" } })
      if (resp.ok && (resp.headers.get("content-type") || "").includes("text/html")) {
        rawHtml = await resp.text()
      }
    }
  } catch (e) {
    console.error("[v0] fetch HTML error:", e)
  }

  const htmlSummary = rawHtml ? summarizeHtml(rawHtml) : ""
  const reputationHints = buildReputationHints(pageUrl, htmlSummary)
  const reputationHintsJson = JSON.stringify(reputationHints)

  try {
    const apiKey = process.env.GEMINI_API_KEY
    let analysisResult: AnalysisResult

    if (!apiKey) {
      console.error("[v0] GEMINI_API_KEY not found")
      analysisResult = getMockAnalysis(sanitizedMessage)
    } else {
      const prompt = buildPrompt(sanitizedMessage, pageUrl, htmlSummary, reputationHintsJson)

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.15 }
          })
        }
      )

      if (!response.ok) {
        console.error(`[v0] API request failed: ${response.status}`)
        analysisResult = getMockAnalysis(sanitizedMessage)
      } else {
        const data = await response.json()
        const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""

        const [classification, ...reasonParts] = aiResponse.split(":")
        const reason = reasonParts.join(":").trim()
        let verdict: "seguro" | "cautela" | "golpe" = "cautela"

        if (classification.toLowerCase().includes("seguro")) verdict = "seguro"
        else if (classification.toLowerCase().includes("golpe")) verdict = "golpe"
        else verdict = "cautela"

        analysisResult = { verdict, reason: reason || "Análise concluída." }
      }
    }

    try {
      const supabase = await createClient()
      await supabase.from("leads").insert({
        email,
        phone,
        page_url: pageUrl,
        message: sanitizedMessage,
        analysis_result: analysisResult
      })
    } catch (supabaseError) {
      console.error("[v0] Supabase error:", supabaseError)
    }

    return analysisResult
  } catch (error) {
    console.error("[v0] Error analyzing:", error)
    return getMockAnalysis(sanitizedMessage)
  }
}

function getMockAnalysis(message: string): AnalysisResult {
  const lowerMessage = (message || "").toLowerCase()
  const suspiciousKeywords = ["urgente", "pix", "senha", "confirme", "bloqueada", "clique aqui"]
  const suspiciousCount = suspiciousKeywords.filter(k => lowerMessage.includes(k)).length

  if (suspiciousCount >= 2) return { verdict: "golpe", reason: "Contém múltiplos termos típicos de golpe." }
  if (suspiciousCount >= 1) return { verdict: "cautela", reason: "Mensagem contém termos suspeitos." }
  return { verdict: "seguro", reason: "Não foram encontrados indícios claros de golpe." }
}
