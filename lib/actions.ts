"use server"

import { createClient } from "@/lib/supabase/server"

interface AnalysisResult {
  verdict: "seguro" | "cautela" | "golpe"
  reason: string
}

/* =========================
   Utils gerais (URLs, HTML, CNPJ)
   ========================= */

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
function summarizeHtml(raw: string, maxLen = 9000) {
  const noScripts = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
  const textish = noScripts
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return textish.slice(0, maxLen)
}

/** Valida CNPJ (14 dígitos) */
function validateCNPJ(cnpjRaw: string): boolean {
  const cnpj = (cnpjRaw || "").replace(/\D/g, "")
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false
  const calc = (base: string, peso: number[]) =>
    (base.split("").reduce((sum, n, i) => sum + parseInt(n,10)*peso[i], 0) % 11)
  const p1 = [5,4,3,2,9,8,7,6,5,4,3,2]
  const p2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
  const d1 = calc(cnpj.slice(0,12), p1); const dv1 = (d1 < 2) ? 0 : 11 - d1
  const d2 = calc(cnpj.slice(0,12) + dv1, p2); const dv2 = (d2 < 2) ? 0 : 11 - d2
  return cnpj.slice(12) === `${dv1}${dv2}`
}

/** Extrai sinais de reputação leve a partir de URL + HTML */
function buildReputationHints(url?: string, html?: string) {
  let domain = ""
  let tld = ""
  let isHttps = false
  try {
    const u = url ? new URL(url) : null
    domain = u?.hostname || ""
    tld = domain.split(".").pop() || ""
    isHttps = (u?.protocol === "https:")
  } catch {}

  const s = (html || "")
  const mentionsPix = /\bpix\b/i.test(s)
  const hasWhatsApp = /(api\.whatsapp|wa\.me)\//i.test(s)
  const hasPrivacy = /pol[ií]tica de privacidade|privacy policy/i.test(s)
  const hasContact = /contato|fale conosco|telefone|endereço|sac/i.test(s)

  // CNPJ no conteúdo (valida DV)
  let cnpj: string | null = null
  const m = s.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/g)
  if (m) {
    for (const cand of m) {
      const digits = cand.replace(/\D/g, "")
      if (validateCNPJ(digits)) { cnpj = digits; break }
    }
  }

  return {
    domain, tld, isHttps,
    mentionsPix, hasWhatsApp, hasPrivacy, hasContact,
    cnpj, cnpjValid: cnpj ? true : false
  }
}

/* =========================
   Prompt (sem votação popular, sem PIX/EMV)
   ========================= */

