import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { HowItWorks } from "@/components/how-it-works"
import { SocialProof } from "@/components/social-proof"
import { Footer } from "@/components/footer"

export default function TestLink() {
  return (
    <main className="min-h-screen bg-black">
      <Header />
      <Hero />
      <HowItWorks />
      <SocialProof />
      <Footer />
    </main>
  )
}
