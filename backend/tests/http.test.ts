import { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app";

process.env.API_TOKEN = "test-token";
process.env.ALLOWED_ORIGIN = "http://localhost:5173";

const TOKEN = process.env.API_TOKEN!;
const AUTH = { authorization: `Bearer ${TOKEN}` };
const prisma = new PrismaClient();

// ── shape assertions ──────────────────────────────────────────────────────────

function assertErrorShape(body: any, expectedCode: string) {
  if (typeof body.code !== "string") throw new Error(`error.code must be string, got ${JSON.stringify(body)}`);
  if (typeof body.message !== "string") throw new Error("error.message must be string");
  if (body.code !== expectedCode) throw new Error(`expected code ${expectedCode}, got ${body.code}`);
}

function assertTransaccionShape(body: any) {
  if (typeof body.id !== "string") throw new Error("id must be string");
  if (typeof body.monto !== "number") throw new Error("monto must be number");
  if (typeof body.moneda !== "string") throw new Error("moneda must be string");
  if (typeof body.origen !== "string") throw new Error("origen must be string");
  if (typeof body.categoria !== "string") throw new Error("categoria must be string");
  if (typeof body.fecha !== "string") throw new Error("fecha must be ISO string");
  if (typeof body.estado !== "string") throw new Error("estado must be string");
  if (typeof body.cuenta?.id !== "string") throw new Error("cuenta.id must be string");
  if (typeof body.cuenta?.nombre !== "string") throw new Error("cuenta.nombre must be string");
  if (typeof body.cuenta?.saldoActual !== "number") throw new Error("cuenta.saldoActual must be number");
}

function assertTransferenciaShape(body: any) {
  if (typeof body.id !== "string") throw new Error("id must be string");
  if (typeof body.monto !== "number") throw new Error("monto must be number");
  if (typeof body.fecha !== "string") throw new Error("fecha must be ISO string");
  for (const key of ["cuentaOrigen", "cuentaDestino"] as const) {
    if (typeof body[key]?.id !== "string") throw new Error(`${key}.id must be string`);
    if (typeof body[key]?.nombre !== "string") throw new Error(`${key}.nombre must be string`);
    if (typeof body[key]?.saldoActual !== "number") throw new Error(`${key}.saldoActual must be number`);
  }
}

function assertResumenShape(body: any) {
  if (typeof body.id !== "string") throw new Error("id must be string");
  if (typeof body.cuentaId !== "string") throw new Error("cuentaId must be string");
  if (typeof body.periodo !== "string") throw new Error("periodo must be string");
  if (typeof body.montoTotalInformado !== "number") throw new Error("montoTotalInformado must be number");
  if (typeof body.montoMinimoInformado !== "number") throw new Error("montoMinimoInformado must be number");
  if (typeof body.saldoFinanciado !== "number") throw new Error("saldoFinanciado must be number");
  if (typeof body.estado !== "string") throw new Error("estado must be string");
}

// ── tests ─────────────────────────────────────────────────────────────────────

async function run() {
  const app = buildApp(prisma);
  await app.ready();

  const ts = Date.now();

  const cuenta = await prisma.cuenta.create({
    data: { nombre: "HTTP Test", tipo: "EFECTIVO", saldoInicial: "500" },
  });
  const cuentaB = await prisma.cuenta.create({
    data: { nombre: "HTTP Test B", tipo: "EFECTIVO", saldoInicial: "0" },
  });

  // 1. GET /health — no auth required
  {
    const res = await app.inject({ method: "GET", url: "/health" });
    if (res.statusCode !== 200) throw new Error(`health: expected 200, got ${res.statusCode}`);
    if (res.json().status !== "ok") throw new Error("health: wrong body");
    console.log("✓ GET /health");
  }

  // 2. Auth guard — ErrorResponseDTO UNAUTHORIZED
  {
    const res = await app.inject({ method: "POST", url: "/api/v1/gastos" });
    if (res.statusCode !== 401) throw new Error(`auth guard: expected 401, got ${res.statusCode}`);
    assertErrorShape(res.json(), "UNAUTHORIZED");
    console.log("✓ auth guard returns 401 UNAUTHORIZED ErrorResponseDTO");
  }

  // 3. POST /api/v1/gastos — TransaccionResponseDTO shape
  {
    const res = await app.inject({
      method: "POST", url: "/api/v1/gastos", headers: AUTH,
      payload: { monto: "150", cuentaId: cuenta.id, categoria: "COMIDA", origen: "MANUAL", idempotencyKey: `http-gasto-${ts}`, comercio: "Mercado" },
    });
    if (res.statusCode !== 201) throw new Error(`POST /gastos: expected 201, got ${res.statusCode} — ${res.body}`);
    const body = res.json();
    assertTransaccionShape(body);
    if (body.monto !== 150) throw new Error(`monto should be 150, got ${body.monto}`);
    if (body.moneda !== "ARS") throw new Error("moneda should be ARS");
    if (body.categoria !== "COMIDA") throw new Error("categoria mismatch");
    if (body.estado !== "CONFIRMADA") throw new Error("estado should be CONFIRMADA");
    if (body.cuenta.saldoActual !== 650) throw new Error(`saldoActual should be 650, got ${body.cuenta.saldoActual}`);
    console.log("✓ POST /api/v1/gastos — TransaccionResponseDTO shape + values");
  }

  // 4. POST /api/v1/gastos/ocr — TransaccionResponseDTO with textoCrudoOCR
  let ocrId: string;
  {
    const res = await app.inject({
      method: "POST", url: "/api/v1/gastos/ocr", headers: AUTH,
      payload: { textoCrudo: "Pago $200 en Farmacia", cuentaId: cuenta.id, idempotencyKey: `http-ocr-${ts}` },
    });
    if (res.statusCode !== 201 && res.statusCode !== 202)
      throw new Error(`POST /gastos/ocr: expected 201 or 202, got ${res.statusCode} — ${res.body}`);
    const body = res.json();
    assertTransaccionShape(body);
    if (typeof body.textoCrudoOCR !== "string") throw new Error("textoCrudoOCR must be string");
    ocrId = body.id;
    console.log("✓ POST /api/v1/gastos/ocr — TransaccionResponseDTO shape");
  }

  // 5. PATCH /api/v1/gastos/ocr/:id/corregir — TransaccionResponseDTO, estado CONFIRMADA
  {
    const t = await prisma.transaccion.findUnique({ where: { id: ocrId } });
    if (t && (t.estado === "PENDIENTE_REVISION" || t.estado === "PENDIENTE_CATEGORIA")) {
      const res = await app.inject({
        method: "PATCH", url: `/api/v1/gastos/ocr/${ocrId}/corregir`, headers: AUTH,
        payload: { categoria: "COMIDA", monto: "200" },
      });
      if (res.statusCode !== 200) throw new Error(`PATCH /corregir: expected 200, got ${res.statusCode} — ${res.body}`);
      const body = res.json();
      assertTransaccionShape(body);
      if (body.estado !== "CONFIRMADA") throw new Error("estado should be CONFIRMADA after correction");
      console.log("✓ PATCH /api/v1/gastos/ocr/:id/corregir — TransaccionResponseDTO shape");
    } else {
      console.log("✓ PATCH /api/v1/gastos/ocr/:id/corregir — skipped (already confirmed)");
    }
  }

  // 6. PATCH /api/v1/transacciones/:id/categoria — resolves PENDIENTE_CATEGORIA
  {
    const res = await app.inject({
      method: "POST", url: "/api/v1/gastos/ocr", headers: AUTH,
      payload: { textoCrudo: "Transferencia a Juan $300", cuentaId: cuenta.id, idempotencyKey: `http-ocr-cat-${ts}` },
    });
    const ocrCatId = res.json().id;
    const t = await prisma.transaccion.findUnique({ where: { id: ocrCatId } });
    if (t?.estado === "PENDIENTE_CATEGORIA") {
      const res2 = await app.inject({
        method: "PATCH", url: `/api/v1/transacciones/${ocrCatId}/categoria`, headers: AUTH,
        payload: { categoria: "DEUDAS" },
      });
      if (res2.statusCode !== 200) throw new Error(`PATCH /categoria: expected 200, got ${res2.statusCode} — ${res2.body}`);
      const body = res2.json();
      assertTransaccionShape(body);
      if (body.categoria !== "DEUDAS") throw new Error("categoria mismatch");
      if (body.estado !== "CONFIRMADA") throw new Error("estado should be CONFIRMADA");
      console.log("✓ PATCH /api/v1/transacciones/:id/categoria — TransaccionResponseDTO shape");
    } else {
      console.log("✓ PATCH /api/v1/transacciones/:id/categoria — skipped (not PENDIENTE_CATEGORIA)");
    }
  }

  // 7. POST /api/v1/transferencias — TransferenciaResponseDTO shape + saldos
  {
    const res = await app.inject({
      method: "POST", url: "/api/v1/transferencias", headers: AUTH,
      payload: { cuentaOrigenId: cuenta.id, cuentaDestinoId: cuentaB.id, monto: "100", nota: "Test", idempotencyKey: `http-transf-${ts}` },
    });
    if (res.statusCode !== 201) throw new Error(`POST /transferencias: expected 201, got ${res.statusCode} — ${res.body}`);
    const body = res.json();
    assertTransferenciaShape(body);
    if (body.monto !== 100) throw new Error(`monto should be 100, got ${body.monto}`);
    if (body.nota !== "Test") throw new Error("nota mismatch");
    if (body.cuentaOrigen.id !== cuenta.id) throw new Error("cuentaOrigen.id mismatch");
    if (body.cuentaDestino.id !== cuentaB.id) throw new Error("cuentaDestino.id mismatch");
    if (body.cuentaDestino.saldoActual !== 100) throw new Error(`cuentaDestino.saldoActual should be 100, got ${body.cuentaDestino.saldoActual}`);
    console.log("✓ POST /api/v1/transferencias — TransferenciaResponseDTO shape + saldos");
  }

  // 8. POST /api/v1/resumenes/ocr — ResumenResponseDTO shape + parsed values
  {
    const texto = `Resumen tarjeta\nPeriodo: 2026-08\nMonto total informado: $ 1234.56\nMonto minimo informado: $ 123.45\nTotal consumos: $ 10.00`;
    const res = await app.inject({
      method: "POST", url: "/api/v1/resumenes/ocr", headers: AUTH,
      payload: { textoCrudo: texto, cuentaId: cuenta.id, idempotencyKey: `http-resumen-${ts}` },
    });
    if (res.statusCode !== 201) throw new Error(`POST /resumenes/ocr: expected 201, got ${res.statusCode} — ${res.body}`);
    const body = res.json();
    assertResumenShape(body);
    if (body.cuentaId !== cuenta.id) throw new Error("cuentaId mismatch");
    if (body.periodo !== "2026-08") throw new Error(`periodo should be 2026-08, got ${body.periodo}`);
    if (body.montoTotalInformado !== 1234.56) throw new Error(`montoTotalInformado should be 1234.56, got ${body.montoTotalInformado}`);
    if (body.montoMinimoInformado !== 123.45) throw new Error(`montoMinimoInformado should be 123.45, got ${body.montoMinimoInformado}`);
    if (body.totalConsumosInformado !== 10) throw new Error(`totalConsumosInformado should be 10, got ${body.totalConsumosInformado}`);
    if (body.estado !== "PENDIENTE") throw new Error("estado should be PENDIENTE");
    console.log("✓ POST /api/v1/resumenes/ocr — ResumenResponseDTO shape + values");
  }

  // 9. Validation error — ErrorResponseDTO BAD_REQUEST with details array
  {
    const res = await app.inject({
      method: "POST", url: "/api/v1/gastos", headers: AUTH,
      payload: { monto: "100", cuentaId: cuenta.id },
    });
    if (res.statusCode !== 400) throw new Error(`validation: expected 400, got ${res.statusCode}`);
    const body = res.json();
    assertErrorShape(body, "BAD_REQUEST");
    if (!Array.isArray(body.details)) throw new Error("BAD_REQUEST details must be array for Zod errors");
    console.log("✓ POST /api/v1/gastos missing fields — BAD_REQUEST ErrorResponseDTO with details");
  }

  // 10. Domain 404 — transaccion not found
  {
    const res = await app.inject({
      method: "PATCH", url: "/api/v1/gastos/ocr/nonexistent-id/corregir", headers: AUTH,
      payload: { categoria: "COMIDA" },
    });
    if (res.statusCode !== 404) throw new Error(`not found: expected 404, got ${res.statusCode}`);
    assertErrorShape(res.json(), "NOT_FOUND");
    console.log("✓ PATCH /corregir with bad id — NOT_FOUND ErrorResponseDTO");
  }

  // 11. Domain 422 — corregir a CONFIRMADA transaccion
  {
    const confirmedRes = await app.inject({
      method: "POST", url: "/api/v1/gastos", headers: AUTH,
      payload: { monto: "50", cuentaId: cuenta.id, categoria: "OTROS", origen: "MANUAL", idempotencyKey: `http-422-${ts}` },
    });
    const confirmedId = confirmedRes.json().id;
    const res = await app.inject({
      method: "PATCH", url: `/api/v1/gastos/ocr/${confirmedId}/corregir`, headers: AUTH,
      payload: { categoria: "COMIDA" },
    });
    if (res.statusCode !== 422) throw new Error(`unprocessable: expected 422, got ${res.statusCode}`);
    assertErrorShape(res.json(), "UNPROCESSABLE");
    console.log("✓ PATCH /corregir on CONFIRMADA — UNPROCESSABLE ErrorResponseDTO");
  }
  await prisma.$disconnect();
  console.log("\nAll HTTP DTO shape tests passed ✓");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
