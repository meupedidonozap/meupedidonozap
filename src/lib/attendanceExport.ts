import * as XLSX from '@e965/xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
export type ReportSheet = { name: string; rows: Record<string, string | number>[] };
export function exportAttendanceExcel(sheets: ReportSheet[], stamp: string) {
  const book = XLSX.utils.book_new();
  sheets.forEach(sheet => XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{ Resultado: 'Sem registros' }]), sheet.name));
  XLSX.writeFile(book, `atendimento-dicolore-${stamp}.xlsx`);
}
export function exportAttendancePdf(sheets: ReportSheet[], stamp: string, charts: { title: string; labels: string[]; values: number[] }[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const width = doc.internal.pageSize.getWidth();
  sheets.forEach((sheet, index) => {
    if (index) doc.addPage();
    doc.setFontSize(16); doc.text(`DiColore • ${sheet.name}`, 14, 15);
    doc.setFontSize(10); doc.text(stamp, 14, 22);
    const keys = Object.keys(sheet.rows[0] || { Resultado: '' });
    autoTable(doc, { startY: 28, head: [keys], body: sheet.rows.length ? sheet.rows.map(row => keys.map(key => row[key])) : [['Sem registros']], styles: { fontSize: 7, overflow: 'linebreak' }, margin: { bottom: 16 } });
  });
  charts.forEach(chart => {
    const chunk = 25;
    for (let start = 0; start < chart.labels.length; start += chunk) {
      doc.addPage(); doc.setFontSize(16); doc.text(chart.title, 14, 15); doc.setFontSize(9); doc.text(stamp, 14, 22);
      const max = Math.max(1, ...chart.values);
      chart.labels.slice(start, start + chunk).forEach((label, i) => {
        const value = chart.values[start + i], y = 32 + i * 6;
        doc.text(label.slice(0, 42), 14, y + 3);
        doc.setFillColor('0.27'); doc.rect(95, y, (width - 140) * value / max, 4, 'F');
        doc.text(String(Math.round(value * 10) / 10), width - 35, y + 3);
      });
    }
  });
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) { doc.setPage(p); doc.setFontSize(8); doc.text(`${p}/${pages}`, width - 20, doc.internal.pageSize.getHeight() - 6); }
  doc.save(`atendimento-dicolore-${stamp}.pdf`);
}