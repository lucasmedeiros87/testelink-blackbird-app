"use server"

import { createClient } from "@/lib/supabase/server"

interface AnalysisResult {
  verdict: "seguro" | "cautela" | "golpe"
  reason: string
}

/* =========================
   Utils gerais (URLs, DOMÍNIOS, HTML, CNPJ)
   ========================= */

/** Extrai até N URLs http(s) do texto da mensagem */
function extractUrlsFromText(text: string, max = 2): string[] {
  const urls = new Set<string>()
  const urlRegex = /\bhttps?:\/\/[^\s<>"')]+/gi
  let m: RegExpExecArray | null
  while ((m = urlRegex.exec(text)) && urls.size < max) {
    try { urls.add(new URL(m[0]).toString()) } catch {}
  }
  return Array.from(urls)
}

/** Também extrai domínios “nus” (sem http/https), ex.: superbet.bet.br */
function extractBareDomains(text: string, max = 3): string[] {
  const out = new Set<string>()
  const re = /\b([a-z0-9-]+(?:\.[a-z0-9-]+){1,})\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) && out.size < max) {
    const token = (m[1] || "").toLowerCase()
    if (token.includes("@")) continue
    if (/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(token)) continue
    if (!/\.[a-z]{2,}(?:\.[a-z]{2,})?$/.test(token)) continue
    out.add(token)
  }
  return Array.from(out)
}

/** Normaliza hostname */
function getHostname(u: string): string | null {
  try { return new URL(u).hostname.toLowerCase() } catch { return null }
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

/* =========================
   Hints + Issues (linguagem popular)
   ========================= */

type Hints = {
  domain: string
  tld: string
  isHttps: boolean
  mentionsPix: boolean
  hasWhatsApp: boolean
  hasPrivacy: boolean
  hasContact: boolean
  cnpj: string | null
  cnpjValid: boolean
  ageDays: number | null
}

/** Extrai sinais de reputação leve (sem idade) a partir de URL + HTML */
function buildReputationHints(url?: string, html?: string): Omit<Hints, "ageDays"> {
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
    cnpj, cnpjValid: !!cnpj
  }
}

/** Constrói lista de problemas em linguagem popular para um alvo */
function collectIssues(hints: Hints): string[] {
  const issues: string[] = []
  if (!hints.cnpj) issues.push("não informa CNPJ")
  if (hints.cnpj && !hints.cnpjValid) issues.push("CNPJ parece inválido")
  if (!hints.hasPrivacy) issues.push("não tem política de privacidade")
  if (!hints.hasContact) issues.push("não mostra como falar com a empresa")
  if (hints.mentionsPix) issues.push("fala de PIX (pode ser cobrança)")
  if (hints.hasWhatsApp) issues.push("pede contato só por WhatsApp")
  if (typeof hints.ageDays === "number") {
    if (hints.ageDays < 60) issues.push(`site muito novo (só ${hints.ageDays} dias no ar)`)
  } else {
    issues.push("não deu pra saber há quanto tempo o site existe")
  }
  return issues
}

/* =========================
   RDAP GLOBAL (IANA bootstrap) — idade de domínio qualquer TLD
   ========================= */

let RDAP_BOOTSTRAP: Record<string, string[]> | null = null
let RDAP_BOOTSTRAP_FETCHED_AT = 0
const RDAP_BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000 // 24h

async function loadIanaBootstrap(): Promise<Record<string, string[]>> {
  if (RDAP_BOOTSTRAP && (Date.now() - RDAP_BOOTSTRAP_FETCHED_AT) < RDAP_BOOTSTRAP_TTL_MS) {
    return RDAP_BOOTSTRAP
  }
  try {
    const resp = await fetch("https://data.iana.org/rdap/dns.json", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EscudoProBot/1.0)" }
    })
    if (!resp.ok) throw new Error(`IANA bootstrap error: ${resp.status}`)
    const data = await resp.json()
    const map: Record<string, string[]> = {}
    const services = Array.isArray(data?.services) ? data.services : []
    for (const svc of services) {
      const tlds = Array.isArray(svc?.[0]) ? svc[0] : []
      const servers = Array.isArray(svc?.[1]) ? svc[1] : []
      for (const tld of tlds) {
        map[tld.toLowerCase()] = servers
      }
    }
    RDAP_BOOTSTRAP = map
    RDAP_BOOTSTRAP_FETCHED_AT = Date.now()
    return map
  } catch (e) {
    console.error("[rdap] erro carregando IANA bootstrap:", e)
    RDAP_BOOTSTRAP = {}
    RDAP_BOOTSTRAP_FETCHED_AT = Date.now()
    return RDAP_BOOTSTRAP
  }
}

