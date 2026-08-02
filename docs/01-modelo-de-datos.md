# PRD 01 — Modelo de Datos

> Schema conceptual en formato Prisma-like. El setup agéntico debe adaptarlo
> al ORM real elegido, pero **las relaciones, enums y reglas de nullability
> deben respetarse** — encapsulan decisiones de diseño discutidas y
> validadas, no son arbitrarias.

## Reglas transversales

- **Nunca usar `Float` para montos de dinero.** Siempre `Decimal`. Los
  errores de redondeo binario se acumulan y rompen la integridad de
  balances a lo largo del tiempo.
- **El saldo de una `Cuenta` nunca es un campo editable.** Es siempre
  `saldoInicial + suma de movimientos asociados` (ver `03-reglas-de-negocio`
  para el detalle de qué movimientos suman).
- Todos los enums existen para evitar strings libres en campos que alimentan
  reportes o lógica de negocio (evita "Comida"/"comida"/"Alimentación"
  coexistiendo como si fueran distintos).

---

## Cuenta

Entidad central. Representa cualquier lugar donde vive o se debe dinero:
efectivo, billetera virtual, cuenta bancaria, o tarjeta de crédito.

```prisma
enum TipoCuenta {
  EFECTIVO
  BILLETERA_VIRTUAL
  CUENTA_BANCARIA
  TARJETA_CREDITO   // semántica de saldo invertida: saldo = deuda (negativo)
}

model Cuenta {
  id                  String      @id @default(cuid())
  nombre              String
  tipo                TipoCuenta
  banco               String?
  ultimosDigitos      String?     // matching automático con Apple Pay / OCR
  esPrincipal         Boolean     @default(false)
  esCuentaPuente      Boolean     @default(false) // ver 03-reglas-de-negocio: reconciliación
  colorIdentificador  String?

  saldoInicial        Decimal     @default(0)  // negativo si es deuda (TARJETA_CREDITO)

  // Solo aplican si tipo = TARJETA_CREDITO — nullable para el resto
  diaCierre           Int?
  diaPago             Int?
  diasRecordatorio    Int?        @default(3)
  limiteCompra        Decimal?
  limiteDisponible    Decimal?    // CAPTURADO, nunca calculado (ver principio 2.1)
  limiteActualizadoEn DateTime?

  saldoActualizadoEn  DateTime?   // solo relevante si se decide cachear el saldo calculado
}
```

**Notas de implementación:**
- `ultimosDigitos` permite resolver automáticamente qué `Cuenta` corresponde
  a un pago capturado por Apple Pay (ej. "Visa **** 1234" → matching por
  `1234`).
- El límite disponible de tarjeta de crédito **no es lineal respecto al
  gasto** (impuesto PAIS en dólares, CFT completo en cuotas con interés,
  seguros, comisiones del procesador). Nunca calcularlo — capturarlo desde
  notificación del banco (vía pipeline OCR-IA) o carga manual esporádica.

---

## Ingreso

```prisma
model Ingreso {
  id                String   @id @default(cuid())
  monto             Decimal
  fechaCobro        DateTime  // cuándo entró la plata realmente
  periodoDisponible String    // "2026-08" — a qué mes calendario pertenece en el presupuesto
  concepto          String
  cuentaId          String
  cuenta            Cuenta    @relation(fields: [cuentaId], references: [id])
}
```

`periodoDisponible` se carga manualmente al momento de registrar el ingreso
(selector simple "este mes / mes siguiente"). No automatizar el cálculo de
"último día hábil" con calendario de feriados salvo que el costo manual
empiece a doler (YAGNI, ver principio 2.7).

---

## Categoria / Subcategoria

```prisma
enum Categoria {
  COMIDA
  TRANSPORTE
  VIVIENDA
  SERVICIOS
  OCIO
  DEUDAS      // cuotas, resúmenes, préstamos — ver 03-reglas-de-negocio para reglas de no-doble-conteo
  OTROS
}

model Subcategoria {
  id         String    @id @default(cuid())
  nombre     String    // "Salud", "Supermercado", "Farmacia"
  categoria  Categoria
}
```

---

## Transaccion (gasto individual confirmado)

