import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { HowItWorks } from "@/components/how-it-works"
import { SocialProof } from "@/components/social-proof"
import { Footer } from "@/components/footer"
import { BgLayers } from "@/components/bg-layers"

export const dynamic = "force-dynamic"

export default function TestLink() {
  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: "#121315" }}
    >
      <BgLayers />
      <div className="relative z-10">
        <Header />
        <Hero />
        <HowItWorks />
        <SocialProof />
        <Footer />
      </div>
    </main>
  )
}