async function rdapServersForTld(tld: string): Promise<string[]> {
  const bootstrap = await loadIanaBootstrap()
  return bootstrap[tld.toLowerCase()] || []
}

/** Idade (dias) para um host; tenta do host até “nome.tld” */
async function fetchDomainAgeDaysGlobal(host: string): Promise<number | null> {
  host = (host || "").toLowerCase()
  if (!host.includes(".")) return null
  const parts = host.split(".")
  const candidates: string[] = []
  for (let i = 0; i <= parts.length - 2; i++) {
    candidates.push(parts.slice(i).join("."))
  }

  for (const candidate of candidates) {
    const tld = candidate.split(".").pop() as string
    if (!tld) continue
    const servers = await rdapServersForTld(tld)
    if (!servers.length) continue

    for (const base of servers) {
      const baseUrl = base.endsWith("/") ? base.slice(0, -1) : base
      const url = `${baseUrl}/domain/${encodeURIComponent(candidate)}`
      try {
        const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; EscudoProBot/1.0)" } })
        if (resp.status === 404) continue
        if (!resp.ok) continue
        const json = await resp.json()
        const events: Array<{ eventAction: string; eventDate: string }> = json?.events || []
        const reg = events.find(e => e.eventAction === "registration")?.eventDate
        if (!reg) continue
        const created = new Date(reg).getTime()
        if (isNaN(created)) continue
        const days = Math.max(0, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)))
        return days
      } catch { continue }
    }
  }
  return null
}

/* =========================
   Allowlist de apostas (CONST + ENV)
   ========================= */

const norm = (d: string) => (d || "").trim().toLowerCase()

