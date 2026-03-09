export interface AddressData {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  codigoIBGE: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface ParsedNFeData {
  accessKey: string;
  nfeNumber: string;
  series: string;
  emissionDate: string;
  emitter: {
    name: string;
    cnpj: string;
    ie: string;
    address: AddressData;
  };
  recipient: {
    name: string;
    document: string;
    ie: string;
    address: AddressData;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitValue: number;
    totalValue: number;
    ncm: string;
    cfop: string;
  }>;
  totals: {
    products: number;
    freight: number;
    icms: number;
    ipi: number;
    total: number;
    totalWeight: number;
  };
  transport: {
    modalidade: string;
    vehicle?: {
      plate: string;
      uf: string;
    };
  };
  cfop: string;
}

const NFE_NAMESPACE = 'http://www.portalfiscal.inf.br/nfe';

function getElementWithNamespace(parent: Document | Element, tagName: string): Element | null {
  // Try without namespace first
  let element = parent.getElementsByTagName(tagName)[0];
  
  // Try with NF-e namespace (for default xmlns)
  if (!element && 'getElementsByTagNameNS' in parent) {
    element = (parent as Document).getElementsByTagNameNS(NFE_NAMESPACE, tagName)[0];
  }
  
  // Try with wildcard namespace selector
  if (!element && 'querySelector' in parent) {
    element = parent.querySelector(`*|${tagName}`) as Element;
  }
  
  // Try with common NF-e namespace prefixes
  if (!element) {
    const prefixes = ['ns', 'nfe', 'n'];
    for (const prefix of prefixes) {
      element = parent.getElementsByTagName(`${prefix}:${tagName}`)[0];
      if (element) break;
    }
  }
  
  return element || null;
}

function getTextContent(element: Element | null, tagName: string): string {
  if (!element) return '';
  
  const tag = getElementWithNamespace(element, tagName);
  return tag?.textContent?.trim() || '';
}

function getNumericContent(element: Element | null, tagName: string): number {
  const text = getTextContent(element, tagName);
  return text ? parseFloat(text) : 0;
}

function parseAddress(enderElement: Element | null): AddressData {
  if (!enderElement) {
    return {
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      codigoIBGE: '',
      cidade: '',
      uf: '',
      cep: ''
    };
  }

  return {
    logradouro: getTextContent(enderElement, 'xLgr'),
    numero: getTextContent(enderElement, 'nro'),
    complemento: getTextContent(enderElement, 'xCpl'),
    bairro: getTextContent(enderElement, 'xBairro'),
    codigoIBGE: getTextContent(enderElement, 'cMun'),
    cidade: getTextContent(enderElement, 'xMun'),
    uf: getTextContent(enderElement, 'UF'),
    cep: getTextContent(enderElement, 'CEP')
  };
}

export function parseNFeXml(xmlContent: string): ParsedNFeData | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('XML parsing error:', parseError.textContent);
      return null;
    }

    // Log for debugging
    console.log('NF-e XML parsing debug:', {
      hasNFe: xmlContent.includes('<NFe'),
      hasNamespace: xmlContent.includes('xmlns='),
      rootElement: doc.documentElement?.tagName,
    });

    // Find infNFe element (main NF-e info) - try multiple approaches
    let infNFe = getElementWithNamespace(doc, 'infNFe');
    
    // Fallback: try querySelector for any element with Id starting with NFe
    if (!infNFe) {
      infNFe = doc.querySelector('[Id^="NFe"]') as Element;
    }
    
    if (!infNFe) {
      console.error('infNFe element not found. Root elements:', 
        Array.from(doc.documentElement?.children || []).map(e => e.tagName).slice(0, 10)
      );
      return null;
    }

    // Extract access key - try multiple methods
    let accessKey = '';
    
    // Method 1: From Id attribute
    const idAttr = infNFe.getAttribute('Id') || '';
    accessKey = idAttr.replace(/^NFe/, '');
    
    // Method 2: From chNFe tag (in protNFe)
    if (!accessKey || accessKey.length !== 44) {
      const chNFe = getTextContent(doc.documentElement, 'chNFe');
      if (chNFe && chNFe.length === 44) {
        accessKey = chNFe;
        console.log('Access key extracted from chNFe tag');
      }
    }
    
    // Method 3: From protNFe/infProt
    if (!accessKey || accessKey.length !== 44) {
      const protNFe = getElementWithNamespace(doc, 'protNFe');
      const infProt = protNFe ? getElementWithNamespace(protNFe, 'infProt') : null;
      const chNFeFromProt = getTextContent(infProt, 'chNFe');
      if (chNFeFromProt && chNFeFromProt.length === 44) {
        accessKey = chNFeFromProt;
        console.log('Access key extracted from protNFe');
      }
    }

    // Get ide (identification) element
    const ide = getElementWithNamespace(doc, 'ide');

    // Get emit (emitter) element
    const emit = getElementWithNamespace(doc, 'emit');
    const enderEmit = emit ? getElementWithNamespace(emit, 'enderEmit') : null;

    // Get dest (recipient) element  
    const dest = getElementWithNamespace(doc, 'dest');
    const enderDest = dest ? getElementWithNamespace(dest, 'enderDest') : null;

    // Get total element
    const total = getElementWithNamespace(doc, 'total');
    const icmsTot = total ? getElementWithNamespace(total, 'ICMSTot') : null;

    // Get transport element
    const transp = getElementWithNamespace(doc, 'transp');
    const veicTransp = transp ? getElementWithNamespace(transp, 'veicTransp') : null;

    // Parse items (det elements) - try multiple methods
    let detElements = doc.getElementsByTagName('det');
    if (detElements.length === 0) {
      detElements = doc.getElementsByTagNameNS(NFE_NAMESPACE, 'det');
    }
    const items: ParsedNFeData['items'] = [];
    let firstCfop = '';

    for (let i = 0; i < detElements.length; i++) {
      const det = detElements[i];
      const prod = getElementWithNamespace(det, 'prod');
      
      if (prod) {
        const cfop = getTextContent(prod, 'CFOP');
        if (!firstCfop && cfop) {
          firstCfop = cfop;
        }

        items.push({
          description: getTextContent(prod, 'xProd'),
          quantity: getNumericContent(prod, 'qCom'),
          unitValue: getNumericContent(prod, 'vUnCom'),
          totalValue: getNumericContent(prod, 'vProd'),
          ncm: getTextContent(prod, 'NCM'),
          cfop: cfop
        });
      }
    }

    // Get peso bruto from transp
    const vol = transp ? getElementWithNamespace(transp, 'vol') : null;
    const pesoB = getNumericContent(vol, 'pesoB') || items.reduce((sum, i) => sum + i.quantity, 0);

    const parsed: ParsedNFeData = {
      accessKey,
      nfeNumber: getTextContent(ide, 'nNF'),
      series: getTextContent(ide, 'serie'),
      emissionDate: getTextContent(ide, 'dhEmi'),
      emitter: {
        name: getTextContent(emit, 'xNome'),
        cnpj: getTextContent(emit, 'CNPJ'),
        ie: getTextContent(emit, 'IE'),
        address: parseAddress(enderEmit)
      },
      recipient: {
        name: getTextContent(dest, 'xNome'),
        document: getTextContent(dest, 'CNPJ') || getTextContent(dest, 'CPF'),
        ie: getTextContent(dest, 'IE'),
        address: parseAddress(enderDest)
      },
      items,
      totals: {
        products: getNumericContent(icmsTot, 'vProd'),
        freight: getNumericContent(icmsTot, 'vFrete'),
        icms: getNumericContent(icmsTot, 'vICMS'),
        ipi: getNumericContent(icmsTot, 'vIPI'),
        total: getNumericContent(icmsTot, 'vNF'),
        totalWeight: pesoB
      },
      transport: {
        modalidade: getTextContent(transp, 'modFrete'),
        vehicle: veicTransp ? {
          plate: getTextContent(veicTransp, 'placa'),
          uf: getTextContent(veicTransp, 'UF')
        } : undefined
      },
      cfop: firstCfop
    };

    // Validate that we have at least the essential data
    if (!parsed.nfeNumber && !parsed.accessKey) {
      console.error('NF-e number or access key not found');
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing NF-e XML:', error);
    return null;
  }
}

// Detect document type from XML content
export function detectXmlDocumentType(xmlContent: string): 'nfe' | 'cte' | null {
  if (xmlContent.includes('<NFe') || xmlContent.includes('<nfeProc') || xmlContent.includes('<infNFe')) {
    return 'nfe';
  }
  if (xmlContent.includes('<CTe') || xmlContent.includes('<cteProc') || xmlContent.includes('<infCte')) {
    return 'cte';
  }
  return null;
}
