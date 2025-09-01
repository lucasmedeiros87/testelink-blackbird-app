"use server"

import { createClient } from "@/lib/supabase/server"

interface AnalysisResult {
  verdict: "seguro" | "cautela" | "golpe"
  reason: string
}

/** Remove <script>/<style>, normaliza espaços e limita tamanho */
function summarizeHtml(raw: string, maxLen = 12000) {
  const noScripts = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
  const textish = noScripts
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return textish.slice(0, maxLen)
}

/** Heurísticas leves (não dependem de serviços externos) */
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

/** Prompt calibrado (saída JSON) */
function buildPrompt(params: {
  message: string
  pageUrl?: string
  htmlSummary?: string
  reputationHintsJson?: string
}) {
  const { message, pageUrl, htmlSummary, reputationHintsJson } = params
  return `Você é um analisador antifraude especializado em websites no Brasil.

Você receberá:
1) Mensagem do usuário (contexto do contato).
2) URL da página.
3) Resumo do HTML da página (texto visível + campos de formulário, sem <script>).
4) Sinais de reputação calculados pelo sistema (ex.: TLD, inputs sensíveis, menção de CNPJ, links de WhatsApp).

Tarefa:
Classifique o risco como uma das opções: "seguro", "cautela" ou "golpe".
- "golpe": use APENAS quando houver ≥2 sinais fortes OU 1 fortíssimo, por ex.:
  • Solicitação direta de dados sensíveis (senha, token, código de segurança, chave PIX, cartão) em página não-oficial
  • Linguagem de urgência/ameaça ("conta bloqueada", "prazo imediato", "clique para liberar")
  • Domínio que imita marca (IDN/homógrafo/TLD incomum) + conteúdo que finge ser essa marca
  • HTML com padrões maliciosos (redirecionamentos encadeados, meta refresh suspeito, js ofuscado com eval/atob, iframes ocultos, QR PIX falso)
  • Links de pagamento/PIX/WhatsApp pressionando ação imediata sem identificação clara
- "seguro": quando NÃO houver sinais fortes e os sinais de reputação forem CONSISTENTES E POSITIVOS (CNPJ válido/contato verificável/política de privacidade clara, linguagem neutra, sem coleta sensível).
- "cautela": caso haja 1 sinal forte isolado, ou sinais fracos/ambíguos, ou reputação indefinida.

Considere também sinais POSITIVOS:
- CNPJ no rodapé, política de privacidade, canais oficiais coerentes, endereço/telefone verificáveis
- Texto institucional consistente, ausência de urgência e de coleta sensível
- TLD/domínio compatíveis com a marca/negócio

Saída:
Responda ESTRITAMENTE em JSON (sem texto fora do JSON) com esta estrutura:

{
  "verdict": "seguro" | "cautela" | "golpe",
  "reason": "frase curta e objetiva",
  "confidence": 0.0-1.0,
  "risk_score": 0-100,
  "signals": [
    {"type": "url|html|texto|reputacao", "severity": "fraco|moderado|forte|fortissimo", "evidence": "trecho ou explicação curta"}
  ],
  "site": {
    "brand_spoof": "nome-da-marca-ou-null",
    "url_mismatch": true|false,
    "tld": "xyz|com|... ",
    "has_pix_elements": true|false,
    "collects_sensitive_fields": ["senha","cpf","token","cartao","chave_pix"]
  },
  "reputation": {
    "mentions_cnpj": true|false,
    "privacy_policy": true|false,
    "contact_info": true|false,
    "external_reviews": "positivo|misto|negativo|desconhecido"
  }
}

Importante:
- Prefira "cautela" ao invés de "golpe" quando os sinais forem insuficientes/ambíguos.
- Baseie-se APENAS nos dados fornecidos (mensagem, URL, HTML resumido e sinais).
- Seja objetivo e não invente dados externos não fornecidos.

Dados para análise:
[MENSAGEM]
${message || "indisponível"}

[URL]
${pageUrl || "não informada"}

[HTML_RESUMO]
${htmlSummary || "indisponível"}

[SINAIS_REPUTACAO]
${reputationHintsJson || "{}"}`
}

export async function analyzeMessage(formData: FormData): Promise<AnalysisResult> {
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const message = formData.get("message") as string
  const pageUrl = formData.get("pageUrl") as string

  // Sanitize input - strip HTML tags
  const sanitizedMessage = (message || "").replace(/<[^>]*>/g, "").trim()

  // (opcional) tentar baixar HTML da página
  let rawHtml = ""
  try {
    if (pageUrl) {
      const resp = await fetch(pageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; EscudoProBot/1.0)" },
        redirect: "follow"
      })
      if (resp.ok) {
        // evita carregar binários
        const ctype = resp.headers.get("content-type") || ""
        if (ctype.includes("text/html")) {
          rawHtml = await resp.text()
        }
      }
    }
  } catch (e) {
    // segue sem HTML
    console.error("[v0] fetch HTML error:", e)
  }

  const htmlSummary = rawHtml ? summarizeHtml(rawHtml) : ""
  const reputationHints = buildReputationHints(pageUrl, htmlSummary)
  const reputationHintsJson = JSON.stringify(reputationHints)

  try {
    const apiKey = process.env.GEMINI_API_KEY

    let analysisResult: AnalysisResult

    if (!apiKey) {
      console.error("[v0] GEMINI_API_KEY not found in environment variables")
      analysisResult = getMockAnalysis(sanitizedMessage)
    } else {
      const prompt = buildPrompt({
        message: sanitizedMessage,
        pageUrl,
        htmlSummary,
        reputationHintsJson
      })

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.15,
              topP: 0.9,
              candidateCount: 1
            }
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
        const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""

        // Tentar parsear JSON strict; fallback para parsing simples por ':'
        let verdict: AnalysisResult["verdict"] = "cautela"
        let reason = "Análise concluída. Verifique as recomendações de segurança."

        let parsedOk = false
        if (aiText.startsWith("{")) {
          try {
            const parsed = JSON.parse(aiText)
            const v = String(parsed?.verdict || "").toLowerCase()
            if (v.includes("seguro")) verdict = "seguro"
            else if (v.includes("golpe")) verdict = "golpe"
            else verdict = "cautela"
            if (parsed?.reason) reason = String(parsed.reason)
            parsedOk = true
          } catch {
            parsedOk = false
          }
        }

        if (!parsedOk) {
          const [classification, ...reasonParts] = aiText.split(":")
          const r = reasonParts.join(":").trim()
          if ((classification || "").toLowerCase().includes("seguro")) verdict = "seguro"
          else if ((classification || "").toLowerCase().includes("golpe")) verdict = "golpe"
          reason = r || reason
        }

        analysisResult = { verdict, reason }
      }
    }

    try {
      const supabase = await createClient()
      // ⚠️ Mantido exatamente como estava para não quebrar o site/DB
      const { error: insertError } = await supabase.from("leads").insert({
        email,
        phone,
        page_url: pageUrl,
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

  // Simple keyword-based analysis for demo (inalterado para manter compatibilidade)
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
