/**
 * Utilities for parsing and validating fiscal document XMLs
 */

export interface AddressData {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
}

export function detectDocumentType(accessKey: string): 'nfe' | 'cte' | 'unknown' {
  if (!/^\d{44}$/.test(accessKey)) {
    return 'unknown';
  }
  
  // Position 20-21 contains the document model
  // 55 = NF-e, 57 = CT-e
  const model = accessKey.substring(20, 22);
  
  if (model === '55') return 'nfe';
  if (model === '57') return 'cte';
  
  return 'unknown';
}

export function validateAccessKeyCheckDigit(accessKey: string): boolean {
  if (!/^\d{44}$/.test(accessKey)) {
    return false;
  }

  // Extract the check digit (last digit)
  const checkDigit = parseInt(accessKey.charAt(43));
  const keyWithoutCheckDigit = accessKey.substring(0, 43);

  // Calculate check digit using modulo 11
  let sum = 0;
  let multiplier = 2;

  // Process from right to left
  for (let i = keyWithoutCheckDigit.length - 1; i >= 0; i--) {
    sum += parseInt(keyWithoutCheckDigit.charAt(i)) * multiplier;
    multiplier = multiplier === 9 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const calculatedCheckDigit = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;

  return checkDigit === calculatedCheckDigit;
}

export function extractInfoFromKey(accessKey: string): {
  uf: string;
  yearMonth: string;
  cnpj: string;
  model: string;
  series: string;
  number: string;
  emissionType: string;
  code: string;
  checkDigit: string;
} | null {
  if (!/^\d{44}$/.test(accessKey)) {
    return null;
  }

  return {
    uf: accessKey.substring(0, 2),
    yearMonth: accessKey.substring(2, 6),
    cnpj: accessKey.substring(6, 20),
    model: accessKey.substring(20, 22),
    series: accessKey.substring(22, 25),
    number: accessKey.substring(25, 34),
    emissionType: accessKey.substring(34, 35),
    code: accessKey.substring(35, 43),
    checkDigit: accessKey.substring(43, 44),
  };
}

export function suggestCFOP(
  operationType: 'normal' | 'subcontratacao' | 'redespacho',
  originUF: string,
  destUF: string
): string {
  const isIntrastate = originUF === destUF;
  const prefix = isIntrastate ? '5' : '6';

  const cfopMap: Record<string, string> = {
    normal: `${prefix}.352`, // Prestação de serviço de transporte
    subcontratacao: `${prefix}.353`, // Prestação de serviço de transporte a estabelecimento industrial
    redespacho: `${prefix}.355`, // Prestação de serviço de transporte a contribuinte ou não contribuinte
  };

  return cfopMap[operationType] || `${prefix}.352`;
}

export function formatAddress(address: AddressData): string {
  const parts = [
    address.logradouro,
    address.numero,
    address.complemento,
    address.bairro,
    address.municipio,
    address.uf,
  ].filter(Boolean);

  return parts.join(', ');
}

export function formatDocument(document: string): string {
  // Remove non-digits
  const cleaned = document.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    // CPF: 000.000.000-00
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (cleaned.length === 14) {
    // CNPJ: 00.000.000/0000-00
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return document;
}

export function extractNumberFromKey(accessKey: string): string {
  const info = extractInfoFromKey(accessKey);
  return info ? info.number : '';
}

export function extractSeriesFromKey(accessKey: string): string {
  const info = extractInfoFromKey(accessKey);
  return info ? parseInt(info.series).toString() : '';
}

export function validateUF(uf: string): boolean {
  const validUFs = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];
  return validUFs.includes(uf.toUpperCase());
}

export function getOperationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    normal: 'Prestação Normal',
    subcontratacao: 'Subcontratação',
    redespacho: 'Redespacho',
  };
  return labels[type] || type;
}

export function getCFOPDescription(cfop: string): string {
  const descriptions: Record<string, string> = {
    '5.352': 'Prestação de serviço de transporte - Operação interna',
    '6.352': 'Prestação de serviço de transporte - Operação interestadual',
    '5.353': 'Prestação de serviço de transporte a estabelecimento industrial - Interna',
    '6.353': 'Prestação de serviço de transporte a estabelecimento industrial - Interestadual',
    '5.355': 'Prestação de serviço de transporte a contribuinte ou não contribuinte - Interna',
    '6.355': 'Prestação de serviço de transporte a contribuinte ou não contribuinte - Interestadual',
    '5.357': 'Prestação de serviço de transporte a não contribuinte - Interna',
    '6.357': 'Prestação de serviço de transporte a não contribuinte - Interestadual',
  };
  return descriptions[cfop] || cfop;
}
