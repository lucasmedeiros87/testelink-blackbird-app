import { MessageSquare, Brain, Shield } from "lucide-react"

export function HowItWorks() {
  const steps = [
    {
      icon: <MessageSquare className="w-6 h-6" />,
      step: "01",
      title: "Cole o texto",
      description: "Insira a mensagem suspeita ou link que você recebeu.",
    },
    {
      icon: <Brain className="w-6 h-6" />,
      step: "02",
      title: "IA analisa",
      description: "Nossa inteligência artificial examina padrões, domínios e conteúdo.",
    },
    {
      icon: <Shield className="w-6 h-6" />,
      step: "03",
      title: "Veredito imediato",
      description: "Receba a classificação: seguro, atenção ou golpe — em segundos.",
    },
  ]

  return (
    <section className="px-6 pt-10 pb-20 md:px-10 md:pt-14 md:pb-28">
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <p className="text-[#cbd8e4] text-xs uppercase tracking-widest font-medium mb-3">Metodologia</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Como funciona</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-[#1e2d42] rounded-xl overflow-hidden">
          {steps.map((step, index) => (
            <div key={index} className="bg-[#121315] p-8 md:p-10">
              <p className="text-[#1e2d42] text-5xl font-bold mb-6 select-none">{step.step}</p>
              <div className="w-10 h-10 bg-[#152132] border border-[#1e2d42] rounded-lg flex items-center justify-center mb-5">
                <span className="text-[#cbd8e4]">{step.icon}</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 tracking-tight">{step.title}</h3>
              <p className="text-[#7a8fa6] text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
