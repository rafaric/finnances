-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('EFECTIVO', 'BILLETERA_VIRTUAL', 'CUENTA_BANCARIA', 'TARJETA_CREDITO');

-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('COMIDA', 'TRANSPORTE', 'VIVIENDA', 'SERVICIOS', 'OCIO', 'DEUDAS', 'OTROS');

-- CreateEnum
CREATE TYPE "OrigenTransaccion" AS ENUM ('APPLE_PAY', 'OCR_IA', 'MANUAL', 'RECURRENTE_CONFIRMADO', 'RESUMEN_CONFIRMADO');

-- CreateEnum
CREATE TYPE "EstadoTransaccion" AS ENUM ('CONFIRMADA', 'PENDIENTE_REVISION', 'PENDIENTE_CATEGORIA');

-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('PROYECTADO', 'CONFIRMADO', 'OMITIDO');

-- CreateEnum
CREATE TYPE "EstadoResumen" AS ENUM ('PENDIENTE', 'PAGADO_TOTAL', 'PAGADO_PARCIAL');

-- CreateEnum
CREATE TYPE "TipoMonto" AS ENUM ('FIJO', 'VARIABLE');

-- CreateEnum
CREATE TYPE "Frecuencia" AS ENUM ('SEMANAL', 'QUINCENAL', 'MENSUAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "MetodoPagoRecurrente" AS ENUM ('DEBITO_AUTOMATICO', 'MANUAL');

-- CreateEnum
CREATE TYPE "EstadoInstanciaRecurrente" AS ENUM ('PROYECTADO', 'CONFIRMADO', 'OMITIDO');

-- CreateTable
CREATE TABLE "Cuenta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "banco" TEXT,
    "ultimosDigitos" TEXT,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "esCuentaPuente" BOOLEAN NOT NULL DEFAULT false,
    "colorIdentificador" TEXT,
    "saldoInicial" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "diaCierre" INTEGER,
    "diaPago" INTEGER,
    "diasRecordatorio" INTEGER DEFAULT 3,
    "limiteCompra" DECIMAL(65,30),
    "limiteDisponible" DECIMAL(65,30),
    "limiteActualizadoEn" TIMESTAMP(3),
    "saldoActualizadoEn" TIMESTAMP(3),

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingreso" (
    "id" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "fechaCobro" TIMESTAMP(3) NOT NULL,
    "periodoDisponible" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,

    CONSTRAINT "Ingreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcategoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "Categoria" NOT NULL,

    CONSTRAINT "Subcategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaccion" (
    "id" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "montoUSD" DECIMAL(65,30),
    "cotizacionUsada" DECIMAL(65,30),
    "comercio" TEXT,
    "origen" "OrigenTransaccion" NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "subcategoriaId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoTransaccion" NOT NULL DEFAULT 'CONFIRMADA',
    "idempotencyKey" TEXT NOT NULL,
    "textoCrudoOCR" TEXT,
    "transferenciaFondeoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL,
    "montoTotal" DECIMAL(10,2) NOT NULL,
    "comercio" TEXT NOT NULL,
    "fechaCompra" TIMESTAMP(3) NOT NULL,
    "cantidadCuotas" INTEGER NOT NULL DEFAULT 1,
    "cuentaId" TEXT NOT NULL,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuota" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "numeroCuota" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fechaImputacion" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCuota" NOT NULL DEFAULT 'PROYECTADO',
    "transaccionId" TEXT,

    CONSTRAINT "Cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resumen" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "montoTotalInformado" DECIMAL(10,2) NOT NULL,
    "montoMinimoInformado" DECIMAL(10,2) NOT NULL,
    "totalConsumosInformado" DECIMAL(65,30),
    "montoPagado" DECIMAL(65,30),
    "fechaPago" TIMESTAMP(3),
    "saldoFinanciado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "metodoPagoMinimo" "MetodoPagoRecurrente" NOT NULL DEFAULT 'DEBITO_AUTOMATICO',
    "estado" "EstadoResumen" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "Resumen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanciaResumen" (
    "id" TEXT NOT NULL,
    "resumenId" TEXT NOT NULL,
    "montoEsperado" DECIMAL(10,2) NOT NULL,
    "fechaEsperada" TIMESTAMP(3) NOT NULL,
    "metodoPago" "MetodoPagoRecurrente" NOT NULL,
    "estado" "EstadoInstanciaRecurrente" NOT NULL DEFAULT 'PROYECTADO',

    CONSTRAINT "InstanciaResumen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoRecurrente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoMonto" "TipoMonto" NOT NULL,
    "montoFijo" DECIMAL(65,30),
    "categoria" "Categoria" NOT NULL,
    "subcategoriaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "cuentaId" TEXT NOT NULL,
    "metodoPago" "MetodoPagoRecurrente" NOT NULL,
    "frecuencia" "Frecuencia" NOT NULL,
    "diaDelMes" INTEGER,
    "diaDeSemana" INTEGER,
    "mesDelAno" INTEGER,
    "intervaloQuincenal" TIMESTAMP(3),
    "notas" VARCHAR(60),

    CONSTRAINT "GastoRecurrente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanciaGastoRecurrente" (
    "id" TEXT NOT NULL,
    "gastoRecurrenteId" TEXT NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(65,30),
    "montoEsEstimado" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoInstanciaRecurrente" NOT NULL DEFAULT 'PROYECTADO',
    "cuentaRealId" TEXT,
    "transaccionId" TEXT,

    CONSTRAINT "InstanciaGastoRecurrente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferenciaInterna" (
    "id" TEXT NOT NULL,
    "cuentaOrigenId" TEXT NOT NULL,
    "cuentaDestinoId" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferenciaInterna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactoCategoria" (
    "id" TEXT NOT NULL,
    "nombreDetectado" TEXT NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "subcategoriaId" TEXT,
    "aliasCBU" TEXT,
    "usoCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContactoCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaccion_idempotencyKey_key" ON "Transaccion"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Transaccion_transferenciaFondeoId_key" ON "Transaccion"("transferenciaFondeoId");

-- CreateIndex
CREATE UNIQUE INDEX "Cuota_transaccionId_key" ON "Cuota"("transaccionId");

-- CreateIndex
CREATE UNIQUE INDEX "InstanciaGastoRecurrente_transaccionId_key" ON "InstanciaGastoRecurrente"("transaccionId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactoCategoria_nombreDetectado_key" ON "ContactoCategoria"("nombreDetectado");

-- AddForeignKey
ALTER TABLE "Ingreso" ADD CONSTRAINT "Ingreso_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "Subcategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_transferenciaFondeoId_fkey" FOREIGN KEY ("transferenciaFondeoId") REFERENCES "TransferenciaInterna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "Transaccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resumen" ADD CONSTRAINT "Resumen_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanciaResumen" ADD CONSTRAINT "InstanciaResumen_resumenId_fkey" FOREIGN KEY ("resumenId") REFERENCES "Resumen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoRecurrente" ADD CONSTRAINT "GastoRecurrente_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "Subcategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoRecurrente" ADD CONSTRAINT "GastoRecurrente_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanciaGastoRecurrente" ADD CONSTRAINT "InstanciaGastoRecurrente_gastoRecurrenteId_fkey" FOREIGN KEY ("gastoRecurrenteId") REFERENCES "GastoRecurrente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanciaGastoRecurrente" ADD CONSTRAINT "InstanciaGastoRecurrente_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "Transaccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaInterna" ADD CONSTRAINT "TransferenciaInterna_cuentaOrigenId_fkey" FOREIGN KEY ("cuentaOrigenId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaInterna" ADD CONSTRAINT "TransferenciaInterna_cuentaDestinoId_fkey" FOREIGN KEY ("cuentaDestinoId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
