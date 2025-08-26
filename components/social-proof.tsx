import { Shield, Lock, Award } from "lucide-react"

export function SocialProof() {
  return (
    <section className="px-4 py-16 md:px-6 md:py-24 bg-[#0D0D0D]">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">+5.000 mensagens já analisadas com IA</h2>

        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          <div className="flex items-center gap-3 bg-[#1A1A1A] px-6 py-4 rounded-lg">
            <Shield className="w-8 h-8 text-[#FFA500]" />
            <span className="text-white font-semibold">LGPD</span>
          </div>
          <div className="flex items-center gap-3 bg-[#1A1A1A] px-6 py-4 rounded-lg">
            <Lock className="w-8 h-8 text-[#FFA500]" />
            <span className="text-white font-semibold">Anti-fraude</span>
          </div>
          <div className="flex items-center gap-3 bg-[#1A1A1A] px-6 py-4 rounded-lg">
            <Award className="w-8 h-8 text-[#FFA500]" />
            <span className="text-white font-semibold">Proteção de Dados</span>
          </div>
        </div>
      </div>
    </section>
  )
}