```prisma
enum OrigenTransaccion {
  APPLE_PAY
  OCR_IA
  MANUAL
  RECURRENTE_CONFIRMADO
  RESUMEN_CONFIRMADO
}

enum EstadoTransaccion {
  CONFIRMADA
  PENDIENTE_REVISION   // OCR-IA no pudo estructurar bien, o confianza baja
  PENDIENTE_CATEGORIA  // transferencia a persona sin categoría resuelta (ver ContactoCategoria)
}

model Transaccion {
  id                     String             @id @default(cuid())
  monto                  Decimal            @db.Decimal(10, 2)
  moneda                 String             @default("ARS")
  montoUSD               Decimal?
  cotizacionUsada        Decimal?           // guardar SIEMPRE el TC del momento, nunca recalcular después

  comercio               String?            // opcional: obligatorio de facto en Apple Pay/OCR, opcional en Manual
  origen                 OrigenTransaccion
  cuentaId               String
  cuenta                 Cuenta             @relation(fields: [cuentaId], references: [id])
  categoria              Categoria
  subcategoriaId         String?
  subcategoria           Subcategoria?      @relation(fields: [subcategoriaId], references: [id])
  fecha                  DateTime
  estado                 EstadoTransaccion  @default(CONFIRMADA)

  idempotencyKey         String             @unique
  textoCrudoOCR          String?            // debug/auditoría del OCR

  transferenciaFondeoId  String?            // opcional: vínculo a la transferencia que fondeó este gasto
  transferenciaFondeo    TransferenciaInterna? @relation(fields: [transferenciaFondeoId], references: [id])

  createdAt              DateTime           @default(now())
}
```

**Idempotency key:** hash determinístico de
`origen|monto|comercio|fecha_truncada_a_minuto`. Truncar a minuto (no
segundo) es deliberado: absorbe reintentos de red del Atajo de iOS sin
generar duplicados ni falsos negativos.

---

## Compra / Cuota (compras en cuotas de tarjeta de crédito)

```prisma
enum EstadoCuota {
  PROYECTADO
  CONFIRMADO   // el RESUMEN que la incluye fue pagado — no se confirma cuota por cuota
  OMITIDO      // anulación, devolución
}

model Compra {
  id              String   @id @default(cuid())
  montoTotal      Decimal
  comercio        String
  fechaCompra     DateTime
  cantidadCuotas  Int      @default(1)
  cuentaId        String   // cuenta tipo TARJETA_CREDITO
  cuenta          Cuenta   @relation(fields: [cuentaId], references: [id])

  cuotas          Cuota[]
}

model Cuota {
  id               String       @id @default(cuid())
  compraId         String
  compra           Compra       @relation(fields: [compraId], references: [id])
  numeroCuota      Int
  monto            Decimal
  fechaImputacion  DateTime     // a qué resumen cae, calculado con diaCierre de la Cuenta — NO fechaCompra
  estado           EstadoCuota  @default(PROYECTADO)
  transaccionId    String?      // todas las cuotas de un mismo resumen apuntan a la MISMA transacción de pago
}
```

Regla clave: **una `Cuota` nunca se confirma individualmente.** Se confirma
en bloque cuando se confirma el pago del `Resumen` que la incluye (ver
`03-reglas-de-negocio-financieras.md`).

---

## Resumen / InstanciaResumen (tarjeta de crédito, nivel consolidado)

```prisma
enum EstadoResumen {
  PENDIENTE
  PAGADO_TOTAL
  PAGADO_PARCIAL   // ej: se pagó el mínimo
}

model Resumen {
  id                    String        @id @default(cuid())
  cuentaId              String        // Cuenta tipo TARJETA_CREDITO
  cuenta                Cuenta        @relation(fields: [cuentaId], references: [id])
  periodo               String        // "2026-08"

  // CAPTURADOS del resumen real (OCR de PDF/mail del banco o carga manual) — NUNCA calculados
  montoTotalInformado    Decimal      // consumos + intereses + impuestos + saldo financiado previo
  montoMinimoInformado   Decimal
  totalConsumosInformado Decimal?     // usado para reconciliación contra suma de Cuotas del período

  montoPagado            Decimal?
  fechaPago              DateTime?
  saldoFinanciado         Decimal     @default(0) // se lee del próximo resumen, no se calcula
  metodoPagoMinimo        MetodoPagoRecurrente @default(DEBITO_AUTOMATICO)
  estado                  EstadoResumen @default(PENDIENTE)
}

model InstanciaResumen {
  id             String   @id @default(cuid())
  resumenId      String
  resumen        Resumen  @relation(fields: [resumenId], references: [id])
  montoEsperado  Decimal
  fechaEsperada  DateTime
  metodoPago     MetodoPagoRecurrente
  estado         EstadoInstanciaRecurrente @default(PROYECTADO)
}
```

