# PRD 06 — Plan de Desarrollo

## 1. Objetivo

Construir una PWA de finanzas personales para un único usuario, enfocada en el contexto financiero argentino, con captura de gastos por:
- Apple Pay / Wallet,
- OCR vía Share Sheet,
- carga manual.

El MVP debe manejar cuentas, transacciones, tarjetas en cuotas, resúmenes de tarjeta, transferencias internas y compromisos proyectados sin multi-tenancy ni scraping bancario.

## 2. Alcance MVP

Incluye:
- Modelo de datos completo según `01-modelo-de-datos.md`.
- Endpoints API básicos de captura, OCR, transferencias y confirmaciones.
- Lógica de negocio de saldo derivado, confirmación de compromisos y reconciliación de tarjetas.
- UI/UX de PWA para agregar gastos, ver movimientos, revisar pendientes/vencidos y administrar cuentas.
- Manejo de idempotencia, validación de entrada y fallos del IA sin interrumpir el flujo.

Queda fuera de la v1:
- Multi-usuario / multi-tenant.
- Integración bancaria formal (Open Banking, scraping).
- Motor de amortización de préstamos variable.
- Cálculo de límites de tarjeta o cuotas financieros extrapolados.

## 3. Fases de desarrollo

### Fase 0 — Preparación y decisiones técnicas

1. Elegir stack:
   - Backend: Node.js/TypeScript + framework ligero (Fastify/Nest/Express).
   - ORM: Prisma o equivalente compatible con el modelo conceptual.
   - Frontend PWA: React/Vite, SvelteKit o similar.
   - Base de datos: PostgreSQL (recomendado), MySQL o SQLite para prototipo.
2. Crear repositorio, monorepo o arquitectura de servicios según preferencia.
3. Configurar CI básica, linting, formateo y entorno de desarrollo.
4. Añadir documento de arquitectura inicial con los endpoints y contratos.

### Fase 1 — Dominio y persistencia

1. Implementar el esquema de datos a partir de `01-modelo-de-datos.md`.
2. Crear migraciones y seed inicial si corresponde.
3. Implementar servicios de dominio centrales:
   - `crearTransaccion()` con idempotencia.
   - `saldo(cuenta)` derivado.
   - `reconciliarResumen()` y reglas de doble conteo.
   - generación de proyecciones de recurrentes.
 
### Decisión: política de balance (saldo)

- `saldoInicial` se mantiene como campo inmutable que se carga al alta de la cuenta.
- No se introduce `saldoActual` persistido por ahora; el balance mostrado en UI se calcula con una función `calcularSaldo()` que parte de `saldoInicial` y suma los movimientos aplicables.
- Si en el futuro se decide cachear el balance por performance, se añadirá `saldoActual` como campo desnormalizado que SOLO se actualizará automáticamente dentro de la misma transacción DB que crea el movimiento (no editable por usuarios ni endpoints externos).

4. Validación de modelos con Zod o esquema equivalente.

### Fase 2 — API y lógica de negocio

1. Implementar endpoints:
   - `POST /api/v1/gastos`
   - `POST /api/v1/gastos/ocr`
   - `POST /api/v1/resumenes/ocr`
   - `POST /api/v1/transferencias`
   - `POST /api/v1/recurrentes/:id/confirmar`
   - `POST /api/v1/resumenes/:id/confirmar`
   - `POST /api/v1/transacciones/:id/categoria`
2. Centralizar la lógica de creación/persistencia en una capa de servicio común.
3. Implementar idempotencia con clave basada en `origen|monto|comercio|fechaTruncada`.
4. Manejar fallos de IA sin 500s: crear transacción en estado `PENDIENTE_REVISION` y devolver 202.
5. Agregar seguridad mínima:
   - Autorización Bearer token,
   - CORS restringido,
   - validación estricta en el borde.

### Fase 3 — UX/UI de PWA

1. Estructurar navegación principal: Home, Movimientos, Agregar, Análisis, Metas.
2. Implementar formulario `Nuevo gasto/ingreso` con reglas de `05-ux-ui-guidelines.md`.
3. Implementar widget de `Pendientes/Vencidos` reutilizable.
4. Implementar listado de movimientos con filtros y estado claro.
5. Crear flujo de transferencia entre cuentas propias.
6. Implementar alta/edición de cuentas, incluyendo tarjetas de crédito con día de cierre/pago.
7. Respetar la regla de fuente única de verdad para cálculos de gastos del período.

### Fase 4 — Integración de captura y plataforma

1. Documentar e integrar flujo de Apple Pay/Wallet:
   - payload del Atajo iOS,
   - endpoint de persistencia,
   - matching de cuenta por `ultimosDigitos`.
2. Implementar flujo OCR con Live Text y API de IA:
   - enviar texto crudo,
   - parsear JSON estricto,
   - fallback a revisión manual.
3. Agregar soporte offline básico con IndexedDB para captura manual.

### Fase 5 — Quality, pruebas y lanzamiento

1. Definir suite de pruebas:
   - unitarias para servicios de dominio,
   - integración para endpoints,
   - e2e para flujos críticos si se decide.
2. Probar idempotencia, estados de confirmación y reglas de tarjeta.
3. Verificar UX de pendientes/vencidos y reglas de carga manual.
4. Preparar despliegue mínimo, variables de entorno y documentación de ejecución.

### Fase 6 — Pulido y extensiones tempranas

1. Web Push para notificaciones de confirmación y recordatorios.
2. Dashboard de análisis básico con balance mensual y categoría.
3. Mejoras de UX: autocompletar contactos, mapeo `ContactoCategoria`, tags rápidos.
4. Documentar los flujos iOS/Share Sheet para QA y usuarios.

## 4. Backlog inicial

### Núcleo de datos
- Cuenta
- Ingreso
- Categoría/Subcategoría
- Transacción
- Compra/Cuota
- Resumen
- TransferenciaInterna
- ContactoCategoria
- GastoRecurrente e InstanciaRecurrente

### Flujos de ingreso
- Captura Apple Pay
- OCR+IA de comprobantes
- Carga manual
- Transferencias internas
- Confirmación de recurrentes y resúmenes

### Reglas de negocio
- Saldo derivado
- Confirmación `PROYECTADO -> CONFIRMADO`
- Evitar doble conteo en tarjetas
- Reconciliación de cuentas puente
- Manejo de `PENDIENTE_REVISION` y `PENDIENTE_CATEGORIA`

### Infra / calidad
- API REST con validación
- Autorización Bearer
- Idempotencia
- Documentación de endpoints
- Tests unitarios e integración

## 5. Estado y recomendación de prioridades

El modelo de datos, el saldo derivado, la captura manual, OCR con fallback,
transferencias, categorías, movimientos y pruebas base ya están implementados.

1. Recurrentes: proyecciones, confirmación y omisión.
2. Tarjetas: compras en cuotas, resúmenes y reconciliación.
3. QA: tests E2E, CI, lint/formato y reset de la base de test.
4. Integraciones: Atajo iOS, matching de cuenta y offline básico.

## 6. Resultado esperado para v1

Un MVP funcional capaz de:
- capturar gastos desde al menos un canal automático y manual,
- mantener la integridad de saldo sin doble conteo,
- mostrar pendientes/vencidos y permitir confirmarlos,
- manejar tarjetas de crédito con compras en cuotas y resúmenes,
- operar como PWA de un solo usuario con seguridad básica.
