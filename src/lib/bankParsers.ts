// Bank statement parsers for OFX and CSV formats

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  bankReference?: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  fileType: 'csv' | 'ofx';
  bankName?: string;
  accountNumber?: string;
  errors: string[];
}

// ============= OFX Parser =============

export function parseOFX(content: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  let bankName = '';
  let accountNumber = '';

  try {
    // Extract bank info
    const orgMatch = content.match(/<ORG>([^<]+)/i);
    if (orgMatch) bankName = orgMatch[1].trim();

    const acctMatch = content.match(/<ACCTID>([^<]+)/i);
    if (acctMatch) accountNumber = acctMatch[1].trim();

    // Find all STMTTRN blocks (transactions)
    const transactionRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = transactionRegex.exec(content)) !== null) {
      const block = match[1];

      // Extract transaction fields
      const trnTypeMatch = block.match(/<TRNTYPE>([^<\n]+)/i);
      const dtPostedMatch = block.match(/<DTPOSTED>([^<\n]+)/i);
      const trnAmtMatch = block.match(/<TRNAMT>([^<\n]+)/i);
      const fitidMatch = block.match(/<FITID>([^<\n]+)/i);
      const memoMatch = block.match(/<MEMO>([^<\n]+)/i);
      const nameMatch = block.match(/<NAME>([^<\n]+)/i);

      if (dtPostedMatch && trnAmtMatch) {
        const dateStr = dtPostedMatch[1].trim();
        const amount = parseFloat(trnAmtMatch[1].trim().replace(',', '.'));

        // Parse OFX date format (YYYYMMDD or YYYYMMDDHHMMSS)
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const formattedDate = `${year}-${month}-${day}`;

        // Get description from MEMO or NAME
        const description = (memoMatch?.[1] || nameMatch?.[1] || 'Transação OFX').trim();

        transactions.push({
          date: formattedDate,
          description,
          amount: Math.abs(amount),
          type: amount >= 0 ? 'credit' : 'debit',
          bankReference: fitidMatch?.[1]?.trim(),
        });
      }
    }

    // Also try alternative OFX format without closing tags
    if (transactions.length === 0) {
      const altTransactionRegex = /<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|<\/STMTRS>|$)/gi;
      let altMatch;

      while ((altMatch = altTransactionRegex.exec(content)) !== null) {
        const block = altMatch[0];

        const dtPostedMatch = block.match(/<DTPOSTED>([^\n<]+)/i);
        const trnAmtMatch = block.match(/<TRNAMT>([^\n<]+)/i);
        const fitidMatch = block.match(/<FITID>([^\n<]+)/i);
        const memoMatch = block.match(/<MEMO>([^\n<]+)/i);
        const nameMatch = block.match(/<NAME>([^\n<]+)/i);

        if (dtPostedMatch && trnAmtMatch) {
          const dateStr = dtPostedMatch[1].trim();
          const amount = parseFloat(trnAmtMatch[1].trim().replace(',', '.'));

          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          const formattedDate = `${year}-${month}-${day}`;

          const description = (memoMatch?.[1] || nameMatch?.[1] || 'Transação OFX').trim();

          transactions.push({
            date: formattedDate,
            description,
            amount: Math.abs(amount),
            type: amount >= 0 ? 'credit' : 'debit',
            bankReference: fitidMatch?.[1]?.trim(),
          });
        }
      }
    }

  } catch (e: any) {
    errors.push(`Erro ao processar OFX: ${e.message}`);
  }

  return {
    transactions,
    fileType: 'ofx',
    bankName,
    accountNumber,
    errors,
  };
}

// ============= CSV Parser =============

interface CSVColumnMapping {
  dateColumn: number;
  descriptionColumn: number;
  amountColumn: number;
  typeColumn?: number;
  creditColumn?: number;
  debitColumn?: number;
}

// Common bank CSV formats
const bankFormats: Record<string, CSVColumnMapping> = {
  // Generic format: Date, Description, Amount, Type
  generic: { dateColumn: 0, descriptionColumn: 1, amountColumn: 2, typeColumn: 3 },
  // Itaú: Date, Document, Historical, Value, Balance
  itau: { dateColumn: 0, descriptionColumn: 2, amountColumn: 3 },
  // Bradesco: Date, Document, Description, Value, Balance
  bradesco: { dateColumn: 0, descriptionColumn: 2, amountColumn: 3 },
  // Banco do Brasil: Date, Description, Document, Credit, Debit
  bb: { dateColumn: 0, descriptionColumn: 1, amountColumn: 0, creditColumn: 3, debitColumn: 4 },
  // Santander: Date, Description, Value
  santander: { dateColumn: 0, descriptionColumn: 1, amountColumn: 2 },
  // Nubank: Date, Amount, Description
  nubank: { dateColumn: 0, descriptionColumn: 2, amountColumn: 1 },
  // Inter: Date, Description, Value, Balance
  inter: { dateColumn: 0, descriptionColumn: 1, amountColumn: 2 },
};

