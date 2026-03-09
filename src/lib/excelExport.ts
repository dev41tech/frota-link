import ExcelJS from 'exceljs';

/**
 * Utility functions for Excel export using ExcelJS (secure alternative to xlsx)
 */

export async function createWorkbook(): Promise<ExcelJS.Workbook> {
  return new ExcelJS.Workbook();
}

export function addJsonSheet(
  workbook: ExcelJS.Workbook,
  data: Record<string, any>[],
  sheetName: string
): void {
  const worksheet = workbook.addWorksheet(sheetName);
  
  if (data.length === 0) return;
  
  // Add headers
  const headers = Object.keys(data[0]);
  worksheet.addRow(headers);
  
  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Add data rows
  data.forEach(row => {
    worksheet.addRow(Object.values(row));
  });
  
  // Auto-fit columns
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, cell => {
      const cellValue = cell.value?.toString() || '';
      maxLength = Math.max(maxLength, cellValue.length);
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
  });
}

export function addArraySheet(
  workbook: ExcelJS.Workbook,
  data: (string | number | null | undefined)[][],
  sheetName: string
): void {
  const worksheet = workbook.addWorksheet(sheetName);
  
  data.forEach((row, index) => {
    worksheet.addRow(row);
    
    // Style first row as header if it looks like a title
    if (index === 0 && typeof row[0] === 'string' && row[0].length > 0) {
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
    }
  });
  
  // Auto-fit columns
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, cell => {
      const cellValue = cell.value?.toString() || '';
      maxLength = Math.max(maxLength, cellValue.length);
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
  });
}

export async function downloadWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse Excel file to JSON (for imports)
 */
export async function parseExcelFile(file: File): Promise<Record<string, any>[]> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  
  const data: Record<string, any>[] = [];
  const headers: string[] = [];
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // First row is headers
      row.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
      });
    } else {
      // Data rows
      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1] || `Column${colNumber}`;
        rowData[header] = cell.value;
      });
      if (Object.keys(rowData).length > 0) {
        data.push(rowData);
      }
    }
  });
  
  return data;
}
