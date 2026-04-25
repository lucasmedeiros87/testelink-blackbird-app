# testelink-blackbird-app — Documento de Referência

## O que é este projeto

Detector de fraudes anti-phishing e anti-golpe com IA para o mercado brasileiro. O usuário cola uma mensagem ou link suspeito, fornece email e telefone, e recebe um veredito (**seguro / cautela / golpe**) gerado por heurísticas + Google Gemini 1.5 Flash.

**Nome da plataforma**: Escudo Pro / Alby Protect  
**Data de lançamento prevista**: 15 de setembro de 2025  
**Público-alvo**: Usuários brasileiros

---

## Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 15.2.4 |
| UI | React | 19 |
| Linguagem | TypeScript | 5.x |
| Styling | Tailwind CSS v4 | 4.1.9 |
| Componentes | shadcn/ui (estilo new-york) | — |
| Primitivos | Radix UI | latest |
| Ícones | Lucide React | 0.454.0 |
| Fonte | Montserrat (Google Fonts) | — |
| Backend/DB | Supabase (PostgreSQL) | latest |
| IA | Google Gemini 1.5 Flash | via REST |
| Package manager | pnpm | — |
| Validação | Zod + react-hook-form | 3.25.67 / latest |
| Tema | next-themes (dark forçado) | latest |
| Analytics | Google Tag Manager | GTM-WTHNR22M |

---

## Estrutura de Arquivos

```
app/
  globals.css          # CSS variables (OKLCh) + estilos base
  layout.tsx           # Root layout: dark forçado, Montserrat, GTM
  page.tsx             # Redireciona / → /test-link
  test-link/
    page.tsx           # Página principal (única rota real)

components/
  header.tsx           # Logo + link privacidade
  hero.tsx             # COMPONENTE PRINCIPAL: formulário + resultado (306 linhas)
  how-it-works.tsx     # Seção 3 passos
  social-proof.tsx     # Badges de confiança + contagem
  footer.tsx           # Rodapé com links legais
  theme-provider.tsx   # Wrapper next-themes (dark forçado, pouco usado)
  ui/
    badge.tsx          # Badge com CVA variants
    button.tsx         # Button com CVA variants
    card.tsx           # Card + subcomponentes
    checkbox.tsx       # Checkbox Radix
    input.tsx          # Campo de texto
    textarea.tsx       # Campo multi-linha

lib/
  actions.ts           # Server Action principal (616 linhas) — toda a lógica de análise
  utils.ts             # cn() para merge de classes
  supabase/
    client.ts          # Cliente Supabase browser
    server.ts          # Cliente Supabase SSR

scripts/
  001_create_leads_table.sql   # DDL da tabela leads no Supabase

public/
  placeholder-logo.png/.svg   # Assets de placeholder (não usados em produção)
  placeholder-user.jpg/.svg
  placeholder.jpg/.svg
```

---

## Identidade Visual — BlackBird Brand (implementada)

### Paleta Primária (Hex — em `app/globals.css`)

| Variável CSS | Hex | Nome BlackBird | Uso |
|---|---|---|---|
| `--background` | `#121315` | Black | Fundo principal |
| `--foreground` | `#ffffff` | White | Texto principal |
| `--card` | `#152132` | Dark Gunmetal | Cards, surfaces |
| `--primary` | `#cbd8e4` | Alice Blue | CTA buttons, accent |
| `--primary-foreground` | `#121315` | Black | Texto sobre primary |
| `--secondary` | `#1e2d42` | Navy | Hover, secondary surfaces |
| `--muted-foreground` | `#7a8fa6` | Slate muted | Textos secundários |
| `--accent` | `#b9c7d6` | Light Slate | Elementos de apoio |
| `--border` | `#1e2d42` | Navy | Bordas |
| `--input` | `#152132` | Dark Gunmetal | Fundo de inputs |

### Tipografia
- **Fonte**: Neue Haas Grotesk Display Pro (local — `public/static/fonts/Neue-Haas-Grotesk/`)
- **Pesos carregados**: 400 (Rg), 500 (Md), 700 (Bd), 900 (Blk)
- **Modo**: Dark only (forçado via `<html className="dark">`)

### Background
- Classe `.bb-bg` — dark navy gradient + luz diagonal difusa (light sweep)
- Classe `.bb-sweep` — pseudo-element com shimmer diagonal no hero

### Border Radius
- `--radius`: `0.5rem` (8px) — mais sóbrio que antes (era 12px)