function detectCSVFormat(headers: string[], firstDataRow: string[]): CSVColumnMapping {
  const headersLower = headers.map(h => h.toLowerCase().trim());

  // Try to auto-detect columns
  let dateColumn = headersLower.findIndex(h => 
    h.includes('data') || h.includes('date') || h === 'dt'
  );
  let descriptionColumn = headersLower.findIndex(h => 
    h.includes('descri') || h.includes('histórico') || h.includes('historico') || 
    h.includes('memo') || h.includes('lancamento') || h.includes('lançamento')
  );
  let amountColumn = headersLower.findIndex(h => 
    h.includes('valor') || h.includes('amount') || h.includes('value') ||
    h.includes('quantia') || h === 'vlr'
  );
  let creditColumn = headersLower.findIndex(h => 
    h.includes('crédit') || h.includes('credit') || h.includes('entrada')
  );
  let debitColumn = headersLower.findIndex(h => 
    h.includes('débit') || h.includes('debit') || h.includes('saída') || h.includes('saida')
  );
  let typeColumn = headersLower.findIndex(h => 
    h.includes('tipo') || h.includes('type') || h === 'c/d'
  );

  // Fallbacks
  if (dateColumn === -1) dateColumn = 0;
  if (descriptionColumn === -1) descriptionColumn = Math.min(1, headers.length - 1);
  if (amountColumn === -1 && creditColumn === -1) amountColumn = Math.min(2, headers.length - 1);

  return {
    dateColumn,
    descriptionColumn,
    amountColumn: amountColumn !== -1 ? amountColumn : 0,
    typeColumn: typeColumn !== -1 ? typeColumn : undefined,
    creditColumn: creditColumn !== -1 ? creditColumn : undefined,
    debitColumn: debitColumn !== -1 ? debitColumn : undefined,
  };
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Common date formats
  const formats = [
    // DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // DD-MM-YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    // DD.MM.YYYY
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
  ];

  for (const format of formats) {
    const match = dateStr.trim().match(format);
    if (match) {
      if (format.source.startsWith('^(\\d{4})')) {
        // YYYY-MM-DD format
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      } else {
        // DD/MM/YYYY or similar
        return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
    }
  }

  // Try native Date parse
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

function parseAmount(value: string): number | null {
  if (!value) return null;

  // Remove currency symbols and spaces
  let cleaned = value.replace(/[R$\s]/g, '').trim();

  // Handle Brazilian format (1.234,56)
  if (cleaned.includes(',')) {
    // Check if it's Brazilian format
    if (cleaned.match(/\.\d{3}/)) {
      // Has thousand separator with dots
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Just decimal comma
      cleaned = cleaned.replace(',', '.');
    }
  }

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : amount;
}

export function parseCSV(content: string, delimiter: string = ','): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  try {
    // Auto-detect delimiter
    const firstLine = content.split('\n')[0];
    if (firstLine.includes(';') && !firstLine.includes(',')) {
      delimiter = ';';
    } else if (firstLine.includes('\t')) {
      delimiter = '\t';
    }

    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      errors.push('Arquivo CSV vazio ou sem dados');
      return { transactions, fileType: 'csv', errors };
    }

    // Parse header and detect format
    const headers = lines[0].split(delimiter).map(h => h.replace(/"/g, '').trim());
    const firstDataRow = lines[1].split(delimiter).map(c => c.replace(/"/g, '').trim());
    const mapping = detectCSVFormat(headers, firstDataRow);

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(delimiter).map(c => c.replace(/"/g, '').trim());
      
      if (columns.length < 2) continue;

      const dateStr = columns[mapping.dateColumn];
      const description = columns[mapping.descriptionColumn] || '';
      
      const date = parseDate(dateStr);
      if (!date) {
        errors.push(`Linha ${i + 1}: Data inválida "${dateStr}"`);
        continue;
      }

      let amount: number | null = null;
      let type: 'credit' | 'debit' = 'credit';

      // Handle separate credit/debit columns
      if (mapping.creditColumn !== undefined && mapping.debitColumn !== undefined) {
        const credit = parseAmount(columns[mapping.creditColumn]);
        const debit = parseAmount(columns[mapping.debitColumn]);

        if (credit && credit > 0) {
          amount = credit;
          type = 'credit';
        } else if (debit && debit !== 0) {
          amount = Math.abs(debit);
          type = 'debit';
        }
      } else {
        // Single amount column
        amount = parseAmount(columns[mapping.amountColumn]);
        
        if (amount !== null) {
          // Check type column or amount sign
          if (mapping.typeColumn !== undefined) {
            const typeValue = columns[mapping.typeColumn]?.toLowerCase();
            type = typeValue?.includes('c') || typeValue?.includes('credit') || typeValue?.includes('entrada')
              ? 'credit' : 'debit';
          } else {
            type = amount >= 0 ? 'credit' : 'debit';
          }
          amount = Math.abs(amount);
        }
      }

      if (amount === null || amount === 0) {
        continue; // Skip zero or invalid amounts
      }

      transactions.push({
        date,
        description,
        amount,
        type,
      });
    }

  } catch (e: any) {
    errors.push(`Erro ao processar CSV: ${e.message}`);
  }

  return {
    transactions,
    fileType: 'csv',
    errors,
  };
}

// ============= Main Parser =============

export function parseBankStatement(content: string, fileName: string): ParseResult {
  const extension = fileName.toLowerCase().split('.').pop();

  if (extension === 'ofx') {
    return parseOFX(content);
  } else {
    return parseCSV(content);
  }
}

// ============= Auto-match Algorithm =============

export interface MatchSuggestion {
  transactionIndex: number;
  recordId: string;
  recordType: 'revenue' | 'expense' | 'accounts_payable' | 'fuel_expense';
  confidence: number;
  reason: string;
}

export interface RecordToMatch {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'revenue' | 'expense' | 'accounts_payable' | 'fuel_expense';
  client?: string;
  supplier?: string;
  isReconciled: boolean;
}

export function findMatches(
  transactions: ParsedTransaction[],
  records: RecordToMatch[]
): MatchSuggestion[] {
  const suggestions: MatchSuggestion[] = [];
  const usedRecords = new Set<string>();

  transactions.forEach((transaction, transactionIndex) => {
    // Only match credits with revenues, debits with expenses
    const matchingRecords = records.filter(r => {
      if (r.isReconciled || usedRecords.has(r.id)) return false;
      
      if (transaction.type === 'credit') {
        return r.type === 'revenue';
      } else {
        return r.type !== 'revenue';
      }
    });

    let bestMatch: { record: RecordToMatch; confidence: number; reason: string } | null = null;

    for (const record of matchingRecords) {
      let confidence = 0;
      const reasons: string[] = [];

      // Amount match (most important)
      const amountDiff = Math.abs(record.amount - transaction.amount);
      const amountPercentDiff = (amountDiff / transaction.amount) * 100;

      if (amountDiff < 0.01) {
        confidence += 50;
        reasons.push('Valor exato');
      } else if (amountPercentDiff < 1) {
        confidence += 40;
        reasons.push('Valor ~99% igual');
      } else if (amountPercentDiff < 5) {
        confidence += 20;
        reasons.push('Valor aproximado');
      } else {
        continue; // Skip if amount is too different
      }

      // Date match
      const recordDate = new Date(record.date);
      const transactionDate = new Date(transaction.date);
      const daysDiff = Math.abs((recordDate.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        confidence += 30;
        reasons.push('Mesma data');
      } else if (daysDiff <= 3) {
        confidence += 20;
        reasons.push('Data próxima (3 dias)');
      } else if (daysDiff <= 7) {
        confidence += 10;
        reasons.push('Data próxima (7 dias)');
      } else if (daysDiff > 30) {
        continue; // Skip if date is too far
      }

      // Description match (bonus)
      const descLower = transaction.description.toLowerCase();
      const recordDescLower = record.description.toLowerCase();
      const clientLower = record.client?.toLowerCase() || '';
      const supplierLower = record.supplier?.toLowerCase() || '';

      if (descLower.includes(clientLower) || clientLower.includes(descLower.substring(0, 10))) {
        confidence += 15;
        reasons.push('Cliente corresponde');
      }
      if (descLower.includes(supplierLower) || supplierLower.includes(descLower.substring(0, 10))) {
        confidence += 15;
        reasons.push('Fornecedor corresponde');
      }
      if (descLower.includes(recordDescLower.substring(0, 10)) || recordDescLower.includes(descLower.substring(0, 10))) {
        confidence += 10;
        reasons.push('Descrição similar');
      }

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { record, confidence, reason: reasons.join(', ') };
      }
    }

    if (bestMatch && bestMatch.confidence >= 60) {
      suggestions.push({
        transactionIndex,
        recordId: bestMatch.record.id,
        recordType: bestMatch.record.type,
        confidence: bestMatch.confidence,
        reason: bestMatch.reason,
      });
      usedRecords.add(bestMatch.record.id);
    }
  });

  return suggestions;
}
