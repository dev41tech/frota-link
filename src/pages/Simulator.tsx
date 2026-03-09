import React, { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FeatureGate } from "@/components/subscription/FeatureGate";
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Fuel,
  MapPin,
  Truck,
  Clock,
  Wallet,
  AlertCircle,
  RefreshCcw,
  Printer,
  ChevronRight,
  ArrowRight,
  Map,
  ExternalLink,
  FileText,
  Upload,
  Image as ImageIcon,
  X,
  Coins,
  CalendarCheck,
} from "lucide-react";

// --- UI COMPONENTS ---

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
);
const CardHeader = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`px-6 py-4 border-b border-slate-100 ${className}`}>{children}</div>
);
const CardTitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`text-lg font-semibold text-slate-800 ${className}`}>{children}</h3>
);
const CardContent = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-600 mb-1.5">
    {children}
  </label>
);

const Input = ({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  icon: Icon,
  step,
  readOnly = false,
  className = "",
  rightElement,
  ...props
}: any) => (
  <div className="relative">
    {Icon && (
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <Icon className="h-4 w-4" />
      </div>
    )}
    <input
      id={id}
      type={type}
      step={step}
      value={value}
      readOnly={readOnly}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
        Icon ? "pl-9" : ""
      } ${rightElement ? "pr-24" : ""} ${readOnly ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""} ${className}`}
      {...props}
    />
    {rightElement && <div className="absolute right-1 top-1/2 -translate-y-1/2">{rightElement}</div>}
  </div>
);

const Button = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
  size = "default",
}: any) => {
  const base =
    "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

  const sizes: any = {
    default: "h-10 px-4 py-2",
    sm: "h-8 px-3 text-xs",
    xs: "h-7 px-2 text-[10px]",
    icon: "h-10 w-10",
  };

  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border border-slate-200 bg-transparent hover:bg-slate-100 text-slate-900",
    ghost: "hover:bg-slate-100 text-slate-600",
    link: "text-blue-600 hover:underline px-0 h-auto",
    destructive: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size] || sizes.default} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Select = ({ value, onChange, options, icon: Icon }: any) => (
  <div className="relative">
    {Icon && (
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <Icon className="h-4 w-4" />
      </div>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-10 appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${Icon ? "pl-9" : ""}`}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
      <ChevronRight className="h-4 w-4 rotate-90" />
    </div>
  </div>
);

// --- COMPONENTE DE PROPOSTA PROFISSIONAL (A4) ---

