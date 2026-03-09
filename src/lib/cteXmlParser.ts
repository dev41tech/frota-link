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

export interface ParsedCTeData {
  accessKey: string;
  cteNumber: string;
  series: string;
  emissionDate: string;
  origin: {
    city: string;
    uf: string;
  };
  destination: {
    city: string;
    uf: string;
  };
  emitter: {
    name: string;
    cnpj: string;
    ie: string;
    address: AddressData;
  };
  sender: {
    name: string;
    cnpj: string;
    ie: string;
    address: AddressData;
  };
  recipient: {
    name: string;
    cnpj: string;
    ie: string;
    address: AddressData;
  };
  values: {
    freightTotal: number;
    freightReceived: number;
  };
  cfop: string;
  naturezaCarga: string;
}

function getTextContent(element: Element | null, tagName: string): string {
  if (!element) return '';
  const tag = element.getElementsByTagName(tagName)[0];
  return tag?.textContent?.trim() || '';
}

function getNumericContent(element: Element | null, tagName: string): number {
  const text = getTextContent(element, tagName);
  const num = parseFloat(text.replace(',', '.'));
  return isNaN(num) ? 0 : num;
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

export function parseCTeXml(xmlContent: string): ParsedCTeData | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('XML parsing error:', parseError.textContent);
      return null;
    }

    // Find infCte element (main CT-e info)
    const infCte = doc.getElementsByTagName('infCte')[0];
    if (!infCte) {
      console.error('infCte element not found');
      return null;
    }

    // Extract access key from Id attribute (remove "CTe" prefix if present)
    const idAttr = infCte.getAttribute('Id') || '';
    const accessKey = idAttr.replace(/^CTe/, '');

    // Get ide (identification) element
    const ide = doc.getElementsByTagName('ide')[0];
    
    // Get emit (emitter) element
    const emit = doc.getElementsByTagName('emit')[0];
    const enderEmit = emit?.getElementsByTagName('enderEmit')[0];
    
    // Get rem (sender/remetente) element
    const rem = doc.getElementsByTagName('rem')[0];
    const enderReme = rem?.getElementsByTagName('enderReme')[0];
    
    // Get dest (recipient/destinatário) element
    const dest = doc.getElementsByTagName('dest')[0];
    const enderDest = dest?.getElementsByTagName('enderDest')[0];
    
    // Get vPrest (service values) element
    const vPrest = doc.getElementsByTagName('vPrest')[0];

    // Get infCarga for natureza
    const infCarga = doc.getElementsByTagName('infCarga')[0];

    const parsed: ParsedCTeData = {
      accessKey,
      cteNumber: getTextContent(ide, 'nCT'),
      series: getTextContent(ide, 'serie'),
      emissionDate: getTextContent(ide, 'dhEmi'),
      origin: {
        city: getTextContent(ide, 'xMunIni'),
        uf: getTextContent(ide, 'UFIni'),
      },
      destination: {
        city: getTextContent(ide, 'xMunFim'),
        uf: getTextContent(ide, 'UFFim'),
      },
      emitter: {
        name: getTextContent(emit, 'xNome'),
        cnpj: getTextContent(emit, 'CNPJ'),
        ie: getTextContent(emit, 'IE'),
        address: parseAddress(enderEmit),
      },
      sender: {
        name: getTextContent(rem, 'xNome'),
        cnpj: getTextContent(rem, 'CNPJ') || getTextContent(rem, 'CPF'),
        ie: getTextContent(rem, 'IE'),
        address: parseAddress(enderReme),
      },
      recipient: {
        name: getTextContent(dest, 'xNome'),
        cnpj: getTextContent(dest, 'CNPJ') || getTextContent(dest, 'CPF'),
        ie: getTextContent(dest, 'IE'),
        address: parseAddress(enderDest),
      },
      values: {
        freightTotal: getNumericContent(vPrest, 'vTPrest'),
        freightReceived: getNumericContent(vPrest, 'vRec'),
      },
      cfop: getTextContent(ide, 'CFOP'),
      naturezaCarga: getTextContent(infCarga, 'proPred'),
    };

    // Validate that we have at least the essential data
    if (!parsed.cteNumber && !parsed.accessKey) {
      console.error('CT-e number or access key not found');
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing CT-e XML:', error);
    return null;
  }
}
