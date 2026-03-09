import React, { useState, useEffect, useCallback } from "react";

const LandingPage = () => {
  // --- CONFIGURAÇÃO DAS IMAGENS (Carrossel) ---
  const carouselData = [
    {
      src: "https://hxfhubhijampubrsqfhg.supabase.co/storage/v1/object/public/landing-page/Dashboard.jpeg",
      title: "Dashboard Gerencial",
    },
    {
      src: "https://hxfhubhijampubrsqfhg.supabase.co/storage/v1/object/public/landing-page/Analise%20Operacional.jpeg",
      title: "Análise Operacional",
    },
    {
      src: "https://hxfhubhijampubrsqfhg.supabase.co/storage/v1/object/public/landing-page/Calculo%20de%20Frete.jpeg",
      title: "Cálculo de Frete",
    },
    {
      src: "https://hxfhubhijampubrsqfhg.supabase.co/storage/v1/object/public/landing-page/Copilot.jpeg",
      title: "Copilot Inteligente",
    },
    {
      src: "https://hxfhubhijampubrsqfhg.supabase.co/storage/v1/object/public/landing-page/Detalhe%20de%20Jornada.jpeg",
      title: "Jornada do Motorista",
    },
    {
      src: "https://hxfhubhijampubrsqfhg.supabase.co/storage/v1/object/public/landing-page/DRE%20GERENCIAL.jpeg",
      title: "DRE Financeiro",
    },
    {
      src: "https://hxfhubhijampubrsqfhg.supabase.co/storage/v1/object/public/landing-page/Frota%20Assistente.jpeg",
      title: "Assistente IA",
    },
  ];

  // --- Lógica do Carrossel 3D ---
  const [activeIndex, setActiveIndex] = useState(0);

  const nextSlide = useCallback(() => {
    setActiveIndex((current) => (current + 1) % carouselData.length);
  }, [carouselData.length]);

  const prevSlide = () => {
    setActiveIndex((current) => (current - 1 + carouselData.length) % carouselData.length);
  };

  // Autoplay
  useEffect(() => {
    const timer = setInterval(nextSlide, 4000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  // Função de Estilo do Carrossel (Coverflow 3D)
  const getCardStyle = (index: number) => {
    const total = carouselData.length;
    let relativePosition = (index - activeIndex + total) % total;
    if (relativePosition > total / 2) {
      relativePosition -= total;
    }

    const commonClasses =
      "absolute top-0 left-0 w-full h-full transition-all duration-700 ease-in-out cursor-pointer rounded-2xl";

    if (relativePosition === 0) {
      return {
        className: `${commonClasses} z-30 opacity-100 scale-100 translate-x-0`,
        style: { boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(79, 70, 229, 0.3)" },
      };
    }
    if (relativePosition === 1) {
      return {
        className: `${commonClasses} z-20 opacity-60 scale-75 translate-x-[40%] blur-[2px] hover:opacity-100 hover:blur-0`,
        style: { boxShadow: "0 10px 30px rgba(0,0,0,0.5)" },
      };
    }
    if (relativePosition === -1) {
      return {
        className: `${commonClasses} z-20 opacity-60 scale-75 -translate-x-[40%] blur-[2px] hover:opacity-100 hover:blur-0`,
        style: { boxShadow: "0 10px 30px rgba(0,0,0,0.5)" },
      };
    }
    return {
      className: `${commonClasses} z-10 opacity-0 scale-50`,
      style: {},
    };
  };

  // --- SEO ---
  useEffect(() => {
    document.title = "Sistema de Gestão de Frota | Frota Link";
    const updateMeta = (name: string, content: string) => {
      let element = document.querySelector(`meta[name="${name}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute("name", name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };
    updateMeta("description", "O melhor Sistema de Gestão de Frota do mercado. Controle total com IA.");
  }, []);

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const toggleFaq = (index: number) => setOpenFaq(openFaq === index ? null : index);
  const scrollToPlans = () => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" });

  const whatsappLink =
    "https://wa.me/5511985914063?text=Ol%C3%A1%2C%20gostaria%20de%20ver%20uma%20demonstra%C3%A7%C3%A3o%20do%20Frota%20Link.";

  // --- PLANOS CORRIGIDOS (4 PLANOS) ---
  const plans = [
    {
      name: "Controle",
      description: "Gestão essencial para organizar a casa.",
      features: [
        { name: "Gestão básica de frota", included: true },
        { name: "Relatórios essenciais", included: true },
        { name: "CT-e e MDF-e", included: true },
        { name: "Controle de despesas", included: true },
        { name: "Simulador de Frete", included: false },
        { name: "Assistente IA", included: false },
        { name: "Copilot Inteligente", included: false },
        { name: "App Motorista", included: false },
      ],
      highlight: false,
    },
    {
      name: "Pro",
      description: "Inteligência Artificial para sua operação.",
      features: [
        { name: "Tudo do plano Controle", included: true },
        { name: "Simulador de Frete", included: true },
        { name: "Assistente IA", included: true },
        { name: "Copilot Inteligente", included: true },
        { name: "Relatórios Avançados", included: true },
        { name: "App Motorista", included: false },
        { name: "Checklists Digitais", included: false },
        { name: "Suporte Dedicado", included: false },
      ],
      highlight: true, // Mais popular
    },
    {
      name: "Enterprise",
      description: "Gestão completa com motorista conectado.",
      features: [
        { name: "Tudo do plano Pro", included: true },
        { name: "PWA Motorista Completo", included: true },
        { name: "Checklists Digitais", included: true },
        { name: "Geolocalização", included: true },
        { name: "Chat motorista-central", included: true },
        { name: "Suporte Dedicado", included: false },
        { name: "Especialista Humano", included: false },
      ],
      highlight: false,
    },
    {
      name: "Concierge",
      description: "Terceirize a inteligência da sua frota.",
      features: [
        { name: "Tudo do plano Enterprise", included: true },
        { name: "Especialista humano dedicado", included: true },
        { name: "Lançamentos gerenciados", included: true },
        { name: "Suporte Prioritário 24/7", included: true },
        { name: "Onboarding Personalizado", included: true },
      ],
      highlight: false,
    },
  ];

  return (
    <div className="font-sans text-slate-600 bg-white min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      {/* HEADER */}
      <header className="fixed top-0 w-full z-50 bg-slate-900/95 backdrop-blur-md border-b border-white/5 shadow-sm">
        <div className="container mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3 text-white font-semibold text-xl">
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" />
                <path d="M9 17h6" />
                <circle cx="17" cy="17" r="2" />
              </svg>
            </div>
            <h1>
              Frota Link<span className="text-indigo-500">.</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://app.linkfrota.com.br/auth"
              className="hidden md:block text-slate-300 hover:text-white text-sm font-medium"
            >
              Área do Cliente
            </a>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-lg"
            >
              Falar com Consultor
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-slate-950">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-50"></div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left z-40">
              <div className="inline-flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 text-indigo-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-8 backdrop-blur-sm">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                Sistema de Gestão de Frota com IA
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-6">
                Sua Frota Analisada por{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                  Inteligência Artificial.
                </span>
              </h2>
              <p className="text-lg text-slate-400 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0 font-light">
                O <strong>Sistema de Gestão de Frota</strong> definitivo. DRE Gerencial, Jornada do Motorista e IA que
                analisa custos e sugere economias automaticamente.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg px-8 py-4 rounded-lg shadow-xl hover:-translate-y-1 flex items-center justify-center gap-2 transition-all"
                >
                  Agendar Demonstração
                </a>
                <button
                  onClick={scrollToPlans}
                  className="px-8 py-4 rounded-lg border border-slate-700 text-slate-300 hover:bg-white/5 font-semibold transition-all"
                >
                  Ver Funcionalidades
                </button>
              </div>
            </div>

            {/* CARROSSEL 3D */}
            <div className="relative h-[400px] lg:h-[550px] w-full flex items-center justify-center perspective-1000">
              <div className="relative w-full h-full max-w-3xl flex items-center justify-center">
                {carouselData.map((slide, index) => {
                  const { className, style } = getCardStyle(index);
                  return (
                    <div key={index} className={className} style={style} onClick={() => setActiveIndex(index)}>
                      <div className="relative w-full h-full overflow-hidden rounded-2xl bg-slate-900/50 backdrop-blur-sm border border-slate-700/50">
                        <img src={slide.src} alt={slide.title} className="w-full h-full object-contain" />
                        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                        <div
                          className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-slate-950/80 border border-white/10 backdrop-blur-md transition-opacity duration-300 ${activeIndex === index ? "opacity-100" : "opacity-0"}`}
                        >
                          <span className="text-white text-sm font-medium whitespace-nowrap">{slide.title}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="absolute -bottom-10 flex gap-4 z-50">
                <button
                  onClick={prevSlide}
                  className="p-3 rounded-full bg-slate-800/50 text-white hover:bg-indigo-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextSlide}
                  className="p-3 rounded-full bg-slate-800/50 text-white hover:bg-indigo-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* A DOR */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Gerenciar frota no "achismo" custa caro</h2>
            <p className="text-slate-600 text-lg">
              Sem dados precisos, você só descobre o prejuízo quando o caixa fecha no vermelho.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Desperdício Invisível",
                desc: "Sem IA, você não vê quais motoristas estão gastando mais combustível.",
                icon: "💸",
              },
              {
                title: "Veículos Parados",
                desc: "Manutenções corretivas urgentes que deixam o carro na oficina.",
                icon: "🛠️",
              },
              {
                title: "Papelada Caótica",
                desc: "Motoristas perdendo notinhas de abastecimento e dados manuais errados.",
                icon: "📄",
              },
              {
                title: "Sem Histórico",
                desc: "Falta de dados para saber a hora certa de trocar o veículo da frota.",
                icon: "📉",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* A SOLUÇÃO */}
      <section id="solutions" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-block text-indigo-600 font-bold uppercase tracking-wider text-xs mb-2">
                Tecnologia Exclusiva
              </div>
              <h2 className="text-4xl font-bold text-slate-900 mb-6 leading-tight">
                Inteligência Artificial que trabalha por você.
              </h2>
              <p className="text-slate-600 mb-8 text-lg font-light">
                O Frota Link não apenas armazena dados. Ele processa, aprende e te diz o que fazer.
              </p>
              <div className="space-y-6">
                {[
                  {
                    title: "Consultor Virtual com IA",
                    desc: "Analisa custos 24/7 e sugere melhorias.",
                    icon: <path d="M12 2a10 10 0 1 0 10 10H12V2z" />,
                  },
                  {
                    title: "App do Motorista",
                    desc: "Lançamento de custos direto no celular, mesmo offline.",
                    icon: <rect x="7" y="2" width="10" height="20" rx="2" ry="2" />,
                  },
                  {
                    title: "Gestão de Manutenção",
                    desc: "Alertas preditivos de pneus e óleo.",
                    icon: (
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    ),
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 group">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {item.icon}
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-slate-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 relative">
              <div className="absolute top-0 right-0 bg-indigo-500 w-32 h-32 rounded-bl-full opacity-10"></div>
              <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 max-w-sm mx-auto relative z-10">
                <div className="text-center font-bold text-xl text-slate-800 mb-2">ABC-1234</div>
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="flex gap-2">
                    <svg
                      className="text-emerald-500 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>{" "}
                    Em Operação
                  </div>
                  <div className="flex gap-2">
                    <svg
                      className="text-emerald-500 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>{" "}
                    Manutenção em dia
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLANOS (4 ITENS) */}
      <section id="plans" className="py-20 bg-slate-900">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Planos e Funcionalidades</h2>
            <p className="text-slate-400">Escolha o nível de controle ideal para o tamanho da sua frota.</p>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-2 ${plan.highlight ? "bg-slate-800 border-indigo-500 shadow-2xl shadow-indigo-500/20" : "bg-slate-900 border-slate-800"}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                    Recomendado
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="text-sm text-slate-400 mt-2 min-h-[40px]">{plan.description}</p>
                </div>
                <div className="flex-1 space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 text-sm ${feature.included ? "text-slate-300" : "text-slate-700 decoration-slate-700"}`}
                    >
                      {feature.included ? (
                        <span className="text-emerald-500 font-bold shrink-0">✓</span>
                      ) : (
                        <span className="text-slate-700 font-bold shrink-0">✕</span>
                      )}
                      <span className={feature.included ? "" : "line-through opacity-50"}>{feature.name}</span>
                    </div>
                  ))}
                </div>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full py-3 px-4 rounded-lg font-bold text-center transition-colors ${plan.highlight ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"}`}
                >
                  Cotar Plano
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ & FOOTER */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-6 max-w-3xl">
          <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">Dúvidas Frequentes</h2>
          <div className="space-y-4">
            {[
              {
                q: "A IA realmente ajuda a economizar?",
                a: "Sim. A Inteligência Artificial cruza dados de consumo com padrões da frota e identifica gastos anormais.",
              },
              {
                q: "O motorista precisa de internet?",
                a: "Não. O App funciona offline e sincroniza quando houver sinal.",
              },
              {
                q: "Funciona para caminhões?",
                a: "Sim! Gerenciamos caminhões, carretas, utilitários, carros e motos.",
              },
            ].map((item, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full text-left px-6 py-4 font-bold text-slate-800 flex justify-between items-center hover:bg-slate-50"
                >
                  {item.q}{" "}
                  <span className={`transform transition-transform ${openFaq === idx ? "rotate-180" : ""}`}>▼</span>
                </button>
                {openFaq === idx && (
                  <div className="px-6 py-4 text-slate-600 border-t border-slate-100 bg-slate-50/50">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 pt-20 pb-10 border-t border-slate-800">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Pronto para modernizar sua frota?</h2>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xl px-12 py-5 rounded-full shadow-2xl transition-transform hover:-translate-y-1"
          >
            Falar com Consultor
          </a>
          <div className="mt-20 pt-10 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-slate-500">
            <div>© {new Date().getFullYear()} Frota Link. Todos os direitos reservados.</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white">
                Suporte
              </a>
              <a href="#" className="hover:text-white">
                Login
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Botão Flutuante */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 bg-emerald-500 hover:bg-emerald-400 text-white p-4 rounded-full shadow-2xl z-50 transition-all hover:scale-110 flex items-center gap-3 pr-6"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
        <span className="font-bold hidden md:inline">WhatsApp</span>
      </a>
    </div>
  );
};

export default LandingPage;
