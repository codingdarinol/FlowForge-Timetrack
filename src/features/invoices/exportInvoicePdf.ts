import type { jsPDF } from 'jspdf';
import type { AppSettings, Client, InvoiceWithDetails } from '../../types';
import { formatCurrency, formatDate as formatAppDate, formatNumber } from '../../lib/formatters';
import { invoiceLogger } from '../../lib/logger';

interface ExportInvoicePdfOptions {
  invoice: InvoiceWithDetails;
  clients: Client[];
  settings: AppSettings | null;
}

type PdfColor = [number, number, number];

const TEAL: PdfColor = [13, 148, 136];
const GRAY_TEXT: PdfColor = [107, 114, 128];
const GRAY_BG: PdfColor = [243, 244, 246];
const ROW_BG: PdfColor = [249, 250, 251];
const BORDER: PdfColor = [209, 213, 219];
const BLACK: PdfColor = [17, 24, 39];
const WHITE: PdfColor = [255, 255, 255];
const GREEN: PdfColor = [22, 163, 74];
const BLUE: PdfColor = [37, 99, 235];

function safeFormatDate(value: string): string {
  try {
    return formatAppDate(value);
  } catch {
    return '';
  }
}

function splitLongTextChunk(doc: jsPDF, value: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [value];

  const chunks: string[] = [];
  let current = '';

  Array.from(value).forEach((character) => {
    const next = current + character;
    if (current && doc.getTextWidth(next) > maxWidth) {
      chunks.push(current);
      current = character;
      return;
    }

    current = next;
  });

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function wrapText(doc: jsPDF, value: string | null | undefined, maxWidth: number): string[] {
  if (!value) return [];

  return value
    .split('\n')
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [''];

      const wrappedLines = doc.splitTextToSize(trimmed, maxWidth) as string[];
      return wrappedLines.flatMap((wrappedLine) =>
        doc.getTextWidth(wrappedLine) > maxWidth
          ? splitLongTextChunk(doc, wrappedLine, maxWidth)
          : [wrappedLine],
      );
    })
    .filter((line, index, lines) => line || (index > 0 && lines[index - 1] !== ''));
}

function collectBusinessDetailLines(settings: AppSettings | null): string[] {
  if (!settings) return [];

  const lines: string[] = [];

  if (settings.businessTagline) {
    lines.push(settings.businessTagline);
  }

  const primaryContact = [
    settings.businessWebsite,
    settings.businessEmail,
    settings.businessPhone,
  ].filter(Boolean);
  if (primaryContact.length > 0) {
    lines.push(primaryContact.join(' | '));
  }

  if (settings.businessAddress) {
    lines.push(...settings.businessAddress.split('\n'));
  }

  if (settings.businessVatNumber) {
    lines.push(`NPWP: ${settings.businessVatNumber}`);
  }

  return lines.filter(Boolean);
}

function collectClientDetailLines(invoice: InvoiceWithDetails): string[] {
  const lines: string[] = [];

  if (invoice.clientAddress) {
    lines.push(...invoice.clientAddress.split('\n'));
  }

  const primaryContact = [invoice.clientEmail, invoice.clientPhone].filter(Boolean);
  if (primaryContact.length > 0) {
    lines.push(primaryContact.join(' | '));
  }

  if (invoice.clientVatNumber) {
    lines.push(`NPWP: ${invoice.clientVatNumber}`);
  }

  return lines.filter(Boolean);
}

