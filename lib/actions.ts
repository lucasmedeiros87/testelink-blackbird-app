"use server"

import { createClient } from "@/lib/supabase/server"

interface AnalysisResult {
  verdict: "seguro" | "cautela" | "golpe"
  reason: string
}

/** Extrai até N URLs http(s) do texto da mensagem */
function extractUrlsFromText(text: string, max = 2): string[] {
  const urls = new Set<string>()
  const urlRegex = /\bhttps?:\/\/[^\s<>"')]+/gi
  let m: RegExpExecArray | null
  while ((m = urlRegex.exec(text)) && urls.size < max) {
    try {
      const u = new URL(m[0])
      urls.add(u.toString())
    } catch {}
  }
  return Array.from(urls)
}

/** Remove <script>/<style>, normaliza espaços e limita tamanho */
function summarizeHtml(raw: string, maxLen = 8000) {
  const noScripts = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
  const textish = noScripts
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return textish.slice(0, maxLen)
}

/** Heurísticas leves para reputação (por URL e HTML) */
function buildReputationHints(url?: string, html?: string) {
  try {
    const u = url ? new URL(url) : null
    const domain = u?.hostname || ""
    const tld = domain.split(".").pop() || ""
    const suspiciousTlds = new Set(["xyz","top","shop","icu","live","click","cfd","gq","tk","ml","cf","ga"])
    const isSuspiciousTld = suspiciousTlds.has(tld.toLowerCase())

    const hasWhatsApp = !!html?.match(/(api\.whatsapp|wa\.me)\//i)
    const mentionsPix = !!html?.match(/\bpix\b/i)
    const mentionsCnpj = !!html?.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/i)
    const hasPrivacy = !!html?.match(/pol[ií]tica de privacidade|privacy policy/i)
    const hasContact = !!html?.match(/contato|fale conosco|telefone|endereço|sac/i)

    const sensitiveFields: string[] = []
    if (html?.match(/type=["']?password/i)) sensitiveFields.push("senha")
    if (html?.match(/\bcpf\b/i)) sensitiveFields.push("cpf")
    if (html?.match(/\b(token|c[oó]digo de seguran[çc]a)\b/i)) sensitiveFields.push("token")
    if (html?.match(/\bcart[aã]o|cvv\b/i)) sensitiveFields.push("cartao")
    if (html?.match(/\b(chave\s*pix|cop[íi]a e cola)\b/i)) sensitiveFields.push("chave_pix")

    return {
      domain,
      tld,
      isSuspiciousTld,
      hasWhatsApp,
      mentionsPix,
      mentionsCnpj,
      hasPrivacy,
      hasContact,
      sensitiveFields
    }
  } catch {
    return {
      domain: "",
      tld: "",
      isSuspiciousTld: false,
      hasWhatsApp: false,
      mentionsPix: false,
      mentionsCnpj: false,
      hasPrivacy: false,
      hasContact: false,
      sensitiveFields: []
    }
  }
}

/** Prompt: analisa SOMENTE a mensagem e as URLs citadas nela; ignora o site do formulário */
function buildPrompt(params: {
  message: string
  analyzedTargets: Array<{ url: string; htmlSummary: string; hints: any }>
}) {
  const { message, analyzedTargets } = params
  const targetsBlock = analyzedTargets.length
    ? analyzedTargets.map((t, i) => {
        return `--- ALVO ${i + 1} ---
URL: ${t.url}
HTML_RESUMO: ${t.htmlSummary || "indisponível"}
SINAIS_REPUTACAO: ${JSON.stringify(t.hints)}`
      }).join("\n\n")
    : "Nenhuma URL foi identificada na mensagem."

  return `Você é um analisador antifraude especializado em websites no Brasil.

IMPORTANTE:
- Analise SOMENTE o conteúdo da MENSAGEM do usuário e as URLs que ela contiver.
- IGNORE qualquer informação do site/landing/formulário onde o usuário está enviando esta mensagem.
- Se não houver URL na mensagem, avalie apenas o texto.
- Classifique como "Seguro", "Cautela" ou "Golpe detectado".
- "Golpe detectado" somente quando houver ≥2 sinais fortes OU 1 fortíssimo (ex.: coleta de senha/PIX/token, urgência/ameaça, domínio que imita marca + conteúdo falso, HTML com redirecionamentos/metas suspeitas/js ofuscado/iframe oculto/QR PIX falso).
- Prefira "Cautela" quando houver ambiguidade ou apenas sinais fracos.
- Responda APENAS no formato: [Classificação]: [Motivo curto em português brasileiro]
Exemplo: Golpe detectado: Contém pedido urgente de dados pessoais e links suspeitos.

DADOS
[MENSAGEM]
${message || "indisponível"}

[ALVOS EXTRAÍDOS DA MENSAGEM]
${targetsBlock}
`
}

export async function analyzeMessage(formData: FormData): Promise<AnalysisResult> {
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const message = formData.get("message") as string
  const pageUrl = formData.get("pageUrl") as string

  // Sanitize input - strip HTML tags (apenas na mensagem do usuário)
  const sanitizedMessage = (message || "").replace(/<[^>]*>/g, "").trim()

  // 1) Extrair URLs da MENSAGEM (não do nosso site)
  const urlsFromMessage = extractUrlsFromText(sanitizedMessage, 2)

  // 2) Baixar HTML SOMENTE das URLs encontradas na mensagem
  const analyzedTargets: Array<{ url: string; htmlSummary: string; hints: any }> = []
  for (const targetUrl of urlsFromMessage) {
    try {
      const resp = await fetch(targetUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; EscudoProBot/1.0)" },
        redirect: "follow"
      })
      if (resp.ok) {
        const ctype = resp.headers.get("content-type") || ""
        const isHtml = ctype.includes("text/html")
        const rawHtml = isHtml ? await resp.text() : ""
        const htmlSummary = rawHtml ? summarizeHtml(rawHtml) : ""
        const hints = buildReputationHints(targetUrl, htmlSummary)
        analyzedTargets.push({ url: targetUrl, htmlSummary, hints })
      } else {
        analyzedTargets.push({ url: targetUrl, htmlSummary: "", hints: buildReputationHints(targetUrl, "") })
      }
    } catch (e) {
      console.error("[v0] fetch target HTML error:", targetUrl, e)
      analyzedTargets.push({ url: targetUrl, htmlSummary: "", hints: buildReputationHints(targetUrl, "") })
    }
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY

    let analysisResult: AnalysisResult

    if (!apiKey) {
      console.error("[v0] GEMINI_API_KEY not found in environment variables")
      analysisResult = getMockAnalysis(sanitizedMessage)
    } else {
      const prompt = buildPrompt({ message: sanitizedMessage, analyzedTargets })

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.15, topP: 0.9, candidateCount: 1 }
          })
        }
      )

      if (!response.ok) {
        console.error(`[v0] API request failed: ${response.status} ${response.statusText}`)
        const errorText = await response.text()
        console.error(`[v0] API error response:`, errorText)
        analysisResult = getMockAnalysis(sanitizedMessage)
      } else {
        const data = await response.json()
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""

        // Parse no formato "[Classificação]: [Motivo]"
        const [classification, ...reasonParts] = aiResponse.split(":")
        const reason = reasonParts.join(":").trim()

        let verdict: "seguro" | "cautela" | "golpe" = "cautela"
        const cls = (classification || "").toLowerCase()

        if (cls.includes("seguro")) {
          verdict = "seguro"
        } else if (cls.includes("golpe")) {
          verdict = "golpe"
        } else {
          verdict = "cautela"
        }

        analysisResult = {
          verdict,
          reason: reason || "Análise concluída. Verifique as recomendações de segurança."
        }
      }
    }

    // 3) Persistência inalterada (mantém o padrão do seu site/DB)
    try {
      const supabase = await createClient()
      const { error: insertError } = await supabase.from("leads").insert({
        email,
        phone,
        page_url: pageUrl, // <— apenas registro, não usado na análise
        message: sanitizedMessage,
        analysis_result: analysisResult
      })

      if (insertError) {
        console.error("[v0] Error saving to Supabase:", insertError)
      } else {
        console.log("[v0] Lead saved successfully to Supabase:", {
          email,
          phone,
          pageUrl,
          verdict: analysisResult.verdict,
          timestamp: new Date().toISOString()
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
  const lowerMessage = (message || "").toLowerCase()

  // Heurística simples — mantém seu padrão de saída e conservadorismo
  const suspiciousKeywords = [
    "urgente","clique aqui","ganhe dinheiro","prêmio","parabéns",
    "conta bloqueada","confirme seus dados","pix","transferência",
    "código de segurança","whatsapp","link","cadastre-se"
  ]
  const safeKeywords = ["obrigado","agradecimento","informação","newsletter","confirmação de pedido","recibo"]

  const suspiciousCount = suspiciousKeywords.filter(k => lowerMessage.includes(k)).length
  const safeCount = safeKeywords.filter(k => lowerMessage.includes(k)).length

  if (suspiciousCount >= 2) {
    return { verdict: "golpe", reason: "Mensagem contém múltiplas palavras-chave suspeitas típicas de golpes." }
  } else if (suspiciousCount >= 1) {
    return { verdict: "cautela", reason: "Mensagem contém elementos que requerem atenção. Verifique a origem antes de agir." }
  } else if (safeCount > 0) {
    return { verdict: "seguro", reason: "Mensagem parece ser legítima, mas sempre confirme a origem." }
  } else {
    return { verdict: "cautela", reason: "Não foi possível determinar com certeza. Sempre verifique a origem da mensagem." }
  }
}
