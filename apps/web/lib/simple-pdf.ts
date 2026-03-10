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
};

export const buildHosteaInvoicePdf = (input: HosteaInvoicePdfInput) => {
  const slate900: PdfColor = [0.059, 0.09, 0.165];
  const slate700: PdfColor = [0.2, 0.29, 0.42];
  const slate500: PdfColor = [0.4, 0.47, 0.59];
  const border: PdfColor = [0.87, 0.9, 0.95];
  const white: PdfColor = [1, 1, 1];
  const softBg: PdfColor = [0.965, 0.972, 0.988];
  const gradientLeft: PdfColor = [1, 0.56, 0.31];
  const gradientRight: PdfColor = [0.42, 0.2, 0.95];
  const successBg: PdfColor = [0.89, 0.98, 0.93];
  const successText: PdfColor = [0.04, 0.52, 0.33];

  const commands: string[] = [];

  commands.push(drawFilledRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, white));
  commands.push(drawFilledRect(0, 0, PAGE_WIDTH * 0.62, 118, gradientLeft));
  commands.push(drawFilledRect(PAGE_WIDTH * 0.62, 0, PAGE_WIDTH * 0.38, 118, gradientRight));

  commands.push(drawText('HOSTEA', 42, 44, 24, white, 'F2'));
  commands.push(drawText('Factura de reserva', 42, 70, 12, white, 'F1'));
  commands.push(drawText(`Reserva ${input.reservationNumber}`, 420, 44, 10, white, 'F2'));
  commands.push(drawText(`Emitida ${input.issuedAt}`, 420, 62, 9, white, 'F1'));
  commands.push(drawText(input.bookingTypeLabel, 420, 79, 9, white, 'F1'));

  commands.push(drawFilledRect(42, 136, 248, 112, softBg, border));
  commands.push(drawText('Huesped', 56, 158, 10, slate500, 'F2'));
  commands.push(...drawWrappedText(input.guestName, 56, 176, 220, 12, slate900, 'F2'));
  commands.push(...drawWrappedText(input.guestEmail, 56, 196, 220, 10, slate700, 'F1'));
  commands.push(drawText(`${input.guestsLabel}: ${input.guestsValue}`, 56, 218, 10, slate700, 'F1'));

  commands.push(drawFilledRect(305, 136, 248, 112, softBg, border));
  commands.push(drawText('Estado del pago', 319, 158, 10, slate500, 'F2'));
  commands.push(drawFilledRect(319, 170, 150, 24, successBg, undefined));
  commands.push(drawText(input.paymentStatus.toUpperCase(), 328, 186, 10, successText, 'F2'));
  commands.push(drawText(`${input.primaryDateLabel}: ${input.primaryDateValue}`, 319, 210, 10, slate700, 'F1'));
  if (input.secondaryDateLabel && input.secondaryDateValue) {
    commands.push(drawText(`${input.secondaryDateLabel}: ${input.secondaryDateValue}`, 319, 226, 10, slate700, 'F1'));
  }

  commands.push(drawFilledRect(42, 264, 511, 138, white, border));
  commands.push(drawText('Alojamiento / experiencia', 56, 286, 10, slate500, 'F2'));
  commands.push(...drawWrappedText(input.listingTitle, 56, 304, 483, 16, slate900, 'F2', 19));
  commands.push(...drawWrappedText(input.address, 56, 336, 483, 11, slate700, 'F1', 15));

  commands.push(drawFilledRect(42, 418, 511, 280, white, border));
  commands.push(drawText('Resumen economico', 56, 442, 12, slate900, 'F2'));

  const rows = [
    { label: 'Tarifa base', value: `${input.currency} ${input.baseAmount.toFixed(2)}` },
    { label: 'Limpieza', value: `${input.currency} ${input.cleaningAmount.toFixed(2)}` },
    { label: 'Impuestos', value: `${input.currency} ${input.taxAmount.toFixed(2)}` },
    { label: 'Tarifa de servicio Hostea', value: `${input.currency} ${input.serviceFeeAmount.toFixed(2)}` }
  ];

  let currentTop = 468;
  for (const row of rows) {
    commands.push(drawText(row.label, 56, currentTop, 11, slate700, 'F1'));
    commands.push(drawText(row.value, 470, currentTop, 11, slate900, 'F2'));
    commands.push(drawFilledRect(56, currentTop + 7, 483, 1, border));
    currentTop += 30;
  }

  commands.push(drawFilledRect(56, 600, 483, 54, softBg, border));
  commands.push(drawText('TOTAL PAGADO', 70, 623, 11, slate500, 'F2'));
  commands.push(drawText(`${input.currency} ${input.totalAmount.toFixed(2)}`, 406, 625, 18, slate900, 'F2'));

  commands.push(drawText(`Soporte: ${input.supportEmail}`, 56, 678, 10, slate500, 'F1'));
  commands.push(drawText('Gracias por reservar con Hostea.', 56, 696, 10, slate500, 'F1'));

  const stream = `${commands.join('\n')}\n`;
  return buildPdfBufferFromStream(stream);
};
