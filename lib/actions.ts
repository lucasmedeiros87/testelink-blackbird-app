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

/** Detecta padrões de conteúdo adulto no HTML */
function detectAdultContentPatterns(html: string, url: string): boolean {
  const content = html.toLowerCase()
  const hostname = getHostname(url)?.toLowerCase() || ""
  
  // Padrões específicos em JSON/dados estruturados
  if (/"isAdult"\s*:\s*true/i.test(html)) return true
  if (/"adult"\s*:\s*true/i.test(html)) return true
  
  // Plataformas conhecidas de conteúdo adulto
  const adultPlatforms = [
    'onlyfans', 'pornhub', 'xvideos', 'xhamster', 'redtube', 'brazzers', 
    'chaturbate', 'stripchat', 'cam4', 'livejasmin', 'myfreecams',
    'fansly', 'justforfans', 'manyvids', 'clips4sale'
  ]
  
  // Verifica se menciona plataformas adultas
  for (const platform of adultPlatforms) {
    if (content.includes(platform)) return true
  }
  
  // Hostnames suspeitos
  const suspiciousHosts = ['link.me', 'linktr.ee', 'allmylinks.com', 'linktree.com']
  const isSuspiciousHost = suspiciousHosts.some(host => hostname.includes(host))
  
  // Em hosts suspeitos, procura por indicadores específicos
  if (isSuspiciousHost) {
    const adultKeywords = [
      'onlyfans', 'adult content', '18+', 'xxx', 'nsfw', 'premium content',
      'subscription', 'exclusive content', 'cam', 'webcam', 'live show',
      'sexy', 'nude', 'erotic', 'fetish', 'kink'
    ]
    
    for (const keyword of adultKeywords) {
      if (content.includes(keyword)) return true
    }
  }
  
  // Padrões no título/meta
  if (/<title[^>]*>.*?(porn|adult|sex|xxx|18\+|nude|erotic).*?<\/title>/i.test(html)) return true
  if (/<meta[^>]*content=["'][^"']*(porn|adult|sex|xxx|18\+|nude|erotic)[^"']*["'][^>]*>/i.test(html)) return true
  
  return false
}

/** Detecta padrões de golpe financeiro/phishing */
function detectFinancialScamPatterns(html: string, url: string): { isScam: boolean; reason: string } {
  const content = html.toLowerCase()
  const hostname = getHostname(url)?.toLowerCase() || ""
  
  // Domínios suspeitos para imitação
  const suspiciousPlatforms = [
    'vercel.app', 'netlify.app', 'heroku.com', 'github.io', 'firebase.app',
    'surge.sh', 'now.sh', 'glitch.me', 'replit.dev'
  ]
  
  const isSuspiciousPlatform = suspiciousPlatforms.some(platform => hostname.includes(platform))
  
  // Nomes de empresas legítimas sendo imitadas
  const legitimateCompanies = [
    'mercado livre', 'mercadolivre', 'nubank', 'itau', 'bradesco', 'santander',
    'caixa', 'banco do brasil', 'inter', 'picpay', 'paypal', 'pix', 'banco central',
    'receita federal', 'cpf', 'spc', 'serasa', 'facebook', 'whatsapp', 'instagram'
  ]
  
  // Verifica se imita empresa legítima em plataforma suspeita
  const imitatesCompany = legitimateCompanies.some(company => content.includes(company))
  
  if (isSuspiciousPlatform && imitatesCompany) {
    return {
      isScam: true,
      reason: "Site hospedado em plataforma suspeita imitando empresa legítima"
    }
  }
  
  // Padrões de checkout/pagamento suspeitos
  const checkoutScamPatterns = [
    // Textos típicos de ativação fraudulenta
    /ativar conta.*r\$\s*\d+/i,
    /ativa[çc][aã]o.*pix/i,
    /limite.*dispon[ií]vel/i,
    /saldo.*conta/i,
    
    // UUIDs em URLs (padrão comum em golpes)
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    
    // Valores baixos para "ativação"
    /ativa[çc][aã]o.*r\$\s*[1-9][0-9]?,00/i,
    /taxa.*ativa[çc][aã]o.*r\$\s*[1-9][0-9]?,00/i,
    
    // Novos padrões de golpes PIX
    /agiliza.*pag/i,
    /pague.*agora.*pix/i,
    /confirme.*dados.*pix/i,
    /finalize.*pagamento/i
  ]
  
  // Verifica se é domínio de pagamento suspeito
  const paymentScamDomains = [
    'agilizapag.site',
    'rapidopag.site', 
    'instantpag.site',
    'quickpag.site'
  ]
  
  const isPaymentScamDomain = paymentScamDomains.some(domain => hostname.includes(domain))
  
  if (isPaymentScamDomain) {
    return {
      isScam: true,
      reason: "Site de pagamento falso se passando por empresa legítima"
    }
  }
  
  for (const pattern of checkoutScamPatterns) {
    if (pattern.test(content)) {
      return {
        isScam: true,
        reason: "Padrão típico de golpe de ativação de conta"
      }
    }
  }
  
  // Depoimentos falsos (muitas estrelas + linguagem específica)
  const fakeTestimonialPatterns = [
    /★{4,5}.*j[aá]\s+mandei.*fam[ií]lia/i,
    /★{4,5}.*certinho.*funcionando/i,
    /★{4,5}.*salvou.*contas.*m[eê]s/i,
    /★{4,5}.*TOP.*limite/i
  ]
  
  for (const pattern of fakeTestimonialPatterns) {
    if (pattern.test(content)) {
      return {
        isScam: true,
        reason: "Depoimentos suspeitos com linguagem típica de golpe"
      }
    }
  }
  
  // URLs de sucesso suspeitas
  const successUrlPattern = /"successPage":"([^"]*)/i
  const successMatch = successUrlPattern.exec(html)
  if (successMatch) {
    const successUrl = successMatch[1].toLowerCase()
    if (successUrl.includes('minha-conta.online') || 
        successUrl.includes('up2') ||
        suspiciousPlatforms.some(platform => successUrl.includes(platform))) {
      return {
        isScam: true,
        reason: "URL de redirecionamento suspeita após pagamento"
      }
    }
  }
  
  return { isScam: false, reason: "" }
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
  
  // Apenas idade do domínio (indicador importante de sites suspeitos)
  if (typeof hints.ageDays === "number") {
    if (hints.ageDays < 30) issues.push(`site muito novo (só ${hints.ageDays} dias)`)
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
   Allowlist de apostas (CONST + ENV) + Sites de alta confiança
   ========================= */

const norm = (d: string) => (d || "").trim().toLowerCase()

// Sites de alta confiança e relevância mundial
const TRUSTED_DOMAINS = new Set<string>([
  // Tech Giants
  "google.com", "microsoft.com", "apple.com", "amazon.com", "meta.com", "facebook.com",
  "instagram.com", "youtube.com", "twitter.com", "x.com", "linkedin.com", "github.com",
  "stackoverflow.com", "reddit.com", "wikipedia.org", "openai.com", "adobe.com",
  
  // Bancos e Instituições Financeiras BR
  "bb.com.br", "caixa.gov.br", "bradesco.com.br", "itau.com.br", "santander.com.br",
  "bancointer.com.br", "nubank.com.br", "btgpactual.com", "original.com.br",
  "sicoob.com.br", "sicredi.com.br", "c6bank.com.br", "next.me", "99pay.com.br",
  "picpay.com", "mercadopago.com.br", "pagseguro.uol.com.br", "paypal.com",
  
  // E-commerce BR
  "mercadolivre.com.br", "americanas.com.br", "magazineluiza.com.br", "casasbahia.com.br",
  "extra.com.br", "pontofrio.com.br", "shoptime.com.br", "submarino.com.br",
  "amazon.com.br", "netshoes.com.br", "dafiti.com.br", "enjoei.com.br",
  
  // Governo BR
  "gov.br", "receita.fazenda.gov.br", "caixa.gov.br", "inss.gov.br", "tse.jus.br",
  "stf.jus.br", "planalto.gov.br", "bcb.gov.br", "susep.gov.br", "cvm.gov.br",
  
  // Mídia e Notícias BR
  "globo.com", "uol.com.br", "folha.uol.com.br", "estadao.com.br", "terra.com.br",
  "r7.com", "record.com.br", "sbt.com.br", "band.com.br", "cnn.com.br",
  "bbc.com", "reuters.com", "bloomberg.com",
  
  // Educação e Pesquisa
  "edu.br", "usp.br", "unicamp.br", "ufrj.br", "puc-rio.br", "fgv.br",
  "mit.edu", "harvard.edu", "stanford.edu", "coursera.org", "edx.org",
  
  // Serviços Populares
  "whatsapp.com", "telegram.org", "discord.com", "zoom.us", "skype.com",
  "dropbox.com", "onedrive.com", "icloud.com", "netflix.com", "spotify.com",
  "globoplay.globo.com", "primevideo.com", "disney.com.br"
].map(norm))

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

/** Verifica se um domínio é de alta confiança */
function isTrustedDomain(host: string): boolean {
  return isHostAuthorizedBySet(host, TRUSTED_DOMAINS)
}

/** Verifica se um domínio tem indicadores de legitimidade */
function hasLegitimacyIndicators(host: string, html?: string): boolean {
  const hostname = host.toLowerCase()
  const content = (html || "").toLowerCase()
  
  // TLDs educacionais e governamentais
  const educationalTLDs = ['.edu', '.edu.br', '.academy', '.university', '.school']
  const governmentTLDs = ['.gov', '.gov.br', '.org', '.org.br']
  const legitimateTLDs = [...educationalTLDs, ...governmentTLDs]
  
  const hasLegitimeTLD = legitimateTLDs.some(tld => hostname.endsWith(tld))
  
  // Palavras-chave de sites educacionais
  const educationalKeywords = [
    'curso', 'cursos', 'academy', 'school', 'university', 'education',
    'learning', 'aula', 'aulas', 'ensino', 'formação', 'certificado',
    'diploma', 'faculdade', 'universidade', 'colégio', 'instituto'
  ]
  
  const hasEducationalContent = educationalKeywords.some(keyword => 
    hostname.includes(keyword) || content.includes(keyword)
  )
  
  // Sites com aparência profissional
  const professionalIndicators = [
    'sobre', 'about', 'contact', 'contato', 'team', 'equipe',
    'privacy', 'privacidade', 'terms', 'termos', 'policy', 'política'
  ]
  
  const hasProfessionalStructure = professionalIndicators.some(indicator => 
    content.includes(indicator)
  )
  
  return hasLegitimeTLD || (hasEducationalContent && hasProfessionalStructure)
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

  // ⭐ PRIMEIRA PRIORIDADE: Detecção de sites de apostas (ANTES de tudo)
  const betPatterns = [
    /bet/i,           // qualquer ocorrência de "bet"
    /\bcasino\b/i,
    /\bslots?\b/i,
    /\bapost[ao]/i,
    /\bjogo[s]?\b/i,
    /\b(777|888|999)\b/i,
    /\bgame[s]?\b/i,
    /(tiger|fortune|lucky|royal|premium|mega|ultra|zafir)/i, // nomes comuns de cassinos
    /\d+[a-z]+\d+\.(vip|top|site|fun|win|xyz|cc|online)/i,   // padrões suspeitos como 5rr88.vip
    /[a-z]*\d{2,}[a-z]*\.(vip|top|site|fun|win|xyz|cc)/i,    // números com TLDs suspeitos
    /vip\.\d+\w*game/i,                                       // vip.4484game padrão
    /\d+game\.(com|net|org|vip|top)/i,                       // 4484game.com padrão
    /(vip|premium|gold|diamond)\.\w*game/i                    // subdomínios suspeitos + game
  ]
  
  // Verifica se é site de apostas (por domínio ou conteúdo)
  const isBettingSite = hosts.some(h => 
    betPatterns.some(pattern => pattern.test(h)) ||
    h.includes('bet') || 
    h.includes('casino') || 
    h.includes('jogo') ||
    h.includes('aposta')
  ) || betPatterns.some(pattern => pattern.test(txt))
  
  // Se for site de apostas, verifica se está na allowlist
  if (isBettingSite) {
    const allow = loadAuthorizedBetDomainsLocal()
    const anyAuthorized = hosts.some(h => isHostAuthorizedBySet(h, allow))
    if (!anyAuthorized) {
      return { 
        verdict: "golpe", 
        reason: "Site de apostas não autorizado no Brasil. Use apenas casas de apostas licenciadas." 
      }
    }
    // Se está autorizado, continua o fluxo normal
  }

  // ⭐ SEGUNDA PRIORIDADE: Detecção de IPTV pirata e streaming ilegal
  const iptvPiratePatterns = [
    /(iptv|streaming).*(pirat|ilegal|gratis|free)/i,
    /(top|best|mega|super)streaming/i,
    /streaming.*(oficial|premium|vip|gold)/i,
    /\b(iptv|streaming)\b.*\.(online|site|top|vip|fun)/i,
    /(tv|canal|channel).*(pirat|gratis|free|hack)/i,
    /(netflix|amazon|disney|hbo).*(gratis|free|crack)/i
  ]

  const isIPTVPirate = hosts.some(h => 
    iptvPiratePatterns.some(pattern => pattern.test(h))
  ) || iptvPiratePatterns.some(pattern => pattern.test(txt))

  if (isIPTVPirate) {
    return { 
      verdict: "golpe", 
      reason: "Site de streaming/IPTV pirata. Conteúdo protegido por direitos autorais distribuído ilegalmente." 
    }
  }

  // Verificação de domínios de alta confiança - retorna seguro imediatamente
  const hasTrustedDomain = hosts.some(h => isTrustedDomain(h))
  if (hasTrustedDomain && !hasGambling && !hasLoan && !hasPorn) {
    return { verdict: "seguro", reason: "Link para site de alta confiança e reconhecimento mundial." }
  }

  // Verificação avançada de conteúdo adulto e golpes financeiros via HTML
  for (const token of urlsOrDomains) {
    if (token.startsWith('http')) {
      try {
        const resp = await fetch(token, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; EscudoProBot/1.0)" },
          redirect: "follow"
        })
        if (resp.ok) {
          const ctype = resp.headers.get("content-type") || ""
          const isHtml = ctype.includes("text/html")
          if (isHtml) {
            const htmlContent = await resp.text()
            
            // Verifica conteúdo adulto
            if (detectAdultContentPatterns(htmlContent, token)) {
              return { verdict: "golpe", reason: "Link leva para conteúdo adulto ou plataforma de conteúdo +18." }
            }
            
            // Verifica golpes financeiros/phishing
            const scamCheck = detectFinancialScamPatterns(htmlContent, token)
            if (scamCheck.isScam) {
              return { verdict: "golpe", reason: scamCheck.reason }
            }
          }
        }
      } catch (e) {
        console.error("[fastHeuristic] Error checking content:", e)
      }
    }
  }

  // TERCEIRA PRIORIDADE: Detecção de golpes de ativação de conta
  const activationScamPatterns = [
    /ativ[ao]r?.{0,20}conta/i,
    /confirma[rç].{0,20}conta/i,
    /verifica[rç].{0,20}conta/i,
    /validar.{0,20}conta/i,
    /reativar.{0,20}conta/i,
    /desbloqu\w+.{0,20}conta/i,
    /sua.conta.foi.{0,20}(suspensa|bloqueada|desativada)/i,
    /conta.{0,20}(suspensa|bloqueada|desativada|pendente)/i,
    /click.{0,10}aqui.{0,10}(ativar|confirmar|verificar)/i,
    /urgente.{0,20}ativ/i
  ]

  const hasActivationScam = activationScamPatterns.some(pattern => pattern.test(txt))
  
  if (hasActivationScam) {
    // Verifica se não é de domínio confiável
    const isTrustedDomain = hosts.some(h => TRUSTED_DOMAINS.has(h))
    if (!isTrustedDomain) {
      return { 
        verdict: "golpe", 
        reason: "Golpe de ativação/verificação de conta. Sites legítimos não pedem ativação por links suspeitos." 
      }
    }
  }

  // Detecção de golpes de pagamento PIX/financeiros
  for (const token of urlsOrDomains) {
    if (token.startsWith('http')) {
      const url = new URL(token)
      
      // Padrões suspeitos em URLs de pagamento
      const paymentScamPatterns = [
        /\/pix\/[A-Za-z0-9]+\?/i,
        /pay\.[a-z]+\.(site|online|top|xyz)/i,
        /pag\.[a-z]+\.(site|online|top|xyz)/i,
        /(agiliza|rapido|instant|quick)pag/i,
        /[?&](name|document|email|telephone)=/i
      ]
      
      const isPaymentScam = paymentScamPatterns.some(pattern => 
        pattern.test(token) || pattern.test(url.hostname)
      )
      
      if (isPaymentScam && !isTrustedDomain(url.hostname)) {
        return { 
          verdict: "golpe", 
          reason: "Link suspeito de pagamento PIX se passando por empresa legítima." 
        }
      }
    }
  }

  const badTLDs = [".site", ".online", ".shop", ".xyz", ".cc", ".top"]
  const hasBadDomain = hosts.some(h =>
    badTLDs.some(tld => h.endsWith(tld)) || gamblingHints.test(h) || loanHints.test(h) || pornHints.test(h)
  )

  // Pornografia: bloqueio direto (padrões básicos)
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
   Verificação de reputação do site via Gemini
   ========================= */

async function checkSiteLegitimacy(domain: string): Promise<{ isLegitimate: boolean; description: string }> {
  try {
    console.log(`[legitimacy] Starting check for: ${domain}`)
    console.log(`[legitimacy] API Key available: ${process.env.GEMINI_API_KEY ? 'YES' : 'NO'}`)
    
    const prompt = `Analise o site ${domain} e determine se é legítimo. 

Retorne APENAS um JSON no formato exato:

{"isLegitimate": true, "description": "Descrição da empresa/plataforma"}

OU

{"isLegitimate": false, "description": "Site desconhecido sem informações sobre legitimidade"}

Exemplos de sites legítimos:
- Google, Microsoft, Apple, Amazon → empresas de tecnologia mundialmente reconhecidas
- Bancos brasileiros (Itaú, Bradesco, Nubank) → instituições financeiras estabelecidas  
- GitHub, Stack Overflow, Wikipedia → plataformas conhecidas na comunidade tech
- Sites .gov.br → órgãos governamentais
- ew.academy → plataforma educacional brasileira de cursos de tecnologia
- Universidades e instituições de ensino conhecidas
- Grandes empresas brasileiras (Globo, UOL, Terra)
- E-commerce estabelecidos (Mercado Livre, Magazine Luiza)

Critérios para isLegitimate: true:
- Empresa ou plataforma mundialmente conhecida
- Instituição brasileira estabelecida e reconhecida
- Site governamental ou educacional oficial
- Marca conhecida no mercado brasileiro ou internacional
- Plataforma de tecnologia respeitada

Critérios para isLegitimate: false:
- Site completamente desconhecido
- Nunca ouviu falar da empresa/plataforma
- Domínio suspeito ou sem reputação conhecida

IMPORTANTE: Responda APENAS o JSON, sem texto adicional.`

    console.log(`[legitimacy] Prompt for ${domain}:`, prompt.substring(0, 200) + "...")

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, topP: 0.8, candidateCount: 1 }
        })
      }
    )

    console.log(`[legitimacy] API Response status for ${domain}: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[legitimacy] API request failed for ${domain}: ${response.status}`)
      console.error(`[legitimacy] Error details:`, errorText)
      return { isLegitimate: false, description: "Erro na verificação de legitimidade" }
    }

    const data = await response.json()
    const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
    
    console.log(`[legitimacy] Raw response for ${domain}:`, aiResponse)
    console.log(`[legitimacy] Full API response data for ${domain}:`, JSON.stringify(data, null, 2))

    try {
      // Remove markdown code blocks se houver
      let cleanResponse = aiResponse.trim()
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '')
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '')
      }
      
      console.log(`[legitimacy] Cleaned response for ${domain}:`, cleanResponse)
      
      // Tenta fazer parse do JSON
      const jsonResponse = JSON.parse(cleanResponse)
      
      if (typeof jsonResponse.isLegitimate === 'boolean' && typeof jsonResponse.description === 'string') {
        console.log(`[legitimacy] Parsed JSON for ${domain}:`, jsonResponse)
        return {
          isLegitimate: jsonResponse.isLegitimate,
          description: jsonResponse.description
        }
      } else {
        console.error(`[legitimacy] Invalid JSON structure for ${domain}:`, jsonResponse)
        return { isLegitimate: false, description: "Erro no formato da resposta" }
      }
    } catch (parseError) {
      console.error(`[legitimacy] JSON parse error for ${domain}:`, parseError, 'Raw response:', aiResponse)
      
      // Fallback mais inteligente: analisa se mencionou como legítimo/conhecido
      const lowerResponse = aiResponse.toLowerCase()
      if (lowerResponse.includes('"islegitimate": true') ||
          lowerResponse.includes('"islegitimate":true') ||
          lowerResponse.includes('plataforma educacional') ||
          lowerResponse.includes('cursos de tecnologia') ||
          lowerResponse.includes('empresa de tecnologia') ||
          lowerResponse.includes('mundialmente reconhecida') ||
          lowerResponse.includes('instituição estabelecida') ||
          (lowerResponse.includes('legítim') && !lowerResponse.includes('false')) ||
          (lowerResponse.includes('conhecid') && !lowerResponse.includes('desconhecido'))) {
        console.log(`[legitimacy] Using positive fallback interpretation for ${domain}`)
        return { 
          isLegitimate: true, 
          description: "Site reconhecido como legítimo" 
        }
      }
      
      return { isLegitimate: false, description: "Site não foi reconhecido como conhecido" }
    }
  } catch (error) {
    console.error(`[legitimacy] Error checking ${domain}:`, error)
    return { isLegitimate: false, description: "Erro na verificação de legitimidade" }
  }
}

