import { MessageSquare, Brain, Shield } from "lucide-react"

export function HowItWorks() {
  const steps = [
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Cole o texto",
      description: "Insira a mensagem suspeita que você recebeu",
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: "IA analisa",
      description: "Nossa inteligência artificial examina o conteúdo",
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Receba o veredito",
      description: "Saiba se é seguro, precisa cautela ou é golpe",
    },
  ]

  return (
    <section className="px-4 py-16 md:px-6 md:py-24">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">Como funciona</h2>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 bg-[#FFA500] rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="text-black">{step.icon}</div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
              <p className="text-[#B3B3B3] leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
