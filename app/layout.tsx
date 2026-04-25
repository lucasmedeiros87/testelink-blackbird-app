import type React from "react"
import type { Metadata } from "next"
import localFont from "next/font/local"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const neueHaas = localFont({
  src: [
    {
      path: "../public/static/fonts/Neue-Haas-Grotesk/NHaasGroteskDSPro-55Rg.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/static/fonts/Neue-Haas-Grotesk/NHaasGroteskDSPro-56It.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/static/fonts/Neue-Haas-Grotesk/NHaasGroteskDSPro-65Md.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/static/fonts/Neue-Haas-Grotesk/NHaasGroteskDSPro-66MdIt.woff2",
      weight: "500",
      style: "italic",
    },
    {
      path: "../public/static/fonts/Neue-Haas-Grotesk/NHaasGroteskDSPro-75Bd.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/static/fonts/Neue-Haas-Grotesk/NHaasGroteskDSPro-76BdIt.woff2",
      weight: "700",
      style: "italic",
    },
    {
      path: "../public/static/fonts/Neue-Haas-Grotesk/NHaasGroteskDSPro-95Blk.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-neue-haas",
  display: "swap",
})

export const metadata: Metadata = {
  title: "BlackBird® — Proteção de Inteligência",
  description:
    "Detecte fraudes e golpes em mensagens suspeitas com inteligência artificial. Proteção instantânea contra phishing e scams.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`dark ${neueHaas.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WTHNR22M');`,
          }}
        />
      </head>
      <body className="antialiased">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WTHNR22M"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