/* =========================
   Prompt (passando resumo da allowlist)
   ========================= */

function buildPrompt(params: {
  message: string
  analyzedTargets: Array<{ url: string; htmlSummary: string; hints: Omit<Hints,"ageDays">; legitimacy?: { isLegitimate: boolean; description: string } }>
}) {
  const { message, analyzedTargets } = params

  const targetsBlock = analyzedTargets.length
    ? analyzedTargets.map((t, i) => {
        const h = t.hints
        const legitimacyInfo = t.legitimacy 
          ? `LEGITIMIDADE: ${t.legitimacy.isLegitimate ? 'LEGÍTIMO' : 'DESCONHECIDO'} - ${t.legitimacy.description}`
          : "LEGITIMIDADE: não verificada"
        
        console.log(`[v0] Building prompt for ${t.url} - Legitimacy:`, t.legitimacy)
        
        return `--- ALVO ${i + 1} ---
URL: ${t.url}
TLD: ${h.tld || "—"} | HTTPS: ${h.isHttps ? "sim" : "não"}
${legitimacyInfo}

HTML_RESUMO:
${t.htmlSummary || "indisponível"}`
      }).join("\n\n")
    : "Nenhuma URL foi identificada na mensagem."

  // Passa uma amostra da allowlist para contexto do LLM (evita prompt gigante)
  const allow = Array.from(loadAuthorizedBetDomainsLocal())
  const allowExamples = allow.slice(0, 40).join(", ")
  const allowNote = `ALLOWLIST_APOSTAS: total=${allow.length}; exemplos: ${allowExamples}`

  // Passa exemplos de domínios de alta confiança
  const trusted = Array.from(TRUSTED_DOMAINS)
  const trustedExamples = trusted.slice(0, 30).join(", ")
  const trustedNote = `SITES_ALTA_CONFIANÇA: total=${trusted.length}; exemplos: ${trustedExamples}`

  return `Você é um analisador antifraude no Brasil. Analise as informações fornecidas para classificar o link.

FOQUE APENAS NOS CRITÉRIOS ESSENCIAIS:

**SEGURO** quando:
- Site verificado como LEGÍTIMO na verificação de reputação
- Site de ALTA CONFIANÇA (Google, Microsoft, Apple, Amazon, bancos grandes, gov.br)
- Empresa conhecida com boa reputação

**GOLPE DETECTADO** quando:
- APOSTAS: Qualquer site com "bet", "casino", "apostas", "jogos" que NÃO esteja na allowlist
- CONTEÚDO ADULTO: OnlyFans, pornografia, webcam, sites +18
- ATIVAÇÃO DE CONTA: "Ativar conta", "confirmar conta", "conta suspensa" em sites não confiáveis
- GOLPES DE PAGAMENTO PIX: Links suspeitos se passando por empresas (agilizapag.site, etc)
- Sites claramente fraudulentos ou maliciosos
- Imitação de empresas conhecidas em domínios falsos

**CAUTELA** quando:
- Site DESCONHECIDO na verificação de legitimidade
- Site muito novo (menos de 30 dias)
- Falta de informações sobre legitimidade

⚠️ REGRA PRINCIPAL:
- Se LEGITIMIDADE = "LEGÍTIMO" → SEMPRE classificar como "Seguro"
- Se LEGITIMIDADE = "DESCONHECIDO" → classificar como "Cautela"  
- APOSTAS: Se é site de apostas E não está na allowlist → "Golpe detectado"
- Conteúdo adulto → "Golpe detectado"

Responda APENAS no formato:
[Classificação]: [Motivo curto em português brasileiro]

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

  // Função para salvar no Supabase com proteção contra duplicatas
  const saveToSupabase = async (result: AnalysisResult) => {
    try {
      const supabase = await createClient()
      
      // Verifica se já existe um registro recente com os mesmos dados (últimos 40 segundos)
      const fortySecondsAgo = new Date(Date.now() - 40 * 1000).toISOString()
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("email", email)
        .eq("message", sanitizedMessage)
        .eq("page_url", pageUrl)
        .gte("created_at", fortySecondsAgo)
        .limit(1)

      if (existing && existing.length > 0) {
        console.log("[v0] Duplicate entry prevented - recent submission found (40s window)")
        return
      }

      // Insere novo registro
      const { error: insertError } = await supabase.from("leads").insert({
        email,
        phone,
        page_url: pageUrl,
        message: sanitizedMessage,
        analysis_result: result
      })
      
      if (insertError) {
        console.error("[v0] Error saving to Supabase:", insertError)
      } else {
        console.log("[v0] Lead saved successfully to Supabase:", {
          email,
          phone,
          pageUrl,
          verdict: result.verdict,
          timestamp: new Date().toISOString()
        })
      }
    } catch (e) {
      console.error("[v0] Supabase error:", e)
    }
  }

  // URLs + domínios nus
  const urlsFromMessage = extractUrlsFromText(sanitizedMessage, 2)
  const bareDomains = extractBareDomains(sanitizedMessage, 3)
  const tokensForHeuristic = [...urlsFromMessage, ...bareDomains]

  console.log(`[v0] Extracted URLs from message:`, urlsFromMessage)
  console.log(`[v0] Extracted bare domains:`, bareDomains)
  console.log(`[v0] All tokens for analysis:`, tokensForHeuristic)

  // Heurística imediata
  const heuristicVerdict = await fastHeuristicCheckAsync(sanitizedMessage, tokensForHeuristic)
  if (heuristicVerdict) {
    await saveToSupabase(heuristicVerdict)
    return heuristicVerdict
  }

  // Baixa HTML só das URLs
  console.log(`[v0] Starting analysis of ${urlsFromMessage.length} URLs`)
  const analyzedTargets: Array<{ url: string; htmlSummary: string; hints: Omit<Hints,"ageDays">; legitimacy?: { isLegitimate: boolean; description: string } }> = []
  for (const targetUrl of urlsFromMessage) {
    console.log(`[v0] Processing URL: ${targetUrl}`)
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
        
        // Verificação de legitimidade dinâmica
        const domain = getHostname(targetUrl) || ""
        console.log(`[v0] Checking legitimacy for domain: ${domain}`)
        const legitimacy = domain ? await checkSiteLegitimacy(domain) : undefined
        console.log(`[v0] Legitimacy result for ${domain}:`, legitimacy)
        
        analyzedTargets.push({ url: targetUrl, htmlSummary, hints, legitimacy })
      } else {
        const hints = buildReputationHints(targetUrl, "")
        const domain = getHostname(targetUrl) || ""
        console.log(`[v0] Checking legitimacy for domain (no HTML): ${domain}`)
        const legitimacy = domain ? await checkSiteLegitimacy(domain) : undefined
        console.log(`[v0] Legitimacy result for ${domain}:`, legitimacy)
        analyzedTargets.push({ url: targetUrl, htmlSummary: "", hints, legitimacy })
      }
    } catch (e) {
      console.error("[v0] fetch target HTML error:", targetUrl, e)
      const hints = buildReputationHints(targetUrl, "")
      const domain = getHostname(targetUrl) || ""
      console.log(`[v0] Checking legitimacy for domain (error case): ${domain}`)
      const legitimacy = domain ? await checkSiteLegitimacy(domain) : undefined
      console.log(`[v0] Legitimacy result for ${domain}:`, legitimacy)
      analyzedTargets.push({ url: targetUrl, htmlSummary: "", hints, legitimacy })
    }
  }

  // Adiciona domínios nus para verificação de legitimidade
  console.log(`[v0] Adding ${bareDomains.length} bare domains for analysis`)
  for (const bareDomain of bareDomains) {
    // Só adiciona se não foi processado como URL
    const alreadyProcessed = analyzedTargets.some(t => getHostname(t.url) === bareDomain)
    if (!alreadyProcessed) {
      console.log(`[v0] Processing bare domain: ${bareDomain}`)
      const hints = buildReputationHints(`https://${bareDomain}`, "")
      console.log(`[v0] Checking legitimacy for bare domain: ${bareDomain}`)
      const legitimacy = await checkSiteLegitimacy(bareDomain)
      console.log(`[v0] Legitimacy result for bare domain ${bareDomain}:`, legitimacy)
      analyzedTargets.push({ 
        url: `https://${bareDomain}`, 
        htmlSummary: "", 
        hints, 
        legitimacy 
      })
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
      analysisResult = {
        verdict: "cautela",
        reason: "Erro na configuração do sistema de análise. Entre em contato com o suporte."
      }
    } else {
      const prompt = buildPrompt({ message: sanitizedMessage, analyzedTargets })
      
      console.log("[v0] Sending prompt to Gemini:", prompt.substring(0, 500) + "...")
      
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
        analysisResult = {
          verdict: "cautela",
          reason: "Erro temporário na análise. Tente novamente em alguns minutos."
        }
      } else {
        const data = await response.json()
        const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""

        console.log("[v0] Gemini full response data:", JSON.stringify(data, null, 2))
        console.log("[v0] Gemini extracted response:", aiResponse)

        if (!aiResponse) {
          console.error("[v0] Empty response from Gemini")
          analysisResult = {
            verdict: "cautela",
            reason: "Resposta vazia da IA. Tente novamente."
          }
        } else {
          // Parse "[Classificação]: [Motivo]"
          const [classification, ...reasonParts] = aiResponse.split(":")
          const llmReasonRaw = reasonParts.join(":").trim()

          console.log("[v0] Parsed classification:", classification)
          console.log("[v0] Parsed reason:", llmReasonRaw)

          // Normaliza motivo do LLM para linguagem popular (apenas o essencial)
          const llmReason = llmReasonRaw
            .replace(/dom[ií]nio recente/gi, "site muito novo")
            .replace(/conte[úu]do adulto/gi, "conteúdo adulto")
            .replace(/\s+/g, " ")
            .trim()

          let verdict: "seguro" | "cautela" | "golpe" = "cautela"
          const cls = (classification || "").toLowerCase()
          if (cls.includes("seguro")) verdict = "seguro"
          else if (cls.includes("golpe")) verdict = "golpe"
          else verdict = "cautela"

          console.log("[v0] Final verdict:", verdict)

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
    }

    // Salva resultado final no Supabase
    await saveToSupabase(analysisResult)

    return analysisResult
  } catch (error) {
    console.error("[v0] Error analyzing message:", error)
    return {
      verdict: "cautela",
      reason: "Erro inesperado na análise. Tente novamente."
    }
  }
}