### Logo
- SVG inline em `components/header.tsx` (provisório — substituir pelo SVG oficial da Avejo Design)
- Wordmark: **BlackBird®** (B e B maiúsculos, símbolo ®)

---

## Fluxo Principal (`lib/actions.ts`)

```
Usuário submete formulário
  ↓
analyzeMessage(formData)
  ├── Extrai email, phone, message, pageUrl
  ├── Sanitiza HTML da mensagem
  ├── fastHeuristicCheckAsync()
  │     ├── Apostas? → verifica allowlist 150+ domínios .bet.br
  │     ├── Empréstimo? → keywords + domínio suspeito
  │     └── Pornografia? → keywords explícitas
  │     (se detectado → retorna veredito imediato)
  ├── Extrai URLs da mensagem (máx. 2)
  ├── Para cada URL:
  │     ├── Fetch HTML + summarizeHtml()
  │     ├── buildReputationHints() — HTTPS, CNPJ, privacidade, PIX, etc.
  │     └── fetchDomainAgeDaysGlobal() — consulta IANA RDAP
  ├── buildPrompt() — monta contexto para Gemini
  ├── Gemini 1.5 Flash → resposta JSON {verdict, title, message, ...}
  ├── Parse + normaliza resposta
  ├── Salva em Supabase (tabela leads)
  └── Dispara GTM dataLayer event (lead_submit_success)
```

### Vereditos possíveis
- `"seguro"` — site legítimo
- `"cautela"` — suspeito, verificar
- `"golpe"` — fraude identificada

---

## Banco de Dados (Supabase)

### Tabela `public.leads`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | auto-gerado |
| `email` | text | email do usuário |
| `phone` | text | telefone do usuário |
| `page_url` | text | URL da página onde foi submetido |
| `message` | text | mensagem/link analisado |
| `analysis_result` | JSONB | resultado completo da análise |
| `created_at` | timestamptz | timestamp de criação |

**RLS**: INSERT público (WITH CHECK (true)) + SELECT público (USING (true))

---

## Variáveis de Ambiente Necessárias

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
BET_AUTH_DOMAINS=          # opcional — domínios .bet.br autorizados extras
```

---

## Problemas Conhecidos e Pendências

### Críticos (resolver antes do lançamento)
- [ ] `next.config.mjs` com `ignoreBuildErrors: true` e `ignoreDuringBuilds: true` — desativa segurança de build
- [ ] POST para `/api/lead` em `hero.tsx` — rota não existe (404 silencioso)
- [ ] Erro no Gemini é silenciado — fallback `getMockAnalysis()` pode retornar veredito errado
- [ ] Sem rate limiting na Server Action (risco de abuse da API Gemini)

### Moderados
- [ ] Dependências com versão `"latest"` (25+ libs) — risco de breaking changes
- [ ] Cores hardcoded (`#FFA500`, `#CC7A00`, `#1A1A1A`) em vez de CSS vars
- [ ] RLS policies abertas demais no Supabase (qualquer um lê os leads)
- [ ] Formulário usa `FormData` nativa em vez de `react-hook-form + Zod`
- [ ] `name` no package.json ainda é `"my-v0-project"`
- [ ] `ageDays` do RDAP calculado mas não exibido/usado
- [ ] Logs com prefixo `[v0]` (herança do gerador v0.app)

### Menores
- [ ] `styles/` diretório vazio
- [ ] Assets `placeholder-*` em `public/` não usados em produção
- [ ] `ThemeProvider` importado em layout mas dark é forçado no HTML
- [ ] Alias `"hooks"` em `components.json` aponta para diretório inexistente

---

## Comandos Úteis

```bash
pnpm dev          # inicia dev server
pnpm build        # build de produção
pnpm lint         # ESLint
pnpm start        # servidor de produção
```

---

## Notas de Arquitetura

- **Rendering**: Page `/test-link` é `dynamic` (Server Component + Server Action)
- **Formulário**: Estado gerenciado com `useState` em `hero.tsx` (sem RHF ainda)
- **Análise de IA**: Exclusivamente server-side via Server Action — chave Gemini nunca exposta ao client
- **Supabase**: Usado apenas para persistência de leads (sem auth de usuário)
- **Dark mode**: Forçado em layout — `ThemeProvider` está instalado mas inativo
- **Tailwind v4**: Usa novo sistema `@tailwindcss/postcss` (sem `tailwind.config.js`)