// NÃO exportar este Set
const AUTHORIZED_BET_DOMAINS = new Set<string>([
  "betano.bet.br","superbet.bet.br","magicjackpot.bet.br","super.bet.br",
  "reidopitaco.bet.br","pitaco.bet.br","rdp.bet.br","sportingbet.bet.br",
  "betboo.bet.br","big.bet.br","apostar.bet.br","caesars.bet.br",
  "betnacional.bet.br","kto.bet.br","betsson.bet.br","galera.bet.br",
  "f12.bet.br","luva.bet.br","brasil.bet.br","sporty.bet.br",
  "estrelabet.bet.br","vupi.bet.br","reals.bet.br","ux.bet.br",
  "bingo.bet.br","betfair.bet.br","7games.bet.br","betao.bet.br",
  "r7.bet.br","hiper.bet.br","novibet.bet.br","seguro.bet.br",
  "kingpanda.bet.br","9f.bet.br","6r.bet.br","betapp.bet.br",
  "ijogo.bet.br","fogo777.bet.br","p9.bet.br","bet365.bet.br",
  "apostaganha.bet.br","brazino777.bet.br","4win.bet.br","4play.bet.br",
  "pagol.bet.br","seu.bet.br","h2.bet.br","vbet.bet.br","vivaro.bet.br",
  "casadeapostas.bet.br","betsul.bet.br","jogoonline.bet.br",
  "esportesdasorte.bet.br","ona.bet.br","lottu.bet.br","betfast.bet.br",
  "faz1.bet.br","tivo.bet.br","suprema.bet.br","maxima.bet.br",
  "ultra.bet.br","betesporte.bet.br","lancedesorte.bet.br",
  "betmgm.bet.br","mgm.bet.br","tiger.bet.br","pq777.bet.br",
  "5g.bet.br","bravo.bet.br","tradicional.bet.br","apostatudo.bet.br",
  "sorteonline.bet.br","lottoland.bet.br","arenaplus.bet.br",
  "gameplus.bet.br","bingoplus.bet.br","pix.bet.br","fla.bet.br",
  "betdasorte.bet.br","apostou.bet.br","b1bet.bet.br","brbet.bet.br",
  "betgorillas.bet.br","betbuffalos.bet.br","betfalcons.bet.br",
  "bateu.bet.br","esportiva.bet.br","betwarrior.bet.br",
  "sortenabet.bet.br","betou.bet.br","betfusion.bet.br","bandbet.bet.br",
  "afun.bet.br","ai.bet.br","6z.bet.br","blaze.bet.br","jonbet.bet.br",
  "7k.bet.br","cassino.bet.br","vera.bet.br","bau.bet.br","telesena.bet.br",
  "milhao.bet.br","vert.bet.br","cgg.bet.br","fanbit.bet.br","up.bet.br",
  "9d.bet.br","wjcasino.bet.br","kbet.bet.br","alfa.bet.br","mmabet.bet.br",
  "betvip.bet.br","papigames.bet.br","bet4.bet.br","aposta.bet.br",
  "fazo.bet.br","esportivavip.bet.br","cbesportes.bet.br",
  "donosdabola.bet.br","br4.bet.br","goldebet.bet.br","lotogreen.bet.br",
  "bolsadeaposta.bet.br","fulltbet.bet.br","betbra.bet.br","pinnacle.bet.br",
  "matchbook.bet.br","betespecial.bet.br","betboom.bet.br","aposta1.bet.br",
  "apostamax.bet.br","aviao.bet.br","ginga.bet.br","qg.bet.br",
  "vivasorte.bet.br","bacanaplay.bet.br","playuzu.bet.br","betcopa.bet.br",
  "brasildasorte.bet.br","fybet.bet.br","multi.bet.br","rico.bet.br",
  "brx.bet.br","stake.bet.br","betcaixa.bet.br","megabet.bet.br",
  "xbetcaixa.bet.br","jogalimpo.bet.br","energia.bet.br","spin.bet.br",
  "oleybet.bet.br","betpark.bet.br","meridianbet.bet.br","nossa.bet.br",
  "pin.bet.br","versus.bet.br","luck.bet.br","1pra1.bet.br","start.bet.br",
  "esporte365.bet.br","betaki.bet.br","jogodeouro.bet.br","lider.bet.br",
  "geralbet.bet.br","b2x.bet.br","bullsbet.bet.br","jogao.bet.br",
  "jogos.bet.br","betpontobet.bet.br","donald.bet.br","1xbet.bet.br",
  "rivalo.bet.br","a247.bet.br","mcgames.bet.br","mcgamesbet.bet.br",
  "montecarlos.bet.br","megaposta.bet.br",
].map(norm))

/** ENV opcional para complementar a allowlist via painel: BET_AUTH_DOMAINS="foo.bet.br,bar.bet.br" */
function loadAuthorizedBetDomainsLocal(): Set<string> {
  const out = new Set<string>(AUTHORIZED_BET_DOMAINS)
  const envRaw = process.env.BET_AUTH_DOMAINS || ""
  envRaw.split(",").map(norm).filter(Boolean).forEach(d => out.add(d))
  return out
}

/** host é autorizado se for igual ou subdomínio de um autorizado */
function isHostAuthorizedBySet(host: string, set: Set<string>): boolean {
  host = norm(host)
  if (!host) return false
  if (set.has(host)) return true
  for (const auth of set) {
    if (host === auth) return true
    if (host.endsWith("." + auth)) return true
  }
  return false
}

/* =========================
   Heurística rápida (bloqueio imediato com allowlist)
   ========================= */