---

## GastoRecurrente / InstanciaGastoRecurrente

```prisma
enum TipoMonto {
  FIJO       // Netflix, alquiler: monto conocido de antemano
  VARIABLE   // luz, internet, préstamos con cuota variable: no hay dato hasta la factura
}

enum Frecuencia {
  SEMANAL
  QUINCENAL
  MENSUAL
  ANUAL
}

enum MetodoPagoRecurrente {
  DEBITO_AUTOMATICO   // se ejecuta solo, PUEDE fallar si no hay fondos
  MANUAL
}

enum EstadoInstanciaRecurrente {
  PROYECTADO
  CONFIRMADO
  OMITIDO
}

model GastoRecurrente {
  id                  String       @id @default(cuid())
  nombre              String
  tipoMonto           TipoMonto
  montoFijo           Decimal?     // solo si tipoMonto = FIJO
  categoria           Categoria
  subcategoriaId       String?
  activo              Boolean      @default(true)
  cuentaId            String       // cuenta ESPERADA (puede diferir de la real al confirmar)
  cuenta              Cuenta       @relation(fields: [cuentaId], references: [id])
  metodoPago          MetodoPagoRecurrente

  frecuencia          Frecuencia
  diaDelMes           Int?         // MENSUAL o ANUAL — rango completo 1-31, sin subconjunto arbitrario
  diaDeSemana         Int?         // SEMANAL (0-6)
  mesDelAño           Int?         // ANUAL (1-12)
  intervaloQuincenal  DateTime?    // fecha ancla

  notas               String?      @db.VarChar(60)
}

model InstanciaGastoRecurrente {
  id                  String   @id @default(cuid())
  gastoRecurrenteId   String
  gastoRecurrente     GastoRecurrente @relation(fields: [gastoRecurrenteId], references: [id])

  fechaVencimiento    DateTime
  monto               Decimal?           // null si tipoMonto = VARIABLE y no llegó la factura
  montoEsEstimado     Boolean  @default(false)  // true si es un promedio histórico, no un dato real
  estado              EstadoInstanciaRecurrente @default(PROYECTADO)

  cuentaRealId        String?            // se llena SOLO al confirmar, puede diferir de gastoRecurrente.cuentaId
  transaccionId       String?
}
```

---

## TransferenciaInterna

```prisma
model TransferenciaInterna {
  id              String   @id @default(cuid())
  cuentaOrigenId  String
  cuentaOrigen    Cuenta   @relation("TransferOrigen", fields: [cuentaOrigenId], references: [id])
  cuentaDestinoId String
  cuentaDestino   Cuenta   @relation("TransferDestino", fields: [cuentaDestinoId], references: [id])

  monto           Decimal
  fecha           DateTime @default(now())
  nota            String?  @db.VarChar(60)

  createdAt       DateTime @default(now())
}
```

**Nunca** debe alimentar reportes de "gastos" o "ingresos" del período. Sí
debe alimentar el cálculo de saldo de cada `Cuenta` individual (ver
`03-reglas-de-negocio-financieras.md`, sección Reconciliación).

---

## ContactoCategoria (mapeo aprendido para transferencias a personas)

```prisma
model ContactoCategoria {
  id              String    @id @default(cuid())
  nombreDetectado String    @unique  // normalizado: sin mayúsculas/tildes/espacios extra
  categoria       Categoria
  subcategoriaId  String?
  aliasCBU        String?
  usoCount        Int       @default(0)
}
```

Se alimenta la primera vez que aparece un nombre nuevo en una transferencia
(el usuario asigna categoría una sola vez); de ahí en adelante, matching
automático. Ver `03-reglas-de-negocio-financieras.md` para el flujo completo.