const ProposalModal = ({ isOpen, onClose, data, result, formatCurrency, formatNumber }: any) => {
  const [logo, setLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado para campos editáveis
  const [editable, setEditable] = useState({
    title: "PROPOSTA DE FRETE",
    number: Math.floor(Math.random() * 10000).toString(),
    validity: "5 dias úteis",
    origin: "",
    destination: "",
    value: 0, // Armazena como número
    terms:
      "• Proposta sujeita à disponibilidade de veículo na data solicitada.\n• O pagamento deve ser efetuado conforme condições comerciais acordadas.\n• Seguro de carga não incluso, salvo se estipulado em contrato.\n• Valores válidos apenas para a rota descrita.",
  });

  useEffect(() => {
    if (isOpen && result && data) {
      setEditable((prev) => ({
        ...prev,
        origin: data.origin,
        destination: data.destination,
        // CORREÇÃO: Arredonda para 2 casas decimais na inicialização para evitar dízimas
        value: parseFloat(result.suggestedFreightValue.toFixed(2)),
      }));
    }
  }, [isOpen, result, data]);

  if (!isOpen || !result) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const currentKmValue = result.totalDistance > 0 ? editable.value / result.totalDistance : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-hidden">
      {/* CSS DE IMPRESSÃO PROFISSIONAL */}
      <style>{`
        @media print {
          @page { margin: 0; size: A4 portrait; }
          body * { visibility: hidden; }
          html, body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          
          #proposal-sheet, #proposal-sheet * {
            visibility: visible;
          }
          
          #proposal-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            padding: 20mm; /* Margens padrão A4 */
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }

          /* Remove aparência de inputs */
          .editable-input, .editable-textarea {
            border: none !important;
            background: transparent !important;
            resize: none;
            padding: 0;
          }
          .print-hidden { display: none !important; }
        }
      `}</style>

      <div className="w-full max-w-5xl h-[90vh] flex flex-col bg-slate-100 rounded-xl overflow-hidden shadow-2xl border border-slate-300">
        {/* Barra de Ferramentas (Topo) */}
        <div className="bg-white border-b px-6 py-4 flex justify-between items-center print-hidden shrink-0 z-10 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Editor de Proposta
            </h2>
            <p className="text-xs text-slate-500">Edite os textos diretamente na folha abaixo antes de imprimir.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => window.print()} className="bg-slate-900 hover:bg-slate-800 text-white shadow-md">
              <Printer className="h-4 w-4 mr-2" />
              Salvar PDF / Imprimir
            </Button>
          </div>
        </div>

        {/* Área de Visualização (Scrollable) */}
        <div className="flex-1 overflow-y-auto bg-slate-200/50 p-8 flex justify-center print:p-0 print:overflow-visible">
          {/* A FOLHA A4 (210mm x 297mm) */}
          <div
            id="proposal-sheet"
            className="bg-white w-[210mm] min-h-[297mm] shadow-xl p-[20mm] relative flex flex-col text-slate-800 print:shadow-none"
          >
            {/* 1. Cabeçalho */}
            <div className="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
              <div className="w-1/2 pr-4">
                <div
                  className={`
                    relative group w-48 h-20 flex items-center justify-start rounded-lg transition-colors
                    ${!logo ? "bg-slate-50 border-2 border-dashed border-slate-200 cursor-pointer hover:bg-slate-100 print:border-none" : ""}
                  `}
                  onClick={() => !logo && fileInputRef.current?.click()}
                >
                  {logo ? (
                    <>
                      <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                      <button
                        onClick={(e: any) => {
                          e.stopPropagation();
                          setLogo(null);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity print-hidden shadow-sm"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full text-slate-400 print-hidden">
                      <ImageIcon className="h-5 w-5 mb-1" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">Inserir Logo</span>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleLogoUpload}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right w-1/2">
                <input
                  className="editable-input text-3xl font-extrabold text-slate-900 tracking-tight text-right w-full border-none focus:ring-0 p-0 placeholder:text-slate-300 uppercase"
                  value={editable.title}
                  onChange={(e) => setEditable({ ...editable, title: e.target.value })}
                />
                <div className="flex items-center justify-end gap-2 mt-1">
                  <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Orçamento Nº</span>
                  <input
                    className="editable-input text-right w-20 text-sm font-semibold text-blue-600"
                    value={editable.number}
                    onChange={(e) => setEditable({ ...editable, number: e.target.value })}
                  />
                </div>

                <div className="mt-6 space-y-1 text-sm text-slate-500">
                  <div className="flex justify-end gap-2">
                    <span className="font-medium">Emissão:</span>
                    <span>{new Date().toLocaleDateString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-end gap-2 items-center">
                    <span className="font-medium">Validade:</span>
                    <input
                      className="editable-input text-right w-24 border-b border-slate-200 hover:border-slate-400 focus:border-blue-500 outline-none bg-transparent py-0 h-5"
                      value={editable.validity}
                      onChange={(e) => setEditable({ ...editable, validity: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Rota */}
            <div className="bg-slate-50 rounded-xl p-6 mb-8 border border-slate-100 print:bg-slate-50 print:border-slate-200">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Map className="h-3 w-3" /> Detalhes da Rota
              </h3>

              <div className="relative flex flex-col md:flex-row gap-8 justify-between">
                {/* Linha conectora */}
                <div className="absolute top-3 left-3 bottom-3 w-0.5 bg-slate-200 md:hidden"></div>

                {/* Origem */}
                <div className="flex-1 relative pl-8 md:pl-0">
                  <div className="absolute md:static left-0 top-1 w-6 h-6 rounded-full bg-white border-4 border-blue-500 shadow-sm z-10"></div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-1 md:mt-2">Origem</p>
                  <input
                    className="editable-input w-full text-lg font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none transition-colors"
                    value={editable.origin}
                    onChange={(e) => setEditable({ ...editable, origin: e.target.value })}
                  />
                </div>

                {/* Seta e Distância */}
                <div className="flex flex-col items-center justify-center min-w-[150px]">
                  <div className="flex items-center gap-2 text-slate-400 text-sm font-medium bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                    <ArrowRight className="h-4 w-4" />
                    {formatNumber(result.totalDistance)} km
                  </div>
                </div>

                {/* Destino */}
                <div className="flex-1 relative pl-8 md:pl-0 md:text-right">
                  <div className="absolute md:static md:ml-auto left-0 top-1 w-6 h-6 rounded-full bg-white border-4 border-emerald-500 shadow-sm z-10"></div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-1 md:mt-2">Destino</p>
                  <input
                    className="editable-input w-full text-lg font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none transition-colors md:text-right"
                    value={editable.destination}
                    onChange={(e) => setEditable({ ...editable, destination: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* 3. Cards de Informação */}
            <div className="grid grid-cols-3 gap-4 mb-10">
              <div className="p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Truck className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase">Veículo</span>
                </div>
                <p className="text-base font-semibold text-slate-800 capitalize truncate">
                  {data.vehicleType === "truck"
                    ? "Carreta LS"
                    : data.vehicleType === "truck_simple"
                      ? "Truck / Bitruck"
                      : data.vehicleType === "van"
                        ? "Utilitário"
                        : data.vehicleType}
                </p>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase">Tempo Est.</span>
                </div>
                <p className="text-base font-semibold text-slate-800">
                  {Math.floor(result.estimatedDuration)}h {Math.round((result.estimatedDuration % 1) * 60)}m
                </p>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <CalendarCheck className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase">Previsão</span>
                </div>
                <p className="text-base font-semibold text-slate-800">Imediata</p>
              </div>
            </div>

            {/* 4. Valor Financeiro */}
            <div className="border-t-2 border-slate-800 pt-8 mb-10">
              <div className="flex justify-between items-start">
                <div className="max-w-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-2">Descritivo de Valores</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    O valor apresentado inclui todos os custos operacionais, combustível, pedágios estimados e impostos
                    incidentes sobre o transporte.
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium text-slate-500 mb-1">Valor Total do Frete</p>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-2xl font-bold text-slate-800">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      className="editable-input text-4xl font-extrabold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-48 text-right p-0"
                      value={editable.value}
                      // CORREÇÃO: Permite digitar decimais corretamente sem travar
                      onChange={(e) => setEditable({ ...editable, value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="mt-2 text-sm text-slate-400 font-medium">
                    (R$ {formatNumber(currentKmValue, 2)} / km)
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Termos e Rodapé */}
            <div className="mt-auto">
              <div className="mb-8">
                <h4 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">
                  Observações & Condições
                </h4>
                <textarea
                  className="editable-textarea w-full h-32 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4 focus:border-blue-500 outline-none resize-none leading-relaxed print:bg-white print:border-none print:p-0"
                  value={editable.terms}
                  onChange={(e) => setEditable({ ...editable, terms: e.target.value })}
                />
              </div>

              <div className="border-t border-slate-200 pt-6 flex justify-between items-center text-xs text-slate-400">
                <p>
                  Documento gerado automaticamente via sistema <strong>Frota Link</strong>
                </p>
                <div className="flex gap-4">
                  <p>Página 1 de 1</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- CONFIGURAÇÃO DE VEÍCULOS E EIXOS ---
const VEHICLE_SPECS: Record<string, { label: string; axles: number }> = {
  truck: { label: "Carreta LS", axles: 7 }, // Cavalinho 3 + Carreta 3 ou 4
  truck_simple: { label: "Truck / Bitruck", axles: 4 },
  toco: { label: "Toco (2 eixos)", axles: 2 },
  vuc: { label: "VUC / 3/4", axles: 2 },
  van: { label: "Van / Utilitário", axles: 2 }, // Cobrança categoria passeio muitas vezes
};

// --- MAIN APP ---

interface SimulationResult {
  totalDistance: number;
  estimatedDuration: number;
  fuelConsumption: number;
  fuelCost: number;
  driverPayment: number;
  tollCosts: number;
  totalCosts: number;
  suggestedFreightValue: number;
  estimatedProfit: number;
  profitMargin: number;
  breakEvenPoint: number;
}

function SimulatorContent() {
  const [loading, setLoading] = useState(false);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isProposalOpen, setIsProposalOpen] = useState(false);

  const xmlInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState({
    origin: "",
    destination: "",
    distance: "",
    vehicleType: "truck",
    fuelPrice: "6.29",
    fuelConsumption: "2.5",
    driverCommission: "12",
    tollCosts: "",
    otherExpenses: "",
    desiredMargin: "30",
  });

  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleInput = (field: string, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    if (field === "origin" || field === "destination") {
      setGeoError(null);
    }
  };

  // --- XML IMPORT ---
  const handleXmlImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        // Helper para pegar valor de tag
        const getTag = (parent: Element | Document, tagName: string) =>
          parent.getElementsByTagName(tagName)[0]?.textContent || "";

        // Tenta NFe ou CTe
        const emit = xmlDoc.getElementsByTagName("emit")[0];
        const dest = xmlDoc.getElementsByTagName("dest")[0] || xmlDoc.getElementsByTagName("rem")[0]; // dest (NFe) ou rem (CTe antigo)

        let originCity = "",
          originUF = "",
          destCity = "",
          destUF = "";

        if (emit) {
          const enderEmit = emit.getElementsByTagName("enderEmit")[0] || emit.getElementsByTagName("enderReme")[0];
          if (enderEmit) {
            originCity = getTag(enderEmit, "xMun");
            originUF = getTag(enderEmit, "UF");
          }
        }

        if (dest) {
          const enderDest = dest.getElementsByTagName("enderDest")[0] || dest.getElementsByTagName("enderReme")[0];
          if (enderDest) {
            destCity = getTag(enderDest, "xMun");
            destUF = getTag(enderDest, "UF");
          }
        }

        // Fallback para CTe (tags podem ser 'ini' e 'fim' para locais de serviço)
        if (!originCity) {
          const ide = xmlDoc.getElementsByTagName("ide")[0];
          if (ide) {
            originUF = getTag(ide, "UFIni");
            destUF = getTag(ide, "UFFim");
            originCity = getTag(ide, "xMunIni");
            destCity = getTag(ide, "xMunFim");
          }
        }

        if (originCity && originUF && destCity && destUF) {
          handleInput("origin", `${originCity} - ${originUF}`);
          handleInput("destination", `${destCity} - ${destUF}`);
          setGeoError(null);
        } else {
          setGeoError("Não foi possível identificar Origem e Destino neste XML.");
        }
      } catch (err) {
        setGeoError("Erro ao ler o arquivo XML.");
        console.error(err);
      } finally {
        setLoading(false);
        if (xmlInputRef.current) xmlInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleCepSearch = async (field: string, value: string) => {
    const cep = value.replace(/\D/g, "");
    if (cep.length === 8) {
      if (field === "origin") handleInput("origin", "Buscando endereço...");
      if (field === "destination") handleInput("destination", "Buscando endereço...");

      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const addressData = await response.json();

        if (!addressData.erro) {
          let formattedAddress = "";
          if (addressData.logradouro) {
            formattedAddress = `${addressData.logradouro}, ${addressData.bairro}, ${addressData.localidade} - ${addressData.uf}`;
          } else {
            formattedAddress = `${addressData.localidade} - ${addressData.uf}`;
          }
          handleInput(field, formattedAddress);
          setGeoError(null);
        } else {
          setGeoError(`CEP ${value} não encontrado.`);
          handleInput(field, "");
        }
      } catch (error) {
        console.error("Erro ao buscar CEP", error);
        setGeoError("Erro de conexão ao buscar CEP.");
        handleInput(field, "");
      }
    }
  };

  const fetchDistance = async () => {
    if (!data.origin || !data.destination) {
      setGeoError("Preencha origem e destino para calcular.");
      return;
    }

    setCalculatingDistance(true);
    setGeoError(null);

    try {
      console.log("Iniciando cálculo de rota via hyper-worker...");

      const { data: funcData, error: funcError } = await supabase.functions.invoke("hyper-worker", {
        body: {
          origin: data.origin,
          destination: data.destination,
        },
      });

      if (funcError) {
        console.error("Erro na Edge Function:", funcError);
        throw new Error("Erro de conexão com o servidor de mapas.");
      }

      if (funcData?.error) {
        throw new Error(funcData.error);
      }

      if (!funcData || !funcData.distance) {
        throw new Error("Resposta inválida do servidor.");
      }

      setData((prev) => ({ ...prev, distance: funcData.distance.toString() }));
    } catch (err: any) {
      console.error("Erro no fetchDistance:", err);
      setGeoError(err.message || "Não foi possível calcular a rota. Verifique o nome das cidades.");
    } finally {
      setCalculatingDistance(false);
    }
  };

  const openGoogleMaps = () => {
    if (data.origin && data.destination) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(data.origin)}&destination=${encodeURIComponent(data.destination)}`;
      window.open(url, "_blank");
    }
  };

  const estimateTolls = () => {
    if (!data.distance) {
      setError("Calcule a distância primeiro para estimar o pedágio.");
      return;
    }

    const dist = parseFloat(data.distance);
    const vehicle = VEHICLE_SPECS[data.vehicleType] || VEHICLE_SPECS.truck;
    const axles = vehicle.axles;

    // FATOR DE CUSTO (R$ por km por eixo)
    const COST_PER_AXLE_KM = 0.11;

    const estimatedValue = dist * axles * COST_PER_AXLE_KM;
    handleInput("tollCosts", estimatedValue.toFixed(2));
  };

  const calculate = async () => {
    if (!data.distance || !data.fuelPrice) {
      setError("Por favor, preencha a distância e o preço do combustível para iniciar.");
      return;
    }

    setLoading(true);
    setError(null);
    await new Promise((r) => setTimeout(r, 600));

    try {
      const dist = parseFloat(data.distance);
      const fuelP = parseFloat(data.fuelPrice);
      const cons = parseFloat(data.fuelConsumption) || 1;
      const commPct = parseFloat(data.driverCommission) || 0;
      const tolls = parseFloat(data.tollCosts) || 0;
      const others = parseFloat(data.otherExpenses) || 0;
      const marginPct = parseFloat(data.desiredMargin) || 0;

      const totalFuelLiters = dist / cons;
      const fuelTotalCost = totalFuelLiters * fuelP;
      const operationalCost = fuelTotalCost + tolls + others;

      // Cálculo Reverso
      const totalDeductionsPct = (commPct + marginPct) / 100;
      const safeDeduction = totalDeductionsPct >= 0.9 ? 0.9 : totalDeductionsPct;
      const suggestedFreight = operationalCost / (1 - safeDeduction);

      const driverPay = suggestedFreight * (commPct / 100);
      const totalCost = operationalCost + driverPay;
      const profit = suggestedFreight - totalCost;
      const actualMargin = (profit / suggestedFreight) * 100;
      const breakEven = operationalCost / (1 - commPct / 100);

      setResult({
        totalDistance: dist,
        estimatedDuration: dist / 65,
        fuelConsumption: totalFuelLiters,
        fuelCost: fuelTotalCost,
        driverPayment: driverPay,
        tollCosts: tolls,
        totalCosts: totalCost,
        suggestedFreightValue: suggestedFreight,
        estimatedProfit: profit,
        profitMargin: actualMargin,
        breakEvenPoint: breakEven,
      });
    } catch (err) {
      setError("Ocorreu um erro ao calcular. Verifique os valores numéricos.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const formatNumber = (val: number, decimals = 1) =>
    new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8 print:bg-white print:p-0">
      {/* Modal de Proposta */}
      <ProposalModal
        isOpen={isProposalOpen}
        onClose={() => setIsProposalOpen(false)}
        data={data}
        result={result}
        formatCurrency={formatCurrency}
        formatNumber={formatNumber}
      />

      {/* Header Principal (Escondido na impressão) */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 print-hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Truck className="h-6 w-6" />
            </div>
            Cálculo de Frete <span className="text-slate-400 font-light">| Simulador </span>
          </h1>
          <p className="mt-1 text-slate-500">Frota Link - Módulo de Rentabilidade</p>
        </div>
        <div className="flex gap-3">
          {result && (
            <Button
              variant="primary"
              onClick={() => setIsProposalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Criar Proposta
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Relatório
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 print:block">
        {/* LEFT COLUMN - INPUTS */}
        <div className="lg:col-span-4 space-y-6 print-hidden">
          <Card className="overflow-hidden border-t-4 border-t-blue-600">
            <CardHeader className="bg-slate-50/50 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-blue-600" />
                Rota e Logística
              </CardTitle>

              {/* Botão Importar XML */}
              <div>
                <input type="file" accept=".xml" ref={xmlInputRef} className="hidden" onChange={handleXmlImport} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 px-2 text-blue-600 hover:bg-blue-50"
                  onClick={() => xmlInputRef.current?.click()}
                  title="Importar NFe/CTe"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Importar XML
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="origin">Origem (Cidade ou CEP)</Label>
                  <Input
                    id="origin"
                    placeholder="Ex: 80000-000 ou São Paulo"
                    value={data.origin}
                    onChange={(e: any) => handleInput("origin", e.target.value)}
                    onBlur={(e: any) => handleCepSearch("origin", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="destination">Destino (Cidade ou CEP)</Label>
                  <Input
                    id="destination"
                    placeholder="Ex: 20000-000 ou Curitiba"
                    value={data.destination}
                    onChange={(e: any) => handleInput("destination", e.target.value)}
                    onBlur={(e: any) => handleCepSearch("destination", e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={fetchDistance}
                    disabled={calculatingDistance || !data.origin || !data.destination}
                  >
                    {calculatingDistance ? (
                      <RefreshCcw className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <MapPin className="h-3 w-3 mr-1" />
                    )}
                    {calculatingDistance ? "Calculando..." : "Calcular Distância"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs bg-white"
                    onClick={openGoogleMaps}
                    disabled={!data.origin || !data.destination}
                  >
                    <Map className="h-3 w-3 mr-1" />
                    Ver no Mapa
                  </Button>
                </div>
                {geoError && <p className="text-xs text-red-500 mt-1 text-center font-medium">{geoError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="distance">Distância (km) *</Label>
                  <Input
                    id="distance"
                    type="number"
                    placeholder="0"
                    value={data.distance}
                    onChange={(e: any) => handleInput("distance", e.target.value)}
                    icon={ArrowRight}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="vehicle">Veículo</Label>
                  <Select
                    value={data.vehicleType}
                    onChange={(v: string) => handleInput("vehicleType", v)}
                    options={Object.entries(VEHICLE_SPECS).map(([key, spec]) => ({ label: spec.label, value: key }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-t-4 border-t-emerald-600">
            <CardHeader className="bg-slate-50/50">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-emerald-600" />
                Custos Operacionais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fuelPrice">Diesel (R$/L) *</Label>
                  <Input
                    id="fuelPrice"
                    type="number"
                    step="0.01"
                    value={data.fuelPrice}
                    onChange={(e: any) => handleInput("fuelPrice", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="consumption">Média (km/L)</Label>
                  <Input
                    id="consumption"
                    type="number"
                    step="0.1"
                    value={data.fuelConsumption}
                    // CORREÇÃO AQUI: handleInput("fuelConsumption"...)
                    onChange={(e: any) => handleInput("fuelConsumption", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="tolls">Pedágios Estimados (R$)</Label>
                  {/* INPUT COM BOTÃO DE AÇÃO EMBUTIDO */}
                  <Input
                    id="tolls"
                    type="number"
                    placeholder="0.00"
                    value={data.tollCosts}
                    onChange={(e: any) => handleInput("tollCosts", e.target.value)}
                    rightElement={
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 font-medium px-2 mr-1"
                        onClick={estimateTolls}
                        title="Calcular média estatística baseada em eixos/km"
                        disabled={!data.distance}
                      >
                        <Coins className="h-3 w-3 mr-1" />
                        Estimar
                      </Button>
                    }
                  />
                  <p className="text-[10px] text-slate-400 mt-1 ml-1">
                    *Estimativa baseada em eixos. Verifique o valor real.
                  </p>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="others">Outros (R$)</Label>
                  <Input
                    id="others"
                    type="number"
                    placeholder="Despesas, Diárias"
                    value={data.otherExpenses}
                    onChange={(e: any) => handleInput("otherExpenses", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-t-4 border-t-violet-600">
            <CardHeader className="bg-slate-50/50">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-violet-600" />
                Definição de Margem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="commission">Comissão (%)</Label>
                  <Input
                    id="commission"
                    type="number"
                    step="0.5"
                    value={data.driverCommission}
                    onChange={(e: any) => handleInput("driverCommission", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="margin">Margem Líquida (%)</Label>
                  <Input
                    id="margin"
                    type="number"
                    step="1"
                    className="font-bold text-blue-600"
                    value={data.desiredMargin}
                    onChange={(e: any) => handleInput("desiredMargin", e.target.value)}
                  />
                </div>
              </div>

              <Button
                className="w-full h-12 text-base bg-slate-900 hover:bg-slate-800"
                onClick={calculate}
                disabled={loading}
              >
                {loading ? <RefreshCcw className="h-5 w-5 animate-spin" /> : <Calculator className="h-5 w-5 mr-2" />}
                {loading ? "Calculando..." : "Executar Simulação"}
              </Button>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN - RESULTS DASHBOARD */}
        <div className="lg:col-span-8 space-y-6 print:col-span-12">
          {!result ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
              <div className="p-4 rounded-full bg-slate-50 mb-4">
                <Calculator className="h-12 w-12 text-slate-300" />
              </div>
              <h3 className="text-lg font-medium text-slate-600">Nenhuma simulação ativa</h3>
              <p className="max-w-md text-center text-sm mt-2">
                Preencha os dados de rota e custos no painel lateral ou importe um XML para gerar uma análise detalhada.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Top KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-none shadow-lg shadow-blue-900/20">
                  <CardContent className="p-6 relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-10">
                      <DollarSign className="h-24 w-24" />
                    </div>
                    <p className="text-blue-100 text-sm font-medium mb-1">Valor Sugerido do Frete</p>
                    <h2 className="text-3xl font-bold tracking-tight">
                      {formatCurrency(result.suggestedFreightValue)}
                    </h2>
                    <div className="mt-4 flex items-center gap-2 text-sm text-blue-100 bg-white/10 w-fit px-2 py-1 rounded">
                      <span>R$ {formatNumber(result.suggestedFreightValue / result.totalDistance, 2)} / km</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-medium">Lucro Líquido Estimado</span>
                    </div>
                    <h2 className="text-2xl font-bold text-emerald-600">{formatCurrency(result.estimatedProfit)}</h2>
                    <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(result.profitMargin, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-2 text-right">
                      {formatNumber(result.profitMargin)}% Margem
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-slate-500 mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Ponto de Equilíbrio</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-700">{formatCurrency(result.breakEvenPoint)}</h2>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Mínimo para cobrir custos e comissão sem prejuízo.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Specs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cost Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Composição de Custos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-50 rounded text-red-600">
                            <Fuel className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium text-slate-600">
                            Combustível ({formatNumber(result.fuelConsumption)} L)
                          </span>
                        </div>
                        <span className="font-semibold text-slate-700">{formatCurrency(result.fuelCost)}</span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-50 rounded text-orange-600">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium text-slate-600">Pedágios & Taxas</span>
                        </div>
                        <span className="font-semibold text-slate-700">{formatCurrency(result.tollCosts)}</span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-50 rounded text-purple-600">
                            <Wallet className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium text-slate-600">
                            Comissão ({data.driverCommission}%)
                          </span>
                        </div>
                        <span className="font-semibold text-slate-700">{formatCurrency(result.driverPayment)}</span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 rounded text-slate-600">
                            <Truck className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium text-slate-600">Outros Custos</span>
                        </div>
                        <span className="font-semibold text-slate-700">
                          {formatCurrency(parseFloat(data.otherExpenses) || 0)}
                        </span>
                      </div>

                      <div className="pt-3 flex justify-between items-center bg-slate-50 p-3 rounded-lg mt-2">
                        <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">Custo Total</span>
                        <span className="text-lg font-bold text-red-600">{formatCurrency(result.totalCosts)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Logistics Info */}
                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle>Resumo Logístico</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="relative pl-6 border-l-2 border-slate-200 space-y-8 my-4">
                      <div className="relative">
                        <div className="absolute -left-[29px] top-0 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Origem</p>
                        <p className="text-slate-800 font-medium">{data.origin || "Não informado"}</p>
                      </div>

                      <div className="relative">
                        <div className="absolute -left-[29px] top-0 w-4 h-4 rounded-full bg-slate-300 border-2 border-white shadow-sm" />
                        <div className="flex items-center gap-4 text-sm text-slate-500 bg-slate-50 p-3 rounded border border-slate-100">
                          <span className="flex items-center gap-1">
                            <Truck className="h-3 w-3" /> {formatNumber(result.totalDistance)} km
                          </span>
                          <span className="w-px h-4 bg-slate-300"></span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> ~{Math.floor(result.estimatedDuration)}h{" "}
                            {Math.round((result.estimatedDuration % 1) * 60)}m
                          </span>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="absolute -left-[29px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Destino</p>
                        <p className="text-slate-800 font-medium">{data.destination || "Não informado"}</p>
                      </div>
                    </div>

                    <div className="mt-auto pt-6 flex flex-col gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                        onClick={openGoogleMaps}
                        disabled={!data.origin || !data.destination}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Visualizar rota no Google Maps
                      </Button>

                      <div
                        className={`p-4 rounded-lg border ${result.profitMargin > 15 ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-yellow-50 border-yellow-100 text-yellow-800"}`}
                      >
                        <div className="flex gap-3">
                          <TrendingUp className="h-5 w-5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-sm">Análise de Viabilidade</p>
                            <p className="text-xs mt-1 opacity-90">
                              {result.profitMargin > 20
                                ? "Esta viagem apresenta uma margem de lucro saudável acima de 20%."
                                : "Margem apertada. Considere negociar o valor do frete ou reduzir custos fixos."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Export with FeatureGate wrapper
export default function ProfessionalSimulator() {
  return (
    <FeatureGate feature="simulator">
      <SimulatorContent />
    </FeatureGate>
  );
}
