/* eslint-disable no-console */
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const { printer: ThermalPrinter, types: PrinterTypes } = require("node-thermal-printer");

const SB_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE || "";
const POLL_MS = Number(process.env.POLL_MS || 3000);
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 3);
const PRINTER_TYPE = process.env.PRINTER_TYPE || "EPSON";
const DRY_RUN = String(process.env.DRY_RUN || "false").toLowerCase() === "true";

if (!SB_URL || !SB_SERVICE_ROLE_KEY) {
  console.error("Faltan variables SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const money = (currency, value) => {
  const amount = Number(value || 0);
  return `${currency || "USD"} ${amount.toFixed(2)}`;
};

const toDateText = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("es-AR");
};

const ticketRowsFromPayload = (payload) => {
  if (typeof payload?.text === "string" && payload.text.trim().length > 0) {
    return payload.text
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
  }

  if (payload?.type === "test" || payload?.title || Array.isArray(payload?.lines)) {
    const lines = Array.isArray(payload?.lines) ? payload.lines : [];
    return [
      "HOSTEA",
      "PRUEBA DE IMPRESION",
      `Fecha: ${toDateText(payload?.datetime || new Date().toISOString())}`,
      ...lines.map((line) => String(line))
    ];
  }

  const currency = payload?.currency || "USD";
  return [
    "HOSTEA",
    `Reserva: ${payload?.reservationCode || payload?.reservationId || "-"}`,
    `Estado: ${payload?.paymentStatus || "-"}`,
    "------------------------------",
    `Propiedad: ${payload?.propertyName || "-"}`,
    `Host: ${payload?.hostName || payload?.hostEmail || "-"}`,
    `Cliente: ${payload?.guestName || payload?.guestEmail || "-"}`,
    `Fechas: ${payload?.checkIn || "-"} -> ${payload?.checkOut || "-"}`,
    `Noches: ${payload?.nights || "-"}`,
    `Huespedes: ${payload?.guestsCount || "-"}`,
    "------------------------------",
    `Total cliente: ${money(currency, payload?.totalClient)}`,
    `Neto host: ${money(currency, payload?.netHost)}`,
    `Tarifa Hostea: ${money(currency, payload?.hosteaFee)}`,
    `Cargos admin: ${money(currency, payload?.adminCharges)}`,
    "------------------------------",
    `Impreso: ${toDateText(new Date().toISOString())}`
  ];
};

const toPrinterType = (value) => {
  if (value === "STAR") return PrinterTypes.STAR;
  return PrinterTypes.EPSON;
};

const getSettings = async () => {
  const { data, error } = await supabase
    .from("admin_settings")
    .select("auto_print_enabled, printer_name, copies")
    .eq("id", 1)
    .single();

  if (error) throw error;
  return {
    autoPrintEnabled: Boolean(data?.auto_print_enabled),
    printerName: data?.printer_name || "",
    copies: Math.max(1, Number(data?.copies || 1))
  };
};

const fetchPendingJobs = async () => {
  const { data, error } = await supabase
    .from("print_jobs")
    .select("id, status, attempts, payload, reservation_id, type, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data || [];
};

const saveJobFailure = async (job, message) => {
  const nextAttempts = Number(job.attempts || 0) + 1;
  const finalStatus = nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending";
  const { error } = await supabase
    .from("print_jobs")
    .update({
      attempts: nextAttempts,
      status: finalStatus,
      error: String(message || "Error de impresion").slice(0, 400)
    })
    .eq("id", job.id);
  if (error) throw error;
};

const saveJobPrinted = async (job) => {
  const { error } = await supabase
    .from("print_jobs")
    .update({
      status: "printed",
      error: null,
      attempts: Number(job.attempts || 0) + 1,
      printed_at: new Date().toISOString()
    })
    .eq("id", job.id);
  if (error) throw error;
};

const buildInterface = (settings) => {
  if (PRINTER_INTERFACE) return PRINTER_INTERFACE;
  if (settings.printerName) return `printer:${settings.printerName}`;
  return process.env.PRINTER_NAME ? `printer:${process.env.PRINTER_NAME}` : "";
};

const printSingleCopy = async (rows, printerInterface) => {
  if (DRY_RUN) {
    console.log("[DRY_RUN] Ticket:");
    rows.forEach((row) => console.log(`  ${row}`));
    return;
  }

  if (!printerInterface) {
    throw new Error(
      "Impresora no configurada. Defini PRINTER_INTERFACE o admin_settings.printer_name"
    );
  }

  const printer = new ThermalPrinter({
    type: toPrinterType(PRINTER_TYPE),
    interface: printerInterface,
    options: { timeout: 6000 },
    characterSet: "SLOVENIA",
    removeSpecialCharacters: false,
    lineCharacter: "-"
  });

  const isConnected = await printer.isPrinterConnected();
  if (!isConnected) {
    throw new Error(`No se pudo conectar a la impresora (${printerInterface})`);
  }

  printer.clear();
  printer.alignCenter();
  rows.forEach((row) => printer.println(String(row)));
  printer.newLine();
  printer.cut();
  await printer.execute();
};

const processJob = async (job, settings) => {
  try {
    const payload = typeof job.payload === "object" && job.payload ? job.payload : {};
    const rows = ticketRowsFromPayload(payload);
    const copies = Math.max(1, Number(settings.copies || 1));
    const printerInterface = buildInterface(settings);

    for (let i = 0; i < copies; i += 1) {
      await printSingleCopy(rows, printerInterface);
    }

    await saveJobPrinted(job);
    console.log(`[PRINTED] ${job.id} (${job.type})`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await saveJobFailure(job, msg);
    console.error(`[FAILED] ${job.id}: ${msg}`);
  }
};

const loop = async () => {
  try {
    const settings = await getSettings();
    if (!settings.autoPrintEnabled && !DRY_RUN) {
      return;
    }

    const jobs = await fetchPendingJobs();
    for (const job of jobs) {
      await processJob(job, settings);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[LOOP_ERROR] ${msg}`);
  }
};

console.log("Hostea Printer Agent iniciado.");
console.log(`POLL_MS=${POLL_MS} | DRY_RUN=${DRY_RUN}`);

setInterval(loop, POLL_MS);
loop();
