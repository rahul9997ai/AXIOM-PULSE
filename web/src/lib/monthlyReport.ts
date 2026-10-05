export interface MonthlyReportRow {
  id: string;
  customer_name: string;
  stock_number: string | null;
  fsm_name: string | null;
  // The scheduled delivery date, not when it was actually marked
  // delivered — a vehicle scheduled for Sep 30 but only marked delivered
  // on Oct 1 still belongs to, and reports under, September.
  delivery_at: string;
}

export interface HattrickMember {
  id: string;
  customer_name: string;
  stock_number: string | null;
  delivery_at: string;
}

// A hat-trick group is 3+ vehicles sold the same day (sold_at), detected
// automatically — never hand-picked. It only belongs on a report once every
// member has delivered, which can land in a later month than when some (or
// all) of its members were scheduled — so members are carried here in
// full, independent of which month's reportRows they also appear in.
export interface HattrickGroup {
  sold_at: string;
  completed_at: string;
  members: HattrickMember[];
}

export interface HattrickPendingMember {
  customer_name: string;
  stock_number: string | null;
  delivered: boolean;
}

// A hat-trick group that's still short one or more deliveries — shown so
// the salesperson (and accounting) have a printed record of what's still
// in progress, not just what's already been paid out.
export interface HattrickPendingGroup {
  sold_at: string;
  members: HattrickPendingMember[];
}

export interface DealershipDetails {
  name: string;
  address: string;
  city: string;
  phone: string;
  dealerCode: string;
}

const NAVY: [number, number, number] = [30, 58, 138];
const SLATE: [number, number, number] = [51, 65, 85];
const LIGHT_GRAY: [number, number, number] = [238, 241, 244];
const MID_GRAY: [number, number, number] = [204, 210, 217];
const ACCENT: [number, number, number] = NAVY; // one accent color throughout — subtle, not gold
const ACCENT_BG: [number, number, number] = [230, 238, 252]; // soft pale blue tint
const MUTED: [number, number, number] = [107, 114, 128];
const DARK: [number, number, number] = [26, 26, 26];

// $150 per completed hat-trick group, and a stepped (not per-car) volume
// bonus on total vehicles delivered in the month — highest threshold met
// wins, no bonus below 10.
const HATTRICK_BONUS_CENTS = 15000;
const VOLUME_BONUS_TIERS: { count: number; cents: number }[] = [
  { count: 25, cents: 200000 },
  { count: 20, cents: 150000 },
  { count: 15, cents: 100000 },
  { count: 10, cents: 50000 },
];

