"use client"

import type React from "react"

import { useState } from "react"
import { Header } from "@/components/header"
import { HowItWorks } from "@/components/how-it-works"
import { SocialProof } from "@/components/social-proof"
import { Footer } from "@/components/footer"

export default function TestLinkPage() {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget

    // Coleta dos campos (ajuste os seletores se seus names forem diferentes)
    const email =
      (form.querySelector('input[type="email"], input[name="email"]') as HTMLInputElement)?.value?.trim() || ""
    const phoneRaw =
      (form.querySelector('input[type="tel"], input[name="phone"], input[name="telefone"]') as HTMLInputElement)
        ?.value || ""
    const phone = (phoneRaw || "").replace(/\D+/g, "")

    setLoading(true)
    try {
      // Envio do formulário para a sua ação/API (usa o action atual se existir)
      const action = form.getAttribute("action") || "/api/lead"
      const res = await fetch(action, {
        method: form.getAttribute("method")?.toUpperCase() || "POST",
        body: new FormData(form),
      })

      if (res.ok) {
        // SUCESSO REAL: dispara o lead_submit_success no dataLayer
        const eventId = (window as any).uuidv4 ? (window as any).uuidv4() : String(Date.now())
        const fbp = (window as any).getCookie ? (window as any).getCookie("_fbp") : ""
        const fbc = (window as any).buildFBC ? (window as any).buildFBC() : ""
        ;(window as any).dataLayer = (window as any).dataLayer || []
        ;(window as any).dataLayer.push({
          event: "lead_submit_success",
          event_id: eventId,
          user_email: email,
          user_phone: phone,
          _fbp: fbp || "",
          _fbc: fbc || "",
          event_source_url: window.location.href,
        })

        // feedback ao usuário (opcional) e reset
        try {
          form.reset()
        } catch {}
        // Exiba seu toast/modal se desejar
      } else {
        // Falha de backend — não dispara o evento
        console.error("Falha no envio do formulário:", res.status)
      }
    } catch (err) {
      console.error("Erro de rede no envio do formulário:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black">
      <Header />

      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Escaneie Fraudes com IA
          </h1>
          <p className="text-xl text-gray-300 mb-12">
            Detecte fraudes e golpes em mensagens suspeitas usando inteligência artificial
          </p>

          <form id="leadForm" onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
            <input
              type="email"
              name="email"
              required
              placeholder="Seu e-mail"
              className="w-full border border-gray-600 rounded-lg px-4 py-3 bg-gray-900 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="tel"
              name="telefone"
              required
              placeholder="Seu telefone"
              className="w-full border border-gray-600 rounded-lg px-4 py-3 bg-gray-900 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-3 transition-all duration-200"
            >
              {loading ? "Enviando..." : "Participar agora"}
            </button>
          </form>
        </div>
      </section>

      <HowItWorks />
      <SocialProof />
      <Footer />
    </main>
  )
}