/** Heurísticas p/ apostas, empréstimos e pornografia (usa allowlist CONST+ENV) */
async function fastHeuristicCheckAsync(message: string, urlsOrDomains: string[]): Promise<AnalysisResult | null> {
  const txt = (message || "").toLowerCase()

  // Padrões por texto
  const hasGambling = /(bet|casino|slots|pggame|spincash|pg\s*game|777|slot|casino)/i.test(txt)
  const hasLoan = /(empr[eé]stimo|empr[eé]stimos|parceladiaria|parcela di[aá]ria|cr[eé]dito r[aá]pido|pix na hora|empr[eé]stimo no pix)/i.test(txt)
  const hasPorn = /\b(porn|xvideos|xhamster|xnxx|redtube|brazzers|onlyfans|sex|adulto|er[oó]tico)\b/i.test(txt)

  const gamblingHints = /(bet|casino|slots|pggame|spincash|pg(?:game)?|777|slot|pgg)/i
  const loanHints = /(emprest|parcela|credito|pix)/i
  const pornHints = /(porn|sex|adult|onlyfans|xvideo|xnxx|xhamster|redtube|brazzers)/i

  // Hosts de tudo (urls e domínios nus)
  const hosts: string[] = []
  for (const token of urlsOrDomains) {
    const hostFromUrl = getHostname(token)
    if (hostFromUrl) hosts.push(hostFromUrl)
    else hosts.push(norm(token))
  }

  const badTLDs = [".site", ".online", ".shop", ".xyz", ".cc", ".top"]
  const hasBadDomain = hosts.some(h =>
    badTLDs.some(tld => h.endsWith(tld)) || gamblingHints.test(h) || loanHints.test(h) || pornHints.test(h)
  )

  // Pornografia: bloqueio direto
  if (hasPorn || (hasBadDomain && hosts.some(h => pornHints.test(h)))) {
    return { verdict: "golpe", reason: "O link leva para conteúdo adulto em site suspeito." }
  }

  // Empréstimos: domínio suspeito + termos de empréstimo -> golpe
  if (hasLoan && hasBadDomain) {
    return { verdict: "golpe", reason: "Oferta de empréstimo em site suspeito e sem sinais claros de empresa real." }
  }

  // Apostas/jogos: checa allowlist (CONST + ENV)
  const hasGamblingByHost = hosts.some(h => gamblingHints.test(h))
  if (hasGambling || hasGamblingByHost) {
    const allow = loadAuthorizedBetDomainsLocal()
    const anyAuthorized = hosts.some(h => isHostAuthorizedBySet(h, allow))
    if (!anyAuthorized) {
      return { verdict: "golpe", reason: "Esse site de apostas não aparece na lista de sites permitidos no Brasil." }
    }
    // se autorizado, segue fluxo normal
  }

  return null
}

/* =========================
   Prompt (passando resumo da allowlist)
   ========================= */

