type PdfColor = [number, number, number];
type PdfFont = 'F1' | 'F2';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

const escapePdfText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');

const clampColor = (value: number) => Math.max(0, Math.min(1, value));
const colorToPdf = (color: PdfColor) =>
  `${clampColor(color[0]).toFixed(3)} ${clampColor(color[1]).toFixed(3)} ${clampColor(color[2]).toFixed(3)}`;

const buildPdfBufferFromStream = (stream: string) => {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += object;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
};

const buildPdfContentStream = (lines: string[]) => {
  const safeLines = lines.map((line) => escapePdfText(line));
  const chunks = ['BT', '/F1 11 Tf', '42 800 Td'];

  safeLines.forEach((line, index) => {
    if (index > 0) chunks.push('0 -16 Td');
    chunks.push(`(${line}) Tj`);
  });

  chunks.push('ET');
  return `${chunks.join('\n')}\n`;
};

const yFromTop = (top: number) => PAGE_HEIGHT - top;

const drawFilledRect = (
  x: number,
  top: number,
  width: number,
  height: number,
  fill: PdfColor,
  stroke?: PdfColor,
  strokeWidth = 1
) => {
  const bottom = PAGE_HEIGHT - top - height;
  const commands = ['q', `${colorToPdf(fill)} rg`];
  if (stroke) {
    commands.push(`${colorToPdf(stroke)} RG`);
    commands.push(`${strokeWidth.toFixed(2)} w`);
    commands.push(`${x.toFixed(2)} ${bottom.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re B`);
  } else {
    commands.push(`${x.toFixed(2)} ${bottom.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  }
  commands.push('Q');
  return commands.join('\n');
};

const drawText = (
  text: string,
  x: number,
  top: number,
  size: number,
  color: PdfColor,
  font: PdfFont = 'F1'
) =>
  ['BT', `/${font} ${size.toFixed(2)} Tf`, `${colorToPdf(color)} rg`, `${x.toFixed(2)} ${yFromTop(top).toFixed(2)} Td`, `(${escapePdfText(text)}) Tj`, 'ET'].join('\n');

const wrapText = (value: string, maxWidth: number, fontSize: number) => {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['-'];
  const lines: string[] = [];
  const avgCharWidth = fontSize * 0.52;
  const maxChars = Math.max(8, Math.floor(maxWidth / avgCharWidth));
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
};

const drawWrappedText = (
  value: string,
  x: number,
  top: number,
  maxWidth: number,
  fontSize: number,
  color: PdfColor,
  font: PdfFont = 'F1',
  lineHeight = 15
) => {
  const lines = wrapText(value, maxWidth, fontSize);
  return lines.map((line, index) => drawText(line, x, top + index * lineHeight, fontSize, color, font));
};

export const buildSimplePdfBuffer = (lines: string[]) => {
  const stream = buildPdfContentStream(lines);
  return buildPdfBufferFromStream(stream);
};

export type HosteaInvoicePdfInput = {
  reservationNumber: string;
  issuedAt: string;
  paymentStatus: string;
  bookingTypeLabel: string;
  guestName: string;
  guestEmail: string;
  listingTitle: string;
  address: string;
  primaryDateLabel: string;
  primaryDateValue: string;
  secondaryDateLabel?: string;
  secondaryDateValue?: string;
  guestsLabel: string;
  guestsValue: string;
  currency: string;
  baseAmount: number;
  cleaningAmount: number;
  taxAmount: number;
  serviceFeeAmount: number;
  totalAmount: number;
  supportEmail: string;
  supportPhone?: string;
  propertyImageUrl?: string;
};

export const buildHosteaInvoicePdf = (input: HosteaInvoicePdfInput) => {
  const slate900: PdfColor = [0.059, 0.09, 0.165];
  const slate700: PdfColor = [0.2, 0.29, 0.43];
  const slate500: PdfColor = [0.42, 0.49, 0.61];
  const border: PdfColor = [0.85, 0.89, 0.95];
  const white: PdfColor = [1, 1, 1];
  const pageBg: PdfColor = [0.965, 0.971, 0.988];
  const softBg: PdfColor = [0.97, 0.975, 0.992];
  const accentOrange: PdfColor = [1, 0.56, 0.31];
  const accentPink: PdfColor = [1, 0.37, 0.58];
  const accentPurple: PdfColor = [0.42, 0.2, 0.95];
  const successBg: PdfColor = [0.89, 0.98, 0.93];
  const successText: PdfColor = [0.04, 0.52, 0.33];
  const rowBg: PdfColor = [0.986, 0.989, 1];

  const commands: string[] = [];

  commands.push(drawFilledRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, pageBg));
  commands.push(drawFilledRect(22, 20, PAGE_WIDTH - 44, PAGE_HEIGHT - 40, white, border));

  commands.push(drawFilledRect(22, 20, PAGE_WIDTH - 44, 118, accentOrange));
  commands.push(drawFilledRect(250, 20, PAGE_WIDTH - 272, 118, accentPink));
  commands.push(drawFilledRect(392, 20, PAGE_WIDTH - 414, 118, accentPurple));
  commands.push(drawText('HOSTEA', 44, 56, 27, white, 'F2'));
  commands.push(drawText('Factura de reserva', 44, 84, 12, white, 'F1'));
  commands.push(drawText(`Reserva ${input.reservationNumber}`, 356, 56, 11, white, 'F2'));
  commands.push(drawText(`Emitida ${input.issuedAt}`, 356, 76, 10, white, 'F1'));
  commands.push(drawText(input.bookingTypeLabel, 356, 95, 10, white, 'F1'));

  commands.push(drawFilledRect(44, 156, 164, 96, softBg, border));
  commands.push(drawText('Estado del pago', 56, 176, 10, slate500, 'F2'));
  commands.push(drawFilledRect(56, 186, 140, 24, successBg));
  commands.push(drawText(input.paymentStatus.toUpperCase(), 64, 202, 10, successText, 'F2'));
  commands.push(drawText('Ref. reserva', 56, 223, 9, slate500, 'F1'));
  commands.push(drawText(input.reservationNumber, 56, 236, 11, slate900, 'F2'));

  commands.push(drawFilledRect(220, 156, 164, 96, softBg, border));
  commands.push(drawText('Huesped', 232, 176, 10, slate500, 'F2'));
  commands.push(...drawWrappedText(input.guestName, 232, 193, 138, 12, slate900, 'F2'));
  commands.push(...drawWrappedText(input.guestEmail, 232, 214, 138, 9, slate700, 'F1', 12));
  commands.push(drawText(`${input.guestsLabel}: ${input.guestsValue}`, 232, 240, 9, slate700, 'F1'));

  commands.push(drawFilledRect(396, 156, 156, 96, softBg, border));
  commands.push(drawText('Fechas', 408, 176, 10, slate500, 'F2'));
  commands.push(drawText(`${input.primaryDateLabel}:`, 408, 193, 9, slate500, 'F1'));
  commands.push(drawText(input.primaryDateValue, 408, 206, 11, slate900, 'F2'));
  if (input.secondaryDateLabel && input.secondaryDateValue) {
    commands.push(drawText(`${input.secondaryDateLabel}:`, 408, 221, 9, slate500, 'F1'));
    commands.push(drawText(input.secondaryDateValue, 408, 234, 11, slate900, 'F2'));
  }

  commands.push(drawFilledRect(44, 270, 508, 130, white, border));
  commands.push(drawText('Detalle de la reserva', 56, 291, 11, slate500, 'F2'));
  commands.push(...drawWrappedText(input.listingTitle, 56, 311, 486, 17, slate900, 'F2', 20));
  commands.push(...drawWrappedText(input.address, 56, 344, 486, 11, slate700, 'F1', 15));
  if (input.propertyImageUrl) {
    commands.push(drawText('Imagen de portada:', 56, 373, 9, slate500, 'F1'));
    commands.push(...drawWrappedText(input.propertyImageUrl, 138, 373, 404, 8, slate500, 'F1', 11));
  }

  commands.push(drawFilledRect(44, 416, 508, 284, white, border));
  commands.push(drawText('Resumen economico', 56, 438, 12, slate900, 'F2'));

  const rows = [
    { label: 'Tarifa base', value: `${input.currency} ${input.baseAmount.toFixed(2)}` },
    { label: 'Limpieza', value: `${input.currency} ${input.cleaningAmount.toFixed(2)}` },
    { label: 'Impuestos', value: `${input.currency} ${input.taxAmount.toFixed(2)}` },
    { label: 'Tarifa de servicio Hostea', value: `${input.currency} ${input.serviceFeeAmount.toFixed(2)}` }
  ];

  let currentTop = 465;
  rows.forEach((row, index) => {
    commands.push(drawFilledRect(56, currentTop - 14, 484, 30, index % 2 === 0 ? rowBg : white));
    commands.push(drawText(row.label, 70, currentTop, 11, slate700, 'F1'));
    commands.push(drawText(row.value, 432, currentTop, 11, slate900, 'F2'));
    currentTop += 32;
  });

  commands.push(drawFilledRect(56, 602, 484, 58, softBg, border));
  commands.push(drawText('TOTAL PAGADO', 72, 625, 11, slate500, 'F2'));
  commands.push(drawText(`${input.currency} ${input.totalAmount.toFixed(2)}`, 394, 627, 19, slate900, 'F2'));
  commands.push(drawText('Pago procesado y acreditado correctamente.', 72, 644, 9, slate500, 'F1'));

  const supportLine = input.supportPhone?.trim()
    ? `${input.supportPhone} | ${input.supportEmail}`
    : input.supportEmail;
  commands.push(drawText(`Soporte Hostea: ${supportLine}`, 56, 686, 10, slate500, 'F1'));
  commands.push(
    drawText(
      'Hostea actua como intermediario tecnologico entre huespedes y anfitriones.',
      56,
      704,
      9,
      slate500,
      'F1'
    )
  );
  commands.push(
    drawText(
      'Este documento es una constancia de pago digital emitida por Hostea.',
      56,
      719,
      9,
      slate500,
      'F1'
    )
  );

  const stream = `${commands.join('\n')}\n`;
  return buildPdfBufferFromStream(stream);
};
