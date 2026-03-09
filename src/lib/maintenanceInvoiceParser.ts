// Parser de NF-e XML para manutenção de veículos

export interface ParsedInvoice {
  // Dados da NF
  invoiceNumber: string;
  invoiceKey: string;
  invoiceDate: string;
  
  // Dados do emitente (oficina)
  workshop: {
    name: string;
    cnpj: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
  };
  
  // Produtos/Serviços
  items: ParsedItem[];
  
  // Totais
  totalProducts: number;
  totalServices: number;
  totalValue: number;
}

export interface ParsedItem {
  description: string;
  partCode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  ncm: string;
  cfop: string;
  isService: boolean;
}

// Extrai texto de um elemento XML
function getElementText(parent: Element, tagName: string): string {
  const element = parent.getElementsByTagName(tagName)[0];
  return element?.textContent?.trim() || "";
}

// Extrai número de um elemento XML
function getElementNumber(parent: Element, tagName: string): number {
  const text = getElementText(parent, tagName);
  return parseFloat(text) || 0;
}

// Parser principal de NF-e XML
export function parseMaintenanceInvoice(xmlContent: string): ParsedInvoice | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
    
    // Verifica erro de parse
    const parseError = xmlDoc.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      console.error("Erro ao parsear XML:", parseError[0].textContent);
      return null;
    }
    
    // Busca elementos principais
    const infNFe = xmlDoc.getElementsByTagName("infNFe")[0];
    if (!infNFe) {
      console.error("Elemento infNFe não encontrado");
      return null;
    }
    
    // Dados da NF
    const ide = xmlDoc.getElementsByTagName("ide")[0];
    const invoiceNumber = getElementText(ide, "nNF");
    const invoiceKey = infNFe.getAttribute("Id")?.replace("NFe", "") || "";
    const invoiceDate = getElementText(ide, "dhEmi").split("T")[0];
    
    // Dados do emitente (oficina)
    const emit = xmlDoc.getElementsByTagName("emit")[0];
    const enderEmit = xmlDoc.getElementsByTagName("enderEmit")[0];
    
    const workshop = {
      name: getElementText(emit, "xNome"),
      cnpj: getElementText(emit, "CNPJ"),
      phone: getElementText(enderEmit, "fone"),
      email: getElementText(emit, "email"),
      address: `${getElementText(enderEmit, "xLgr")}, ${getElementText(enderEmit, "nro")} ${getElementText(enderEmit, "xCpl")}`.trim(),
      city: getElementText(enderEmit, "xMun"),
      state: getElementText(enderEmit, "UF"),
    };
    
    // Produtos/Serviços
    const dets = xmlDoc.getElementsByTagName("det");
    const items: ParsedItem[] = [];
    let totalProducts = 0;
    let totalServices = 0;
    
    for (let i = 0; i < dets.length; i++) {
      const det = dets[i];
      const prod = det.getElementsByTagName("prod")[0];
      
      if (!prod) continue;
      
      const description = getElementText(prod, "xProd");
      const cfop = getElementText(prod, "CFOP");
      const unitPrice = getElementNumber(prod, "vUnCom");
      const totalPrice = getElementNumber(prod, "vProd");
      
      // CFOPs de serviço geralmente começam com 5.9XX ou 6.9XX
      const isService = cfop.startsWith("59") || cfop.startsWith("69") || 
                        description.toLowerCase().includes("mão de obra") ||
                        description.toLowerCase().includes("serviço") ||
                        description.toLowerCase().includes("mao de obra");
      
      const item: ParsedItem = {
        description,
        partCode: getElementText(prod, "cProd"),
        quantity: getElementNumber(prod, "qCom"),
        unit: getElementText(prod, "uCom"),
        unitPrice,
        totalPrice,
        ncm: getElementText(prod, "NCM"),
        cfop,
        isService,
      };
      
      items.push(item);
      
      if (isService) {
        totalServices += totalPrice;
      } else {
        totalProducts += totalPrice;
      }
    }
    
    // Total geral
    const total = xmlDoc.getElementsByTagName("total")[0];
    const icmsTot = total?.getElementsByTagName("ICMSTot")[0];
    const totalValue = getElementNumber(icmsTot || total, "vNF");
    
    return {
      invoiceNumber,
      invoiceKey,
      invoiceDate,
      workshop,
      items,
      totalProducts,
      totalServices,
      totalValue: totalValue || totalProducts + totalServices,
    };
  } catch (error) {
    console.error("Erro ao processar NF-e XML:", error);
    return null;
  }
}

// Formata CNPJ
export function formatCNPJ(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return cnpj;
  return clean.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

// Sugere categoria de serviço baseado nos itens
export function suggestServiceCategory(items: ParsedItem[]): string {
  const descriptions = items.map(i => i.description.toLowerCase()).join(" ");
  
  if (descriptions.includes("óleo") || descriptions.includes("oleo") || descriptions.includes("lubrificante")) {
    return "oil_change";
  }
  if (descriptions.includes("pneu") || descriptions.includes("roda")) {
    return "tires";
  }
  if (descriptions.includes("freio") || descriptions.includes("pastilha") || descriptions.includes("disco")) {
    return "brakes";
  }
  if (descriptions.includes("bateria") || descriptions.includes("elétric") || descriptions.includes("eletric")) {
    return "electrical";
  }
  if (descriptions.includes("suspensão") || descriptions.includes("amortecedor") || descriptions.includes("mola")) {
    return "suspension";
  }
  if (descriptions.includes("radiador") || descriptions.includes("arrefec") || descriptions.includes("ventoinha")) {
    return "cooling";
  }
  if (descriptions.includes("câmbio") || descriptions.includes("cambio") || descriptions.includes("transmissão")) {
    return "transmission";
  }
  if (descriptions.includes("motor") || descriptions.includes("pistão") || descriptions.includes("válvula")) {
    return "engine";
  }
  if (descriptions.includes("revisão") || descriptions.includes("revisao")) {
    return "general_revision";
  }
  
  return "other";
}