export async function exportInvoicePdf({
  invoice,
  clients,
  settings,
}: ExportInvoicePdfOptions): Promise<string | null> {
  invoiceLogger.info('Exporting invoice to PDF', { invoiceNumber: invoice.invoiceNumber });

  const { jsPDF: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ compress: true, putOnlyUsedFonts: true });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const topMargin = 14;
  const footerY = pageHeight - 14;
  const contentBottom = footerY - 4;
  const contentWidth = pageWidth - marginX * 2;
  let y = topMargin;

  const invoiceCurrency = clients.find((client) => client.id === invoice.clientId)?.currency || 'IDR';
  const formatInvoiceMoney = (amount: number) => formatCurrency(amount, invoiceCurrency);

  const ensureSpace = (requiredSpace: number): boolean => {
    if (y + requiredSpace <= contentBottom) {
      return false;
    }

    doc.addPage();
    y = topMargin;
    return true;
  };

  const displayIssueDate = safeFormatDate(invoice.issueDate);
  let displayDueDate = safeFormatDate(invoice.dueDate);
  if (!displayDueDate && invoice.issueDate) {
    const issueDate = new Date(invoice.issueDate);
    const dueDate = new Date(issueDate);
    dueDate.setDate(issueDate.getDate() + 30);
    displayDueDate = safeFormatDate(dueDate.toISOString());
  }

  const headerLeftWidth = contentWidth * 0.58;
  let headerLeftBottom = y;
  let headerTextX = marginX;
  let headerTextWidth = headerLeftWidth;

  if (settings?.businessLogo) {
    try {
      doc.addImage(settings.businessLogo, 'PNG', marginX, y, 26, 16);
      headerTextX += 30;
      headerTextWidth -= 30;
      headerLeftBottom = y + 16;
    } catch (error) {
      invoiceLogger.warn('Failed to add logo to PDF', { error });
    }
  }

  let brandY = y + 4;
  if (settings?.businessName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...BLACK);
    const businessNameLines = wrapText(doc, settings.businessName, headerTextWidth);
    doc.text(businessNameLines, headerTextX, brandY);
    brandY += businessNameLines.length * 4.4 + 1;
    headerLeftBottom = Math.max(headerLeftBottom, brandY);
  }

  const businessDetailLines = collectBusinessDetailLines(settings);
  if (businessDetailLines.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_TEXT);

    businessDetailLines.forEach((line) => {
      const wrapped = wrapText(doc, line, headerTextWidth);
      if (wrapped.length === 0) {
        brandY += 2;
        return;
      }

      doc.text(wrapped, headerTextX, brandY);
      brandY += wrapped.length * 3.4 + 1;
    });

    headerLeftBottom = Math.max(headerLeftBottom, brandY);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...TEAL);
  doc.text('INVOICE', pageWidth - marginX, y + 4, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_TEXT);
  doc.text(`#${invoice.invoiceNumber}`, pageWidth - marginX, y + 10, { align: 'right' });
  if (displayIssueDate) {
    doc.setFontSize(8);
    doc.text(`Tanggal: ${displayIssueDate}`, pageWidth - marginX, y + 15, { align: 'right' });
  }

  const headerBottom = Math.max(headerLeftBottom, y + (displayIssueDate ? 15 : 10)) + 4;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.5);
  doc.line(marginX, headerBottom, pageWidth - marginX, headerBottom);
  y = headerBottom + 6;

  const billWidth = contentWidth * 0.58;
  const metaGap = 8;
  const metaWidth = contentWidth - billWidth - metaGap;
  const metaX = marginX + billWidth + metaGap;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEAL);
  doc.text('TAGIH KE', marginX, y);

  let billY = y + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  const clientNameLines = wrapText(doc, invoice.clientName, billWidth - 4);
  doc.text(clientNameLines, marginX, billY);
  billY += clientNameLines.length * 4.1 + 1;

  const clientDetailLines = collectClientDetailLines(invoice);
  if (clientDetailLines.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(...GRAY_TEXT);

    clientDetailLines.forEach((line) => {
      const wrapped = wrapText(doc, line, billWidth - 4);
      if (wrapped.length === 0) {
        billY += 2;
        return;
      }

      doc.text(wrapped, marginX, billY);
      billY += wrapped.length * 3.4 + 1;
    });
  }

  const metaRows = [['Jatuh tempo', displayDueDate]];
  const metaBoxHeight = 6 + metaRows.length * 5.2;

  doc.setDrawColor(...BORDER);
  doc.setFillColor(...GRAY_BG);
  doc.roundedRect(metaX, y - 3, metaWidth, metaBoxHeight, 2, 2, 'FD');

  let metaY = y + 1;
  metaRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...GRAY_TEXT);
    doc.text(label, metaX + 4, metaY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...BLACK);
    doc.text(value || '-', metaX + metaWidth - 4, metaY, { align: 'right' });

    metaY += 5.2;
  });

  y = Math.max(billY, y - 3 + metaBoxHeight) + 7;

  const noX = marginX + 4;
  const amountX = pageWidth - marginX;
  const discountX = amountX - 30;
  const priceX = discountX - 32;
  const qtyX = priceX - 18;
  const descX = marginX + 17;
  const descWidth = qtyX - descX - 6;

  const drawTableHeader = () => {
    doc.setFillColor(...TEAL);
    doc.roundedRect(marginX, y - 4, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...WHITE);
    doc.text('NO', noX, y);
    doc.text('DESKRIPSI', descX, y);
    doc.text('QTY', qtyX, y, { align: 'right' });
    doc.text('HARGA', priceX, y, { align: 'right' });
    doc.text('DISKON', discountX, y, { align: 'right' });
    doc.text('JUMLAH', amountX, y, { align: 'right' });
    doc.setTextColor(...BLACK);
    y += 7;
  };

  ensureSpace(14);
  drawTableHeader();

  invoice.lineItems.forEach((item, index) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);

    const descLines = wrapText(doc, item.description, descWidth);
    const printableDescLines = descLines.length > 0 ? descLines : ['-'];
    const discountAmount = item.discount || 0;
    const lineTotal = Math.max(0, item.quantity * item.unitPrice - discountAmount);
    const rowHeight = Math.max(printableDescLines.length * 3.4 + 2, 6.8);

    if (ensureSpace(rowHeight + 3)) {
      drawTableHeader();
    }

    if (index % 2 === 0) {
      doc.setFillColor(...ROW_BG);
      doc.rect(marginX, y - 3.2, contentWidth, rowHeight, 'F');
    }

    doc.setTextColor(...BLACK);
    doc.text(String(index + 1), noX, y);
    doc.text(printableDescLines, descX, y);
    doc.text(formatNumber(item.quantity, 2), qtyX, y, { align: 'right' });
    doc.text(formatInvoiceMoney(item.unitPrice), priceX, y, { align: 'right' });
    doc.text(
      discountAmount > 0 ? `-${formatInvoiceMoney(discountAmount)}` : formatInvoiceMoney(0),
      discountX,
      y,
      { align: 'right' },
    );
    doc.text(formatInvoiceMoney(lineTotal), amountX, y, { align: 'right' });

    y += rowHeight;
  });

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(marginX, y + 0.5, pageWidth - marginX, y + 0.5);
  y += 6;

  const totalsRows: Array<{ label: string; value: string; valueColor: PdfColor }> = [
    { label: 'Subtotal', value: formatInvoiceMoney(invoice.subtotal), valueColor: BLACK },
    {
      label: `PPN (${formatNumber(invoice.taxRate * 100, 1)}%)`,
      value: formatInvoiceMoney(invoice.taxAmount),
      valueColor: BLACK,
    },
  ];

  if (invoice.downPayment > 0) {
    totalsRows.push({
      label: 'Uang Muka',
      value: `-${formatInvoiceMoney(invoice.downPayment)}`,
      valueColor: GREEN,
    });
  }

  const totalsWidth = 74;
  const totalsX = pageWidth - marginX - totalsWidth;
  const totalRowHeight = 7;
  const totalsBoxHeight = 8 + totalsRows.length * 5 + totalRowHeight;

  ensureSpace(totalsBoxHeight + 4);

  doc.setDrawColor(...BORDER);
  doc.roundedRect(totalsX, y, totalsWidth, totalsBoxHeight, 2, 2, 'S');

  let totalsY = y + 5;
  totalsRows.forEach((row) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_TEXT);
    doc.text(row.label, totalsX + 4, totalsY);

    doc.setTextColor(...row.valueColor);
    doc.text(row.value, totalsX + totalsWidth - 4, totalsY, { align: 'right' });
    totalsY += 5;
  });

  doc.setDrawColor(...BORDER);
  doc.line(totalsX + 4, totalsY - 1.8, totalsX + totalsWidth - 4, totalsY - 1.8);
  doc.setFillColor(...TEAL);
  doc.roundedRect(totalsX + 2, totalsY, totalsWidth - 4, totalRowHeight, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...WHITE);
  doc.text(invoice.downPayment > 0 ? 'Sisa Tagihan' : 'Total Tagihan', totalsX + 4, totalsY + 4.5);
  doc.text(formatInvoiceMoney(invoice.total), totalsX + totalsWidth - 4, totalsY + 4.5, {
    align: 'right',
  });
  y += totalsBoxHeight + 8;

  if (invoice.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    const noteLines = wrapText(doc, invoice.notes, contentWidth);
    ensureSpace(noteLines.length * 3.5 + 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEAL);
    doc.text('CATATAN', marginX, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    doc.setTextColor(...BLACK);
    doc.text(noteLines, marginX, y);
    y += noteLines.length * 3.5 + 4;
  }

  const hasPaymentSection = Boolean(
    settings?.paymentTerms ||
      settings?.paymentBankDetails ||
      settings?.paymentLink ||
      settings?.paymentLink2 ||
      settings?.paymentQrCode,
  );

  if (hasPaymentSection) {
    const boxPadding = 6;
    const qrSize = settings?.paymentQrCode ? 30 : 0;
    const textStartX = marginX + boxPadding + (qrSize ? qrSize + 6 : 0);
    const textWidth = contentWidth - boxPadding * 2 - (qrSize ? qrSize + 6 : 0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    const paymentBlocks = [
      settings?.paymentTerms
        ? {
            title: 'Syarat Pembayaran',
            lines: wrapText(doc, settings.paymentTerms, textWidth),
            color: BLACK,
          }
        : null,
      settings?.paymentBankDetails
        ? {
            title: 'Transfer Bank',
            lines: wrapText(doc, settings.paymentBankDetails, textWidth),
            color: BLACK,
          }
        : null,
      settings?.paymentLink
        ? {
            title: settings.paymentLinkTitle || 'Tautan Pembayaran 1',
            lines: wrapText(doc, settings.paymentLink, textWidth),
            color: BLUE,
          }
        : null,
      settings?.paymentLink2
        ? {
            title: settings.paymentLink2Title || 'Tautan Pembayaran 2',
            lines: wrapText(doc, settings.paymentLink2, textWidth),
            color: BLUE,
          }
        : null,
      {
        title: 'Referensi',
        lines: [invoice.invoiceNumber],
        color: GRAY_TEXT,
      },
    ].filter(Boolean) as Array<{ title: string; lines: string[]; color: PdfColor }>;

    let paymentBoxHeight = boxPadding * 2 + 5;
    paymentBlocks.forEach((block) => {
      paymentBoxHeight += 4;
      paymentBoxHeight += Math.max(block.lines.length, 1) * 3.4 + 2;
    });
    paymentBoxHeight = Math.max(paymentBoxHeight, boxPadding * 2 + (qrSize ? qrSize + 4 : 0));

    ensureSpace(paymentBoxHeight + 4);

    doc.setDrawColor(...BORDER);
    doc.roundedRect(marginX, y, contentWidth, paymentBoxHeight, 2, 2, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEAL);
    doc.text('PEMBAYARAN', marginX + boxPadding, y + boxPadding + 1.5);

    if (settings?.paymentQrCode) {
      try {
        doc.addImage(settings.paymentQrCode, 'PNG', marginX + boxPadding, y + boxPadding + 5, qrSize, qrSize);
      } catch (error) {
        invoiceLogger.warn('Failed to add QR code to PDF', { error });
      }
    }

    let paymentY = y + boxPadding + 7;
    paymentBlocks.forEach((block) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.3);
      doc.setTextColor(...BLACK);
      doc.text(block.title, textStartX, paymentY);
      paymentY += 3.8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...block.color);
      doc.text(block.lines, textStartX, paymentY);
      paymentY += Math.max(block.lines.length, 1) * 3.4 + 2;
    });

    y += paymentBoxHeight + 8;
  }

  const totalPages = doc.getNumberOfPages();
  const footerParts: string[] = [];
  if (settings?.businessName) footerParts.push(settings.businessName);
  if (settings?.businessWebsite) footerParts.push(settings.businessWebsite);
  if (!settings?.businessWebsite && settings?.businessEmail) footerParts.push(settings.businessEmail);
  const footerText = footerParts.join(' | ') || 'Dibuat dengan yuk-kerja';

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.25);
    doc.line(marginX, footerY, pageWidth - marginX, footerY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY_TEXT);
    doc.text(footerText, marginX, footerY + 4.5);

    if (totalPages > 1) {
      doc.text(`Halaman ${page} / ${totalPages}`, pageWidth - marginX, footerY + 4.5, {
        align: 'right',
      });
    }
  }

  const pdfOutput = doc.output('arraybuffer');
  const isTauri = '__TAURI__' in window || '__TAURI_INTERNALS__' in window;

  if (isTauri) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');

    invoiceLogger.debug('Opening save dialog...');
    const filePath = await save({
      defaultPath: `${invoice.invoiceNumber}.pdf`,
      filters: [{ name: 'File PDF', extensions: ['pdf'] }],
    });

    invoiceLogger.debug('Save dialog returned', { filePath });

    if (!filePath) {
      invoiceLogger.info('Save dialog cancelled');
      return null;
    }

    invoiceLogger.debug('Writing file...', { path: filePath, size: pdfOutput.byteLength });
    await writeFile(filePath, new Uint8Array(pdfOutput));
    invoiceLogger.info('PDF saved successfully', { path: filePath });
    invoiceLogger.info('PDF export completed successfully');
    return filePath;
  }

  invoiceLogger.info('Not in Tauri environment, using browser download');
  const blob = new Blob([pdfOutput], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${invoice.invoiceNumber}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  invoiceLogger.info('PDF export completed successfully');
  return null;
}
