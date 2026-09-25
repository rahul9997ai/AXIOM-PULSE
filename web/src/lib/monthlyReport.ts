export interface MonthlyReportRow {
  customer_name: string;
  stock_number: string | null;
  fsm_name: string | null;
  delivered_at: string;
}

// jsPDF drags in a heavy dependency chain (html2canvas, dompurify) that
// would otherwise bloat this PWA's precached bundle for a feature only
// salespeople use, occasionally. Loaded on demand instead, so it's a
// separate chunk fetched only when the report button is actually tapped.
async function buildPdf(rows: MonthlyReportRow[], salespersonName: string, monthLabel: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'pt' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Axiom Pulse — Monthly Delivery Report', 40, 44);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${salespersonName} · Deliveries this month · ${monthLabel}`, 40, 64);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 80);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 96,
    head: [['Customer Name', 'Stock #', 'Finance Manager', 'Date of Delivery']],
    body: rows.map((r) => [
      r.customer_name,
      r.stock_number || '—',
      r.fsm_name || '—',
      new Date(r.delivered_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
    ]),
    headStyles: { fillColor: [10, 108, 240] },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 3: { cellWidth: 120 } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? 96;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total delivered this month: ${rows.length}`, 40, finalY + 24);

  return doc;
}

function filenameFor(monthLabel: string): string {
  return `axiom-pulse-deliveries-${monthLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`;
}

export async function downloadMonthlyReport(rows: MonthlyReportRow[], salespersonName: string, monthLabel: string): Promise<void> {
  const doc = await buildPdf(rows, salespersonName, monthLabel);
  doc.save(filenameFor(monthLabel));
}

// Native share sheet (Mail, Gmail, Messages, etc.) with the PDF attached —
// the only cross-platform way to hand a generated file to an email app
// without a backend mail service. Falls back to a plain download when the
// browser doesn't support sharing files (most desktop browsers).
export async function shareMonthlyReport(rows: MonthlyReportRow[], salespersonName: string, monthLabel: string): Promise<'shared' | 'downloaded'> {
  const doc = await buildPdf(rows, salespersonName, monthLabel);
  const filename = filenameFor(monthLabel);
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: 'Axiom Pulse — Monthly Delivery Report',
        text: `Deliveries for ${salespersonName} — ${monthLabel}`,
      });
      return 'shared';
    } catch {
      // User cancelled the share sheet, or it failed — fall through to download.
    }
  }
  doc.save(filename);
  return 'downloaded';
}