function volumeBonusFor(deliveredCount: number): { tierCount: number; cents: number } | null {
  for (const tier of VOLUME_BONUS_TIERS) {
    if (deliveredCount >= tier.count) return { tierCount: tier.count, cents: tier.cents };
  }
  return null;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Parses a plain YYYY-MM-DD (no time component, e.g. a `date` column) as a
// local calendar date — new Date("2026-09-28") parses as UTC midnight,
// which can display as the previous day in western-hemisphere timezones.
function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Shared by both the hat-trick and pending-hat-trick boxes (and by the
// one-page size budget below, which needs these heights before anything
// is drawn).
function groupsBoxHeight(groupCount: number, totalMemberLines: number): number {
  if (groupCount === 0) return 0;
  const lineH = 13;
  const groupHeaderH = 20;
  const groupGap = 8;
  return 16 + groupCount * groupHeaderH + totalMemberLines * lineH + (groupCount - 1) * groupGap;
}

// jsPDF drags in a heavy dependency chain (html2canvas, dompurify) that
// would otherwise bloat this PWA's precached bundle for a feature only
// salespeople use, occasionally. Loaded on demand instead, so it's a
// separate chunk fetched only when the report button is actually tapped.
async function buildPdf(
  rows: MonthlyReportRow[],
  salespersonName: string,
  monthLabel: string,
  dealership: DealershipDetails,
  hattrickGroups: HattrickGroup[],
  pendingHattricks: HattrickPendingGroup[],
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  const bonusRowIds = new Set(hattrickGroups.flatMap((g) => g.members.map((m) => m.id)));

  // ---- header band ----
  const headerH = 92;
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(0, 0, pageW, headerH, 'F');
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...DARK);
  doc.text('AXIOM', margin, 36);
  const axiomW = doc.getTextWidth('AXIOM ');
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...NAVY);
  doc.text('Pulse', margin + axiomW, 36);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text('The Pulse of Every Delivery.', margin, 52);

  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  doc.text('by Rahul Champaneri', margin, 68);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text('M O N T H L Y   D E L I V E R Y   R E P O R T', pageW - margin, 36, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(monthLabel.toUpperCase(), pageW - margin, 52, { align: 'right' });

  let y = headerH + 26;

  // ---- stat tiles ----
  const tileGap = 10;
  const tileW = (contentW - tileGap * 2) / 3;
  const tileH = 54;
  const tiles: [string, string][] = [['MONTH', monthLabel], ['TOTAL DELIVERED', String(rows.length)], ['SALESPERSON', salespersonName]];
  tiles.forEach(([label, value], i) => {
    const tx = margin + i * (tileW + tileGap);
    doc.setFillColor(255, 255, 255);
    doc.rect(tx, y, tileW, tileH, 'F');
    doc.setDrawColor(...MID_GRAY);
    doc.setLineWidth(0.8);
    doc.rect(tx, y, tileW, tileH, 'S');
    doc.setFillColor(...NAVY);
    doc.rect(tx, y, 2.5, tileH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label, tx + tileW / 2, y + 18, { align: 'center' });
    doc.setFontSize(15);
    doc.setTextColor(...NAVY);
    doc.text(value, tx + tileW / 2, y + 40, { align: 'center' });
  });

  y += tileH + 18;

  // ---- salesperson bar ----
  const barH = 24;
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, contentW, barH, 'F');
  doc.setDrawColor(...MID_GRAY);
  doc.rect(margin, y, contentW, barH, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(`SALESPERSON: ${salespersonName.toUpperCase()}`, margin + 10, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text('FOR ACCOUNTING REVIEW', pageW - margin - 10, y + 16, { align: 'right' });

  y += barH + 16;

  // ---- table (row height/font adapt to fit everything on one page) ----
  const cols: { label: string; w: number }[] = [
    { label: 'Customer Name', w: contentW * 0.32 },
    { label: 'Stock #', w: contentW * 0.13 },
    { label: 'Finance Manager', w: contentW * 0.26 },
    { label: 'Date of Delivery', w: contentW * 0.17 },
    { label: 'Bonus', w: contentW * 0.12 },
  ];
  const headH = 22;

  // Gaps between sections below the table — kept as named constants so the
  // size estimate (afterTableH, used to pick the row height) and the actual
  // drawing never drift apart.
  const GAP_TABLE_TO_TOTAL = 14;
  const GAP_AFTER_DELIVERED = 14;
  const BANNER_H = 78;
  const BANNER_GAP = 14;
  const HATTRICK_GAP = 18;
  const PENDING_GAP = 18;
  const AUTH_BLOCK_H = 81; // title + signature lines, see the drawing below

  const volume = volumeBonusFor(rows.length);
  const hattrickTotalCents = hattrickGroups.length * HATTRICK_BONUS_CENTS;
  const totalBonusCents = (volume?.cents ?? 0) + hattrickTotalCents;

  // Each group's members print as one wrapped line (not one line per
  // member) to save vertical space — computed once here so the box-height
  // estimate and the actual drawing use the exact same wrapped lines.
  const maxLineWidth = contentW - 48;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const hattrickLineSets = hattrickGroups.map((g) => {
    const text = g.members.map((m) => {
      const d = new Date(m.delivery_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `${m.customer_name}${m.stock_number ? ` #${m.stock_number}` : ''} · ${d}`;
    }).join('   ·   ');
    return doc.splitTextToSize(text, maxLineWidth) as string[];
  });
  const pendingLineSets = pendingHattricks.map((g) => {
    const text = g.members.map((m) => `${m.customer_name}${m.stock_number ? ` #${m.stock_number}` : ''} · ${m.delivered ? 'delivered' : 'pending'}`).join('   ·   ');
    return doc.splitTextToSize(text, maxLineWidth) as string[];
  });

  const hattrickBoxH = groupsBoxHeight(hattrickGroups.length, hattrickLineSets.reduce((n, lines) => n + lines.length, 0));
  const pendingBoxH = groupsBoxHeight(pendingHattricks.length, pendingLineSets.reduce((n, lines) => n + lines.length, 0));

  // Everything that comes after the table, at its fixed (non-shrinking)
  // size — known before a single row is drawn, since none of it depends on
  // how tall the table rows end up being.
  const afterTableH =
    GAP_TABLE_TO_TOTAL
    + GAP_AFTER_DELIVERED
    + (totalBonusCents > 0 ? BANNER_H + BANNER_GAP : 6)
    + (hattrickGroups.length > 0 ? hattrickBoxH + HATTRICK_GAP : 4)
    + (pendingHattricks.length > 0 ? pendingBoxH + PENDING_GAP : 0)
    + AUTH_BLOCK_H;

  const FOOTER_RESERVE = 48;
  const DEFAULT_ROW_H = 20;
  const MIN_ROW_H = 8;
  const DEFAULT_FONT = 9.5;
  const MIN_FONT = 5.5;
  const usableBottom = pageH - FOOTER_RESERVE;
  const availableForTable = usableBottom - y - headH - afterTableH;
  const idealRowH = rows.length > 0 ? availableForTable / rows.length : DEFAULT_ROW_H;
  const rowH = Math.min(DEFAULT_ROW_H, Math.max(MIN_ROW_H, idealRowH));
  const rowFont = Math.max(MIN_FONT, DEFAULT_FONT * (rowH / DEFAULT_ROW_H));
  const rowTextOffset = Math.max(rowH - 6, rowH * 0.65);

  doc.setFillColor(...SLATE);
  doc.rect(margin, y, contentW, headH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  let cx = margin + 8;
  cols.forEach((col) => { doc.text(col.label.toUpperCase(), cx, y + 15); cx += col.w; });

  let ry = y + headH;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(rowFont);
  rows.forEach((r, i) => {
    const isBonus = bonusRowIds.has(r.id);
    if (isBonus) {
      doc.setFillColor(...ACCENT_BG);
      doc.rect(margin, ry, contentW, rowH, 'F');
    } else if (i % 2 === 1) {
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, ry, contentW, rowH, 'F');
    }
    doc.setTextColor(...DARK);
    let cellX = margin + 8;
    const values = [
      r.customer_name,
      r.stock_number || '—',
      r.fsm_name || '—',
      new Date(r.delivery_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    ];
    values.forEach((v, idx) => { doc.text(v, cellX, ry + rowTextOffset); cellX += cols[idx].w; });
    if (isBonus) {
      // A unicode star glyph isn't in Helvetica's base encoding and
      // silently renders as the wrong character — a drawn dot avoids
      // the font gotcha entirely, and "BONUS" alone (vs. "HAT-TRICK")
      // comfortably fits this narrow column without running off the page.
      doc.setFillColor(...ACCENT);
      doc.circle(cellX + 3, ry + rowH / 2, Math.min(2.5, rowH / 4), 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(Math.max(MIN_FONT, 7.5 * (rowH / DEFAULT_ROW_H)));
      doc.setTextColor(...ACCENT);
      doc.text('BONUS', cellX + 9, ry + rowTextOffset);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(rowFont);
    }
    ry += rowH;
  });
  doc.setDrawColor(...MID_GRAY);
  doc.setLineWidth(0.6);
  doc.line(margin, ry, margin + contentW, ry);

  y = ry + GAP_TABLE_TO_TOTAL;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(`TOTAL DELIVERED: ${rows.length}`, margin, y);

  y += GAP_AFTER_DELIVERED;

  // ---- bonus banner ----
  // A light fill with a crisp double navy border reads as a certificate,
  // not a solid ink block — much cheaper (and better-looking) to print
  // than a filled band.
  if (totalBonusCents > 0) {
    const BANNER_BG: [number, number, number] = [247, 250, 255];

    doc.setFillColor(...BANNER_BG);
    doc.rect(margin, y, contentW, BANNER_H, 'F');
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(1.3);
    doc.rect(margin, y, contentW, BANNER_H, 'S');
    doc.setLineWidth(0.5);
    doc.rect(margin + 5, y + 5, contentW - 10, BANNER_H - 10, 'S');

    const labelText = 'TOTAL BONUS EARNED THIS MONTH';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const labelW = doc.getTextWidth(labelText);
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.8);
    doc.line(pageW / 2 - labelW / 2 - 40, y + 22, pageW / 2 - labelW / 2 - 14, y + 22);
    doc.line(pageW / 2 + labelW / 2 + 14, y + 22, pageW / 2 + labelW / 2 + 40, y + 22);
    doc.setTextColor(...ACCENT);
    doc.text(labelText, pageW / 2, y + 25, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(...NAVY);
    doc.text(formatCents(totalBonusCents), pageW / 2, y + 50, { align: 'center' });

    const parts: string[] = [];
    if (volume) parts.push(`Volume ${formatCents(volume.cents)}`);
    if (hattrickGroups.length > 0) parts.push(`Hat-Trick ${formatCents(hattrickTotalCents)} (${hattrickGroups.length}×)`);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...SLATE);
    doc.text(parts.join('   ·   '), pageW / 2, y + 70, { align: 'center' });

    y += BANNER_H + BANNER_GAP;
  } else {
    y += 6;
  }

  // ---- hat-trick bonus summary ----
  // Each group lists every one of its members, even ones scheduled or
  // delivered in an earlier month — the group only appears here, on the
  // report for the month its LAST member was delivered, which is when the
  // bonus actually becomes payable.
  if (hattrickGroups.length > 0) {
    const lineH = 13;
    const groupHeaderH = 20;
    const groupGap = 8;

    doc.setFillColor(...ACCENT_BG);
    doc.rect(margin, y, contentW, hattrickBoxH, 'F');
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.8);
    doc.rect(margin, y, contentW, hattrickBoxH, 'S');

    let gy = y + 16;
    hattrickGroups.forEach((group, gi) => {
      doc.setFillColor(...ACCENT);
      doc.circle(margin + 15, gy, 3.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...ACCENT);
      const soldLabel = parseDateOnly(group.sold_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      doc.text(`HAT-TRICK BONUS — SOLD ${soldLabel.toUpperCase()} · ${group.members.length} VEHICLES`, margin + 24, gy + 4);
      gy += groupHeaderH;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      hattrickLineSets[gi].forEach((line) => {
        doc.text(line, margin + 24, gy + 3);
        gy += lineH;
      });
      if (gi < hattrickGroups.length - 1) gy += groupGap;
    });

    y += hattrickBoxH + HATTRICK_GAP;
  } else {
    y += 4;
  }

  // ---- pending hat-tricks ----
  // Not yet payable — printed as a status snapshot so a group that's still
  // waiting on a delivery doesn't get forgotten between reports.
  if (pendingHattricks.length > 0) {
    const lineH = 13;
    const groupHeaderH = 20;
    const groupGap = 8;

    doc.setFillColor(...LIGHT_GRAY);
    doc.rect(margin, y, contentW, pendingBoxH, 'F');
    doc.setDrawColor(...MID_GRAY);
    doc.setLineWidth(0.8);
    doc.rect(margin, y, contentW, pendingBoxH, 'S');

    let py = y + 16;
    pendingHattricks.forEach((group, gi) => {
      const deliveredCount = group.members.filter((m) => m.delivered).length;
      doc.setFillColor(...MUTED);
      doc.circle(margin + 15, py, 3.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...SLATE);
      const soldLabel = parseDateOnly(group.sold_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      doc.text(`PENDING HAT-TRICK — SOLD ${soldLabel.toUpperCase()} · ${deliveredCount}/${group.members.length} DELIVERED`, margin + 24, py + 4);
      py += groupHeaderH;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      pendingLineSets[gi].forEach((line) => {
        doc.text(line, margin + 24, py + 3);
        py += lineH;
      });
      if (gi < pendingHattricks.length - 1) py += groupGap;
    });

    y += pendingBoxH + PENDING_GAP;
  }

  // ---- authorization signatures ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text('AUTHORIZATION', margin, y);
  y += 26;

  const colW = (contentW - 24) / 2;
  const lineY = y + 24;
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.8);
  doc.line(margin, lineY, margin + colW - 20, lineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`${salespersonName} · Salesperson`, margin, lineY + 11);
  doc.text('Date: _______________', margin, lineY + 21);

  const x2 = margin + colW + 24;
  doc.line(x2, lineY, x2 + colW - 20, lineY);
  doc.text('Sales Manager (sign in person)', x2, lineY + 11);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.text('Signature authorizes this report for accounting', x2, lineY + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Date: _______________', x2, lineY + 31);

  // ---- footer ----
  const footerY = pageH - 34;
  doc.setDrawColor(...MID_GRAY);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 10, pageW - margin, footerY - 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const footerText = `${dealership.name} · ${dealership.address}, ${dealership.city} · ${dealership.phone} · Dealer Code ${dealership.dealerCode}`;
  doc.text(footerText, pageW / 2, footerY, { align: 'center' });
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, footerY + 14);
  doc.text('Page 1', pageW - margin, footerY + 14, { align: 'right' });

  return doc;
}

function filenameFor(monthLabel: string): string {
  return `axiom-pulse-deliveries-${monthLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`;
}

export async function downloadMonthlyReport(
  rows: MonthlyReportRow[],
  salespersonName: string,
  monthLabel: string,
  dealership: DealershipDetails,
  hattrickGroups: HattrickGroup[] = [],
  pendingHattricks: HattrickPendingGroup[] = [],
): Promise<void> {
  const doc = await buildPdf(rows, salespersonName, monthLabel, dealership, hattrickGroups, pendingHattricks);
  doc.save(filenameFor(monthLabel));
}

// Native share sheet (Mail, Gmail, Messages, etc.) with the PDF attached —
// the only cross-platform way to hand a generated file to an email app
// without a backend mail service. Falls back to a plain download when the
// browser doesn't support sharing files (most desktop browsers).
export async function shareMonthlyReport(
  rows: MonthlyReportRow[],
  salespersonName: string,
  monthLabel: string,
  dealership: DealershipDetails,
  hattrickGroups: HattrickGroup[] = [],
  pendingHattricks: HattrickPendingGroup[] = [],
): Promise<'shared' | 'downloaded'> {
  const doc = await buildPdf(rows, salespersonName, monthLabel, dealership, hattrickGroups, pendingHattricks);
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
