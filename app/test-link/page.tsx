import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { HowItWorks } from "@/components/how-it-works"
import { SocialProof } from "@/components/social-proof"
import { Footer } from "@/components/footer"

export const dynamic = "force-dynamic"

export default function TestLink() {
  return (
    <main className="min-h-screen bb-bg">
      <Header />
      <Hero />
      <HowItWorks />
      <SocialProof />
      <Footer />
    </main>
  )
}
