import type React from "react"
import type { Metadata } from "next"
import { Montserrat } from "next/font/google"
import "./globals.css"

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
})

export const metadata: Metadata = {
  title: "Alby Protect - Escaneie Fraudes com IA",
  description:
    "Detecte fraudes e golpes em mensagens suspeitas usando inteligência artificial. Proteção instantânea contra phishing e scams.",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <script
          id="dl-utils"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];

              // UUID v4 simples para event_id
              window.uuidv4 = function(){
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
                  const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
                  return v.toString(16);
                });
              };

              // Lê cookie 1st-party
              window.getCookie = function(name){
                const m = document.cookie.match(new RegExp('(^|;)\\\\s*'+name+'\\\\s*=\\\\s*([^;]+)'));
                return m ? m.pop() : '';
              };

              // _fbc a partir de fbclid (se existir) ou cookie
              window.buildFBC = function(){
                const fbclid = new URLSearchParams(location.search).get('fbclid');
                if (fbclid) return \`fb.1.\${Date.now()}.\${fbclid}\`;
                return window.getCookie('_fbc') || '';
              };
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WTHNR22M');`,
          }}
        />
        <style>{`
html {
  font-family: ${montserrat.style.fontFamily};
  --font-sans: ${montserrat.variable};
}
        `}</style>
      </head>
      <body className="bg-black text-white font-sans antialiased">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WTHNR22M"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {children}
      </body>
    </html>
  )
}