function buildPrompt(params: {
  message: string
  analyzedTargets: Array<{ url: string; htmlSummary: string; hints: Omit<Hints,"ageDays"> }>
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

  // Passa uma amostra da allowlist para contexto do LLM (evita prompt gigante)
  const allow = Array.from(loadAuthorizedBetDomainsLocal())
  const allowExamples = allow.slice(0, 40).join(", ")
  const allowNote = `ALLOWLIST_APOSTAS: total=${allow.length}; exemplos: ${allowExamples}`

  return `Você é um analisador antifraude no Brasil. Analise SOMENTE o que foi fornecido.

Entrada:
- Texto do usuário.
- URLs/domínios citados.
- Sinais já coletados: TLD/HTTPS, CNPJ (válido/indisponível), Política/Contato, menções a PIX/WhatsApp.
- ${allowNote}

Critérios:
- "Golpe detectado" quando houver ≥2 sinais fortes negativos OU 1 fortíssimo:
  • Não tem CNPJ/empresa e pede dados sensíveis/urgência
  • Pede CPF/senha/token/seed/cartão sem ser serviço oficial
  • Linguagem de urgência/ameaça + link suspeito
- "Seguro" quando:
  • Aparência institucional; CNPJ válido; políticas/contatos claros
  • Não pede dados suspeitos
- "Cautela" quando:
  • Sinais fracos/ambíguos (só HTTPS/TLD)
  • Não informa CNPJ; pouca transparência
  • Link expirado/sem contexto

Regras extras:
- APOSTAS: se o domínio NÃO estiver na allowlist (exemplos acima, e validação feita fora do seu texto) → classifique como "Golpe detectado".
- EMPRÉSTIMOS/CRÉDITO RÁPIDO: em domínio novo/suspeito e sem CNPJ → "Golpe detectado".
- PORNOGRAFIA: em domínio suspeito/encurtador → "Golpe detectado".

⚠️ IMPORTANTE:
- SSL/HTTPS é só um sinal fraco.
- Na dúvida, use "Cautela".
- Não invente dados externos.

Responda APENAS neste formato (sem variações):
[Classificação]: [Motivo curto e popular em português brasileiro]

Exemplo:
Golpe detectado: Site de apostas fora da lista permitida no Brasil.

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

  const sanitizedMessage = (message || "").replace(/<[^>]*>/g, "").trim()

  // URLs + domínios nus
  const urlsFromMessage = extractUrlsFromText(sanitizedMessage, 2)
  const bareDomains = extractBareDomains(sanitizedMessage, 3)
  const tokensForHeuristic = [...urlsFromMessage, ...bareDomains]

  // Heurística imediata
  const heuristicVerdict = await fastHeuristicCheckAsync(sanitizedMessage, tokensForHeuristic)
  if (heuristicVerdict) {
    try {
      const supabase = await createClient()
      await supabase.from("leads").insert({
        email,
        phone,
        page_url: pageUrl,
        message: sanitizedMessage,
        analysis_result: heuristicVerdict
      })
    } catch (e) {
      console.error("[v0] Supabase error (heuristic):", e)
    }
    return heuristicVerdict
  }

  // Baixa HTML só das URLs
  const analyzedTargets: Array<{ url: string; htmlSummary: string; hints: Omit<Hints,"ageDays"> }> = []
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

  // Idade de domínio (global via RDAP)
  const analyzedWithAges: Array<{ url: string; htmlSummary: string; hints: Hints }> = []
  for (const item of analyzedTargets) {
    const host = getHostname(item.url) || ""
    const ageDays = host ? await fetchDomainAgeDaysGlobal(host) : null
    analyzedWithAges.push({ url: item.url, htmlSummary: item.htmlSummary, hints: { ...item.hints, ageDays } })
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
        const llmReasonRaw = reasonParts.join(":").trim()

        // Normaliza motivo do LLM para linguagem popular (garantir simplicidade)
        const llmReason = llmReasonRaw
          .replace(/CNPJ indispon[ií]vel/gi, "não informa CNPJ")
          .replace(/pol[ií]tica de privacidade ausente/gi, "não tem política de privacidade")
          .replace(/informa[cç][oõ]es de contato ausentes/gi, "não mostra como falar com a empresa")
          .replace(/dom[ií]nio recente/gi, "site muito novo")
          .replace(/conte[úu]do adulto/gi, "conteúdo adulto")
          .replace(/\s+/g, " ")
          .trim()

        let verdict: "seguro" | "cautela" | "golpe" = "cautela"
        const cls = (classification || "").toLowerCase()
        if (cls.includes("seguro")) verdict = "seguro"
        else if (cls.includes("golpe")) verdict = "golpe"
        else verdict = "cautela"

        // Monta problemas por URL (linguagem popular)
        const perUrlIssues: string[] = []
        for (const t of analyzedWithAges) {
          const issues = collectIssues(t.hints)
          if (issues.length) perUrlIssues.push(`[${t.url}] ${issues.join("; ")}`)
        }

        const finalReason =
          perUrlIssues.length
            ? (llmReason ? `${llmReason} | ${perUrlIssues.join(" | ")}` : perUrlIssues.join(" | "))
            : (llmReason || "Análise feita. Use com atenção.")

        analysisResult = { verdict, reason: finalReason }
      }
    }

    // Persistência INALTERADA
    try {
      const supabase = await createClient()
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
          email, phone, pageUrl,
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

/* =========================
   Mock (linguagem popular)
   ========================= */

function getMockAnalysis(message: string): AnalysisResult {
  const lowerMessage = (message || "").toLowerCase()

  const suspiciousKeywords = [
    "urgente", "clique aqui", "ganhe dinheiro", "prêmio", "parabéns",
    "conta bloqueada", "confirme seus dados", "pix", "transferência",
    "código de segurança", "whatsapp", "link", "cadastre-se",
  ]
  const safeKeywords = ["obrigado", "agradecimento", "informação", "newsletter", "confirmação de pedido", "recibo"]

  const suspiciousCount = suspiciousKeywords.filter((k) => lowerMessage.includes(k)).length
  const safeCount = safeKeywords.filter((k) => lowerMessage.includes(k)).length

  if (suspiciousCount >= 2) {
    return { verdict: "golpe", reason: "Tem vários sinais de golpe na mensagem." }
  } else if (suspiciousCount >= 1) {
    return { verdict: "cautela", reason: "Tem alguns sinais estranhos. Melhor conferir antes de agir." }
  } else if (safeCount > 0) {
    return { verdict: "seguro", reason: "Parece mensagem normal, mas sempre confira a fonte." }
  } else {
    return { verdict: "cautela", reason: "Não deu pra ter certeza. Melhor conferir a origem." }
  }
}