function buildPrompt(params: {
  message: string
  analyzedTargets: Array<{ url: string; htmlSummary: string; hints: ReturnType<typeof buildReputationHints> }>
}) {
  const { message, analyzedTargets } = params

  const targetsBlock = analyzedTargets.length
    ? analyzedTargets.map((t, i) => {
        const h = t.hints
        return `--- ALVO ${i + 1} ---
URL: ${t.url}
TLD: ${h.tld || "—"} | HTTPS: ${h.isHttps ? "sim" : "não"}
SINAIS:
- CNPJ: ${h.cnpj ? h.cnpj : "indisponível"} (válido: ${h.cnpjValid ? "sim" : "não"})
- Política de Privacidade: ${h.hasPrivacy ? "sim" : "não"}
- Contato oficial: ${h.hasContact ? "sim" : "não"}
- Menções a PIX: ${h.mentionsPix ? "sim" : "não"}
- Links WhatsApp: ${h.hasWhatsApp ? "sim" : "não"}

HTML_RESUMO:
${t.htmlSummary || "indisponível"}`
      }).join("\n\n")
    : "Nenhuma URL foi identificada na mensagem."

  return `Você é um analisador antifraude especializado em domínios e websites no Brasil.

Entrada:
- Texto do usuário (mensagem).
- URLs citadas na mensagem.
- Sinais de reputação já coletados por URL: tempo de domínio NÃO está disponível aqui; considere TLD/HTTPS/CNPJ/privacidade/contato/menções a PIX/WhatsApp.

Regras de análise:
- "Golpe detectado" apenas se houver ≥2 sinais fortes negativos OU 1 fortíssimo:
  • Ausência de CNPJ/empresa válida combinada com sinais de coleta sensível/urgência
  • Reputação externa negativa (se fornecida) ou evidências de fraude no conteúdo
  • Linguagem de urgência/ameaça + link suspeito
  • Página solicita senha/token/chave PIX/cartão sem contexto oficial
- "Seguro" quando:
  • Conteúdo consistente e institucional; CNPJ válido; políticas/contatos claros
  • Nenhum pedido suspeito de dados
- "Cautela" quando:
  • Há sinais fracos/ambíguos (ex.: somente TLD/HTTPS sem mais evidências)
  • CNPJ não informado/indisponível; poucas informações externas
  • Conteúdo neutro (ex.: instrução operacional ou link expirado) sem coleta sensível

⚠️ IMPORTANTE:
- Não trate SSL/HTTPS como prova de segurança (apenas sinal fraco).
- Prefira "Cautela" em casos ambíguos.

Responda APENAS no formato:
[Classificação]: [Motivo curto e objetivo em português brasileiro]

Exemplo:
Golpe detectado: Domínio sem identificação empresarial e coleta de dados sensíveis.

[DADOS DA MENSAGEM]
${message || "indisponível"}

[ALVOS]
${targetsBlock}
`
}

/* =========================
   Função principal (assinatura e insert mantidos)
   ========================= */

export async function analyzeMessage(formData: FormData): Promise<AnalysisResult> {
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const message = formData.get("message") as string
  const pageUrl = formData.get("pageUrl") as string

  // Sanitize input - strip HTML tags (apenas da mensagem)
  const sanitizedMessage = (message || "").replace(/<[^>]*>/g, "").trim()

  // 1) Extrair URLs da MENSAGEM (não usar pageUrl do seu site para análise)
  const urlsFromMessage = extractUrlsFromText(sanitizedMessage, 2)

  // 2) Baixar HTML SOMENTE das URLs da mensagem
  const analyzedTargets: Array<{ url: string; htmlSummary: string; hints: ReturnType<typeof buildReputationHints> }> = []
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
        const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""

        // Parse "[Classificação]: [Motivo]"
        const [classification, ...reasonParts] = aiResponse.split(":")
        const reason = reasonParts.join(":").trim()

        let verdict: "seguro" | "cautela" | "golpe" = "cautela"
        const cls = (classification || "").toLowerCase()
        if (cls.includes("seguro")) verdict = "seguro"
        else if (cls.includes("golpe")) verdict = "golpe"
        else verdict = "cautela"

        analysisResult = {
          verdict,
          reason: reason || "Análise concluída. Verifique as recomendações de segurança."
        }
      }
    }

    // 3) Persistência INALTERADA
    try {
      const supabase = await createClient()
      const { error: insertError } = await supabase.from("leads").insert({
        email,
        phone,
        page_url: pageUrl, // apenas registro (não usado na análise)
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

/* Mock inalterado (mantido) */
function getMockAnalysis(message: string): AnalysisResult {
  const lowerMessage = (message || "").toLowerCase()

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
    return { verdict: "golpe", reason: "Mensagem contém múltiplas palavras-chave suspeitas típicas de golpes." }
  } else if (suspiciousCount >= 1) {
    return { verdict: "cautela", reason: "Mensagem contém elementos que requerem atenção. Verifique a origem antes de agir." }
  } else if (safeCount > 0) {
    return { verdict: "seguro", reason: "Mensagem parece ser legítima, mas sempre confirme a origem." }
  } else {
    return { verdict: "cautela", reason: "Não foi possível determinar com certeza. Sempre verifique a origem da mensagem." }
  }
}
