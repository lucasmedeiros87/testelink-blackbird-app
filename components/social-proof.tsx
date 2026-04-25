import { Shield, Lock, Award } from "lucide-react"

export function SocialProof() {
  const badges = [
    { icon: <Shield className="w-5 h-5" />, label: "LGPD Compliant" },
    { icon: <Lock className="w-5 h-5" />, label: "Anti-fraude" },
    { icon: <Award className="w-5 h-5" />, label: "Proteção de Dados" },
  ]

  return (
    <section className="px-6 py-16 md:px-10 md:py-20 bg-[#0e1621] border-y border-[#1e2d42]">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <p className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              +5.000 mensagens analisadas
            </p>
            <p className="text-[#7a8fa6] text-sm mt-1">com inteligência artificial</p>
          </div>

          <div className="flex flex-wrap justify-center md:justify-end gap-3">
            {badges.map(({ icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 bg-[#152132] border border-[#1e2d42] px-5 py-3 rounded-lg"
              >
                <span className="text-[#cbd8e4]">{icon}</span>
                <span className="text-sm text-[#b9c7d6] font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
