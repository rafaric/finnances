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

function assertCuentaShape(body: any) {
  if (typeof body.id !== "string") throw new Error("id must be string");
  if (typeof body.nombre !== "string") throw new Error("nombre must be string");
  if (typeof body.tipo !== "string") throw new Error("tipo must be string");
  if (typeof body.saldoInicial !== "number") throw new Error("saldoInicial must be number");
  if (typeof body.saldoActual !== "number") throw new Error("saldoActual must be number");
}

function assertTransaccionShape(body: any) {
  if (typeof body.monto !== "number") throw new Error("monto must be number");
  if (typeof body.moneda !== "string") throw new Error("moneda must be string");
  if (typeof body.origen !== "string") throw new Error("origen must be string");
  if (typeof body.categoria.id !== "string") throw new Error("categoria.id must be string");
  if (typeof body.categoria.nombre !== "string") throw new Error("categoria.nombre must be string");
  if (typeof body.fecha !== "string") throw new Error("fecha must be ISO string");
  if (typeof body.estado !== "string") throw new Error("estado must be string");
  if (body.estado === "CONFIRMADA") {
    if (typeof body.cuenta?.id !== "string") throw new Error("confirmed cuenta.id must be string");
    if (typeof body.cuenta?.nombre !== "string") throw new Error("confirmed cuenta.nombre must be string");
    if (typeof body.cuenta?.saldoActual !== "number") throw new Error("confirmed cuenta.saldoActual must be number");
  } else if (body.cuenta !== undefined && typeof body.cuenta?.id !== "string") {
    throw new Error("pending cuenta must be absent or include an id");
  }
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

function assertResumenMensualShape(body: any) {
  if (typeof body.periodo !== "string") throw new Error("summary.periodo must be string");
  for (const key of ["ingresos", "gastos", "ahorro", "margen", "disponibleLiquido", "deudaTarjetas"]) {
    if (typeof body[key] !== "number") throw new Error(`summary.${key} must be number`);
  }
  if (!Array.isArray(body.gastosPorCategoria)) {
    throw new Error("summary.gastosPorCategoria must be array");
  }
  body.gastosPorCategoria.forEach((item: any) => {
    if (typeof item.categoria?.id !== "string") throw new Error("category.id must be string");
    if (typeof item.monto !== "number") throw new Error("category monto must be number");
    if (typeof item.porcentaje !== "number") throw new Error("category porcentaje must be number");
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

async function run() {
  const app = buildApp(prisma);
  await app.ready();

  const ts = Date.now();

  const cuentaB = await prisma.cuenta.create({
    data: { nombre: "HTTP Test B", tipo: "EFECTIVO", saldoInicial: "0" },
  });

  let cuenta: any;

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

  // 3. POST /api/v1/cuentas — CuentaResponseDTO shape
  let cuentaId: string;
  {
    const res = await app.inject({
      method: "POST", url: "/api/v1/cuentas", headers: AUTH,
      payload: { nombre: "Banco Test", tipo: "CUENTA_BANCARIA", saldoInicial: "1000", banco: "Galicia", nombreEntidad: `Banco Galicia ${ts}`, diaCierre: 5, diaPago: 15 },
    });
    if (res.statusCode !== 201) throw new Error(`POST /cuentas: expected 201, got ${res.statusCode} — ${res.body}`);
    const body = res.json();
    assertCuentaShape(body);
    if (body.nombre !== "Banco Test") throw new Error("nombre mismatch");
    if (body.tipo !== "CUENTA_BANCARIA") throw new Error("tipo mismatch");
    if (body.saldoInicial !== 1000) throw new Error(`saldoInicial should be 1000, got ${body.saldoInicial}`);
    if (body.saldoActual !== 1000) throw new Error(`saldoActual should be 1000, got ${body.saldoActual}`);
    if (body.banco !== "Galicia") throw new Error("banco mismatch");
    if (body.nombreEntidad !== `banco galicia ${ts}`) throw new Error("nombreEntidad should be normalized");
    if (body.diaCierre !== 5) throw new Error("diaCierre mismatch");
    if (body.diaPago !== 15) throw new Error("diaPago mismatch");
    cuentaId = body.id;
    cuenta = { id: cuentaId, saldoInicial: "1000" };
    console.log("✓ POST /api/v1/cuentas — CuentaResponseDTO shape + values");
  }

  // 3b. PATCH /api/v1/cuentas/:id — editable fields only
  {
    const res = await app.inject({
      method: "PATCH", url: `/api/v1/cuentas/${cuentaId}`, headers: AUTH,
      payload: { nombre: "Banco Test Editado", nombreEntidad: `Banco Nacion ${ts}` },
    });
    if (res.statusCode !== 200) throw new Error(`PATCH /cuentas: expected 200, got ${res.statusCode} — ${res.body}`);
    const body = res.json();
    if (body.nombre !== "Banco Test Editado" || body.nombreEntidad !== `banco nacion ${ts}`) throw new Error("account editable fields mismatch");
    if (body.tipo !== "CUENTA_BANCARIA" || body.saldoInicial !== 1000) throw new Error("account immutable fields changed");
    console.log("✓ PATCH /cuentas/:id — editable fields and normalization");

    const duplicate = await app.inject({
      method: "PATCH", url: `/api/v1/cuentas/${cuentaB.id}`, headers: AUTH,
      payload: { nombreEntidad: `Banco Nacion ${ts}` },
    });
    if (duplicate.statusCode !== 400) throw new Error(`duplicate entity: expected 400, got ${duplicate.statusCode}`);
    assertErrorShape(duplicate.json(), "BAD_REQUEST");
    console.log("✓ PATCH /cuentas/:id — duplicate entity rejected");
  }

  // 4. GET /api/v1/cuentas — array of CuentaResponseDTO with derived saldos
  {
    const res = await app.inject({ method: "GET", url: "/api/v1/cuentas", headers: AUTH });
    if (res.statusCode !== 200) throw new Error(`GET /cuentas: expected 200, got ${res.statusCode}`);
    const body = res.json();
    if (!Array.isArray(body)) throw new Error("GET /cuentas: expected array");
    if (body.length === 0) throw new Error("GET /cuentas: expected at least one cuenta");
    body.forEach((c: any) => assertCuentaShape(c));
    const created = body.find((c: any) => c.id === cuentaId);
    if (!created) throw new Error("GET /cuentas: created cuenta not found in list");
    if (created.saldoActual !== 1000) throw new Error(`saldoActual should be 1000, got ${created.saldoActual}`);
    console.log("✓ GET /api/v1/cuentas — array of CuentaResponseDTO with derived saldos");
  }

  // 5. POST /api/v1/gastos — TransaccionResponseDTO shape
  {
    const res = await app.inject({
      method: "POST", url: "/api/v1/gastos", headers: AUTH,
      payload: { monto: "150", cuentaId: cuenta.id, categoriaId: "cat-otros", origen: "MANUAL", idempotencyKey: `http-gasto-${ts}`, comercio: "Mercado" },
    });
    if (res.statusCode !== 201) throw new Error(`POST /gastos: expected 201, got ${res.statusCode} — ${res.body}`);
    const body = res.json();
    assertTransaccionShape(body);
    if (body.monto !== -150) throw new Error(`monto should be -150, got ${body.monto}`);
    if (body.moneda !== "ARS") throw new Error("moneda should be ARS");
    if (body.categoria.id !== "cat-otros") throw new Error("categoria mismatch");
    if (body.estado !== "CONFIRMADA") throw new Error("estado should be CONFIRMADA");
    if (body.cuenta.saldoActual !== 850) throw new Error(`saldoActual should be 850, got ${body.cuenta.saldoActual}`);
    console.log("✓ POST /api/v1/gastos — TransaccionResponseDTO shape + values");
  }

  // 5b. GET /api/v1/transacciones — PaginatedResponseDTO shape + filters

  // 5b. GET /api/v1/transacciones — PaginatedResponseDTO shape + filters
  {
    // sin filtros — shape de paginación
    const res = await app.inject({ method: "GET", url: "/api/v1/transacciones", headers: AUTH });
    if (res.statusCode !== 200) throw new Error(`GET /transacciones: expected 200, got ${res.statusCode}`);
    const body = res.json();
    if (!Array.isArray(body.items)) throw new Error("items must be array");
    if (typeof body.page !== "number") throw new Error("page must be number");
    if (typeof body.limit !== "number") throw new Error("limit must be number");
    if (typeof body.total !== "number") throw new Error("total must be number");
    if (typeof body.hasNextPage !== "boolean") throw new Error("hasNextPage must be boolean");
    body.items.forEach((t: any) => assertTransaccionShape(t));
    console.log("✓ GET /api/v1/transacciones — PaginatedResponseDTO shape");

    // filtro por cuentaId
    const resCuenta = await app.inject({
      method: "GET", url: `/api/v1/transacciones?cuentaId=${cuenta.id}`, headers: AUTH,
    });
    const bodyCuenta = resCuenta.json();
    if (bodyCuenta.items.some((t: any) => t.cuenta.id !== cuenta.id))
      throw new Error("cuentaId filter returned wrong transactions");
    console.log("✓ GET /api/v1/transacciones?cuentaId — filter works");

    // filtro por periodo
    const periodo = new Date().toISOString().slice(0, 7);
    const resPeriodo = await app.inject({
      method: "GET", url: `/api/v1/transacciones?periodo=${periodo}`, headers: AUTH,
    });
    if (resPeriodo.statusCode !== 200) throw new Error(`periodo filter: expected 200, got ${resPeriodo.statusCode}`);
    console.log("✓ GET /api/v1/transacciones?periodo — filter works");

    // filtro por categoriaId
    const resCategoria = await app.inject({
      method: "GET", url: `/api/v1/transacciones?categoriaId=cat-otros`, headers: AUTH,
    });
    const bodyCategoria = resCategoria.json();
    if (bodyCategoria.items.some((t: any) => t.categoria.id !== "cat-otros"))
      throw new Error("categoriaId filter returned wrong transactions");
    console.log("✓ GET /api/v1/transacciones?categoriaId — filter works");

    // filtro por estado
    const resEstado = await app.inject({
      method: "GET", url: `/api/v1/transacciones?estado=CONFIRMADA`, headers: AUTH,
    });
    const bodyEstado = resEstado.json();
    if (bodyEstado.items.some((t: any) => t.estado !== "CONFIRMADA"))
      throw new Error("estado filter returned wrong transactions");
    console.log("✓ GET /api/v1/transacciones?estado — filter works");

    // paginación
    const resPage = await app.inject({
      method: "GET", url: `/api/v1/transacciones?page=1&limit=1`, headers: AUTH,
    });
    const bodyPage = resPage.json();
    if (bodyPage.items.length > 1) throw new Error("limit=1 should return at most 1 item");
    if (bodyPage.limit !== 1) throw new Error("limit mismatch");
    if (bodyPage.page !== 1) throw new Error("page mismatch");
    if (typeof bodyPage.hasNextPage !== "boolean") throw new Error("hasNextPage must be boolean");
    console.log("✓ GET /api/v1/transacciones?page&limit — pagination works");

    // periodo inválido — BAD_REQUEST
    const resBad = await app.inject({
      method: "GET", url: `/api/v1/transacciones?periodo=agosto`, headers: AUTH,
    });
    if (resBad.statusCode !== 400) throw new Error(`invalid periodo: expected 400, got ${resBad.statusCode}`);
    assertErrorShape(resBad.json(), "BAD_REQUEST");
    console.log("✓ GET /api/v1/transacciones?periodo=invalid — BAD_REQUEST");
  }

  // 6. POST /api/v1/gastos/ocr — TransaccionResponseDTO with textoCrudoOCR
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

  // 6b. GET /api/v1/pendientes + correction with account assignment
  {
    const pendingRes = await app.inject({
      method: "POST", url: "/api/v1/gastos/ocr", headers: AUTH,
      payload: { textoCrudo: "Comprobante sin cuenta $1", idempotencyKey: `http-ocr-pending-${ts}` },
    });
    if (pendingRes.statusCode !== 202) throw new Error(`POST unresolved OCR: expected 202, got ${pendingRes.statusCode}`);
    const pending = pendingRes.json();
    if (pending.cuenta !== undefined) throw new Error("unresolved pending should not include account");

    const listRes = await app.inject({ method: "GET", url: "/api/v1/pendientes", headers: AUTH });
    if (listRes.statusCode !== 200) throw new Error(`GET /pendientes: expected 200, got ${listRes.statusCode}`);
    const pendingItems = listRes.json();
    if (!pendingItems.some((item: any) => item.id === pending.id)) throw new Error("pending item missing from endpoint");

    const correctionRes = await app.inject({
      method: "PATCH", url: `/api/v1/gastos/ocr/${pending.id}/corregir`, headers: AUTH,
      payload: { monto: "1", categoriaId: "cat-otros", cuentaId },
    });
    if (correctionRes.statusCode !== 200) throw new Error(`pending correction: expected 200, got ${correctionRes.statusCode} — ${correctionRes.body}`);
    const corrected = correctionRes.json();
    assertTransaccionShape(corrected);
    if (corrected.estado !== "CONFIRMADA" || corrected.cuenta?.id !== cuentaId) throw new Error("pending correction should confirm with assigned account");
    console.log("✓ GET /api/v1/pendientes + OCR correction account assignment");
  }

  // 5. PATCH /api/v1/gastos/ocr/:id/corregir — TransaccionResponseDTO, estado CONFIRMADA
  {
    const t = await prisma.transaccion.findUnique({ where: { id: ocrId } });
    if (t && (t.estado === "PENDIENTE_REVISION" || t.estado === "PENDIENTE_CATEGORIA")) {
      const res = await app.inject({
        method: "PATCH", url: `/api/v1/gastos/ocr/${ocrId}/corregir`, headers: AUTH,
        payload: { categoriaId: "cat-comida", monto: "200" },
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
        payload: { categoriaId: "cat-deudas" },
      });
      if (res2.statusCode !== 200) throw new Error(`PATCH /categoria: expected 200, got ${res2.statusCode} — ${res2.body}`);
      const body = res2.json();
      assertTransaccionShape(body);
      if (body.categoria.id !== "cat-deudas") throw new Error("categoria mismatch");
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

  // 9. GET /api/v1/resumen-mensual — aggregated economic summary
  {
    const periodo = "2099-11";
    const baselineRes = await app.inject({
      method: "GET",
      url: `/api/v1/resumen-mensual?periodo=${periodo}`,
      headers: AUTH,
    });
    if (baselineRes.statusCode !== 200) {
      throw new Error(
        `GET /resumen-mensual baseline: expected 200, got ${baselineRes.statusCode} — ${baselineRes.body}`,
      );
    }
    const baseline = baselineRes.json();
    assertResumenMensualShape(baseline);

    const tarjetaRes = await app.inject({
      method: "POST",
      url: "/api/v1/cuentas",
      headers: AUTH,
      payload: {
        nombre: `Tarjeta resumen ${ts}`,
        tipo: "TARJETA_CREDITO",
        saldoInicial: "-300",
      },
    });
    if (tarjetaRes.statusCode !== 201) {
      throw new Error(`summary card: expected 201, got ${tarjetaRes.statusCode}`);
    }

    await prisma.ingreso.create({
      data: {
        monto: "1200",
        fechaCobro: new Date("2099-11-05T12:00:00.000Z"),
        periodoDisponible: periodo,
        cuentaId: cuenta.id,
        categoriaId: "cat-sueldo",
        idempotencyKey: `income-http-${ts}`,
      },
    });

    const expenseRes = await app.inject({
      method: "POST",
      url: "/api/v1/gastos",
      headers: AUTH,
      payload: {
        monto: "80",
        cuentaId: cuenta.id,
        categoriaId: "cat-servicios",
        origen: "MANUAL",
        fecha: "2099-11-10",
        idempotencyKey: `http-summary-expense-${ts}`,
      },
    });
    if (expenseRes.statusCode !== 201) {
      throw new Error(
        `summary expense: expected 201, got ${expenseRes.statusCode} — ${expenseRes.body}`,
      );
    }

    const beforeTransferRes = await app.inject({
      method: "GET",
      url: `/api/v1/resumen-mensual?periodo=${periodo}`,
      headers: AUTH,
    });
    if (beforeTransferRes.statusCode !== 200) {
      throw new Error(
        `GET /resumen-mensual before transfer: expected 200, got ${beforeTransferRes.statusCode}`,
      );
    }
    const beforeTransfer = beforeTransferRes.json();

    const transferRes = await app.inject({
      method: "POST",
      url: "/api/v1/transferencias",
      headers: AUTH,
      payload: {
        cuentaOrigenId: cuenta.id,
        cuentaDestinoId: cuentaB.id,
        monto: "40",
        fecha: "2099-11-15",
        idempotencyKey: `http-summary-transfer-${ts}`,
      },
    });
    if (transferRes.statusCode !== 201) {
      throw new Error(
        `summary transfer: expected 201, got ${transferRes.statusCode} — ${transferRes.body}`,
      );
    }

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/resumen-mensual?periodo=${periodo}`,
      headers: AUTH,
    });
    if (res.statusCode !== 200) {
      throw new Error(`GET /resumen-mensual: expected 200, got ${res.statusCode}`);
    }
    const body = res.json();
    assertResumenMensualShape(body);
    if (body.periodo !== periodo) throw new Error("summary periodo mismatch");
    if (body.ingresos - baseline.ingresos !== 1200) {
      throw new Error(`summary ingresos delta should be 1200, got ${body.ingresos - baseline.ingresos}`);
    }
    if (body.gastos - baseline.gastos !== 80) {
      throw new Error(`summary gastos delta should be 80, got ${body.gastos - baseline.gastos}`);
    }
    if (body.ahorro - baseline.ahorro !== 1120) {
      throw new Error(`summary ahorro delta should be 1120, got ${body.ahorro - baseline.ahorro}`);
    }
    const servicios = body.gastosPorCategoria.find(
      (item: { categoria: { id: string } }) => item.categoria.id === "cat-servicios",
    );
    const baselineServicios = baseline.gastosPorCategoria.find(
      (item: { categoria: { id: string } }) => item.categoria.id === "cat-servicios",
    );
    const serviciosDelta = (servicios?.monto ?? 0) - (baselineServicios?.monto ?? 0);
    if (!servicios || serviciosDelta !== 80) {
      throw new Error("summary category aggregation mismatch");
    }
    if (body.disponibleLiquido !== beforeTransfer.disponibleLiquido) {
      throw new Error("internal transfer must not change aggregate liquid availability");
    }
    if (body.deudaTarjetas - baseline.deudaTarjetas !== 300) {
      throw new Error(`summary card debt delta should be 300, got ${body.deudaTarjetas - baseline.deudaTarjetas}`);
    }
    console.log("✓ GET /api/v1/resumen-mensual — aggregation and transfer exclusion");

    const invalidRes = await app.inject({
      method: "GET",
      url: "/api/v1/resumen-mensual?periodo=2099-13",
      headers: AUTH,
    });
    if (invalidRes.statusCode !== 400) {
      throw new Error(`invalid summary periodo: expected 400, got ${invalidRes.statusCode}`);
    }
    assertErrorShape(invalidRes.json(), "BAD_REQUEST");
    console.log("✓ GET /api/v1/resumen-mensual invalid periodo — BAD_REQUEST");
  }

  // 10. Validation error — ErrorResponseDTO BAD_REQUEST with details array
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

  // 11. Invalid transaction period — ErrorResponseDTO BAD_REQUEST
  {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/transacciones?periodo=2099-13",
      headers: AUTH,
    });
    if (res.statusCode !== 400) throw new Error(`invalid transaction period: expected 400, got ${res.statusCode}`);
    assertErrorShape(res.json(), "BAD_REQUEST");
    console.log("✓ GET /api/v1/transacciones invalid periodo — BAD_REQUEST");
  }

  // 12. Domain 404 — transaccion not found
  {
    const res = await app.inject({
      method: "PATCH", url: "/api/v1/gastos/ocr/nonexistent-id/corregir", headers: AUTH,
      payload: { categoriaId: "cat-comida" },
    });
    if (res.statusCode !== 404) throw new Error(`not found: expected 404, got ${res.statusCode}`);
    assertErrorShape(res.json(), "NOT_FOUND");
    console.log("✓ PATCH /corregir with bad id — NOT_FOUND ErrorResponseDTO");
  }

  // 13. Domain 422 — corregir a CONFIRMADA transaccion
  {
    const confirmedRes = await app.inject({
      method: "POST", url: "/api/v1/gastos", headers: AUTH,
      payload: { monto: "50", cuentaId: cuenta.id, categoriaId: "cat-otros", origen: "MANUAL", idempotencyKey: `http-422-${ts}` },
    });
    const confirmedId = confirmedRes.json().id;
    const res = await app.inject({
      method: "PATCH", url: `/api/v1/gastos/ocr/${confirmedId}/corregir`, headers: AUTH,
        payload: { categoriaId: "cat-comida" },
      });
      if (res.statusCode !== 422) throw new Error(`unprocessable: expected 422, got ${res.statusCode}`);
    assertErrorShape(res.json(), "UNPROCESSABLE");
    console.log("✓ PATCH /corregir on CONFIRMADA — UNPROCESSABLE ErrorResponseDTO");
  }

  // 14. Recurrentes variables — projection stays pending until real amount is supplied
  {
    const create = await app.inject({
      method: "POST", url: "/api/v1/recurrentes", headers: AUTH,
      payload: { nombre: `Luz HTTP ${ts}`, tipoMonto: "VARIABLE", cuentaId: cuenta.id, categoriaId: "cat-servicios", diaDelMes: 15 },
    });
    if (create.statusCode !== 201) throw new Error(`POST /recurrentes variable: expected 201, got ${create.statusCode} — ${create.body}`);
    const recurringId = create.json().id;
    const projected = await app.inject({ method: "POST", url: "/api/v1/recurrentes/proyectar", headers: AUTH, payload: { periodo: "2099-10" } });
    const instance = projected.json().find((item: { gastoRecurrenteId: string }) => item.gastoRecurrenteId === recurringId);
    if (!instance || instance.monto !== null || !instance.montoEsEstimado) throw new Error("variable HTTP projection mismatch");
    const confirmed = await app.inject({ method: "POST", url: `/api/v1/recurrentes/instancias/${instance.id}/confirmar`, headers: AUTH, payload: { monto: "42.50", fecha: "2099-10-16" } });
    if (confirmed.statusCode !== 200 || Number(confirmed.json().monto) !== 42.5 || confirmed.json().montoEsEstimado) throw new Error(`variable HTTP confirmation mismatch: ${confirmed.body}`);
    const history = await app.inject({ method: "GET", url: "/api/v1/recurrentes/instancias?periodo=2099-10&estado=CONFIRMADO", headers: AUTH });
    if (history.statusCode !== 200 || !history.json().some((item: { id: string }) => item.id === instance.id)) throw new Error("recurring history filter mismatch");
    const paused = await app.inject({ method: "PATCH", url: `/api/v1/recurrentes/${recurringId}`, headers: AUTH, payload: { activo: false } });
    if (paused.statusCode !== 200 || paused.json().activo !== false) throw new Error("recurring pause mismatch");
    console.log("✓ recurrente variable HTTP — projection, confirmation and pause");
  }
  await prisma.$disconnect();
  console.log("\nAll HTTP DTO shape tests passed ✓");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
