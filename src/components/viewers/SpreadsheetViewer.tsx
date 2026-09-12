import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import DOMPurify from 'dompurify';

interface SpreadsheetViewerProps {
  src: string;
  filename: string;
  viewOnly?: boolean;
}

export default function SpreadsheetViewer({ src, filename, viewOnly }: SpreadsheetViewerProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [sheets, setSheets] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const loadSpreadsheet = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        
        if (!isMounted) return;
        
        setWorkbook(wb);
        setSheets(wb.SheetNames);
        
        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setActiveSheet(firstSheet);
          renderSheet(wb, firstSheet);
        } else {
          setError('Spreadsheet is empty.');
        }
      } catch (err) {
        console.error('Spreadsheet parse error:', err);
        if (isMounted) setError('Failed to parse spreadsheet file.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    loadSpreadsheet();
    
    return () => { isMounted = false; };
  }, [src]);

  const renderSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    // Convert to HTML
    const rawHtml = XLSX.utils.sheet_to_html(ws, { id: 'phantom-spreadsheet' });
    // Sanitize to prevent XSS
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    setHtml(cleanHtml);
  };

  const handleSheetChange = (sheetName: string) => {
    setActiveSheet(sheetName);
    if (workbook) renderSheet(workbook, sheetName);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--phantom-muted)]">
        <div className="w-[34px] h-[34px] rounded-full border-2 border-[var(--phantom-border)] border-t-[var(--phantom-glow)] animate-spin"></div>
        <p className="text-sm">Parsing spreadsheet...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--phantom-danger)] bg-[var(--phantom-danger)]/5 p-8 rounded-xl m-8 border border-[var(--phantom-danger)]/20">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="font-medium text-lg">{error}</p>
        <p className="text-sm opacity-80">This file might be corrupted or unsupported.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {sheets.length > 1 && (
        <div className="flex gap-1 overflow-x-auto p-2 bg-[#f3f4f6] border-b border-gray-200">
          {sheets.map(sheet => (
            <button
              key={sheet}
              onClick={() => handleSheetChange(sheet)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeSheet === sheet 
                  ? 'border-[#107c41] text-[#107c41] bg-white shadow-sm' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {sheet}
            </button>
          ))}
        </div>
      )}
      
      <div className="flex-1 overflow-auto p-4 bg-white phantom-spreadsheet-wrapper">
        <style dangerouslySetInnerHTML={{__html: `
          .phantom-spreadsheet-wrapper table {
            border-collapse: collapse;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px;
            color: #333;
            min-width: 100%;
          }
          .phantom-spreadsheet-wrapper th, .phantom-spreadsheet-wrapper td {
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
            white-space: nowrap;
          }
          .phantom-spreadsheet-wrapper th {
            background-color: #f8fafc;
            font-weight: 600;
            text-align: center;
          }
          .phantom-spreadsheet-wrapper td {
            background-color: #fff;
          }
        `}} />
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      
      {viewOnly && (
        <div className="bg-[var(--phantom-danger)]/10 border-t border-[var(--phantom-danger)]/20 p-2 text-center text-[var(--phantom-danger)] text-xs font-medium">
          Burn After Reading mode is active.
        </div>
      )}
    </div>
  );
}
