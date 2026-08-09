# Backlog

## Estado actual

El MVP ya permite registrar y consultar gastos e ingresos manuales, administrar
cuentas y categorías, transferir entre cuentas, revisar pendientes OCR y
consultar el resumen mensual. El backend y el frontend tienen suites de tests
ejecutables de forma aislada.

## Entregado

### Dominio y persistencia

- [x] Esquema Prisma y migraciones PostgreSQL.
- [x] Saldo derivado desde `saldoInicial + movimientos`.
- [x] Montos `Decimal` y saldo no editable directamente.
- [x] Idempotencia para gastos, ingresos y transferencias.
- [x] Categorías y subcategorías gestionables.
- [x] Ingresos con categoría y subcategoría opcional.

### API y reglas de negocio

- [x] `POST /api/v1/gastos`.
- [x] `POST /api/v1/ingresos`.
- [x] `POST /api/v1/gastos/ocr` con estados pendientes.
- [x] `PATCH /api/v1/gastos/ocr/:id/corregir`.
- [x] `PATCH /api/v1/transacciones/:id/categoria`.
- [x] `POST /api/v1/transferencias`.
- [x] `POST /api/v1/resumenes/ocr`.
- [x] `GET /api/v1/transacciones` con filtros y paginación.
- [x] CRUD de categorías y subcategorías.
- [x] Bearer token, CORS restringido y validación Zod.

### PWA

- [x] Home con resumen mensual y cuentas.
- [x] Formulario de gasto e ingreso.
- [x] Selector de categorías con iconos y subcategorías opcionales.
- [x] Listado de movimientos con filtros.
- [x] Widget de pendientes OCR.
- [x] Alta y edición de cuentas.
- [x] Transferencias entre cuentas propias.
- [x] Administración de categorías.
- [x] Estado de error y reintento para el resumen mensual.

### Calidad y operación

- [x] Tests unitarios/de integración backend.
- [x] Tests frontend, incluyendo el flujo de ingresos.
- [x] Base de tests aislada en `finnances_test`.
- [x] Seed de categorías y subcategorías.

## Próximo slice: recurrentes y tarjetas

### Gastos recurrentes

- [ ] Crear `GastoRecurrente` con cuenta, categoría, frecuencia y monto fijo o variable.
- [ ] Generar instancias proyectadas sin afectar saldos.
- [ ] Confirmar una instancia contra una cuenta real.
- [ ] Omitir una instancia sin crear una transacción.
- [ ] Mostrar recurrentes proyectados y vencidos en la PWA.
- [ ] Cubrir idempotencia y transición `PROYECTADO -> CONFIRMADO/OMITIDO`.

### Tarjetas y resúmenes

- [ ] Registrar compras en cuotas y generar `Cuota` proyectadas.
- [ ] Ingresar y consultar resúmenes de tarjeta.
- [ ] Confirmar el pago de un resumen.
- [ ] Evitar doble conteo entre consumos, cuotas y pago del resumen.
- [ ] Mostrar deuda y próximos vencimientos en Home.
- [ ] Agregar tests de reconciliación y doble conteo.

## Después del próximo slice

- [x] Endpoint Wallet para payload del Atajo iOS/Apple Pay.
- [x] Matching automático de cuenta Wallet por `ultimosDigitos`.
- [ ] Mejorar confianza y corrección del OCR con IA.
- [x] Soporte offline básico para captura manual e ingresos.
- [ ] Tests E2E de los flujos críticos.
- [ ] CI con TypeScript, tests y formato/lint.
- [ ] Reset controlado de `finnances_test` entre ejecuciones.
- [ ] Documentar contratos API y flujos iOS/Share Sheet.

## Fuera de alcance de la v1

- Multiusuario o multitenancy.
- Open Banking o scraping bancario.
- Motor de amortización variable de préstamos.
- Cálculo avanzado de límites de tarjeta.
