# Backlog

## Épicas

### EPIC-1: Dominio y persistencia
- [ ] Definir esquema de datos según `docs/01-modelo-de-datos.md`.
- [ ] Implementar migraciones y modelo ORM.
- [ ] Crear servicios de dominio para `Cuenta`, `Transaccion`, `Resumen`, `Compra`, `Cuota`, `TransferenciaInterna`, `Ingreso`.
- [ ] Implementar cálculo de saldo derivado y regla de `saldoInicial + movimientos`.
- [ ] Asegurar `Decimal` para montos y no permitir edición directa de saldo.

### EPIC-2: API y reglas de negocio
- [ ] Implementar `POST /api/v1/gastos`.
- [ ] Implementar `POST /api/v1/gastos/ocr` con manejo de fallo y estado `PENDIENTE_REVISION`.
- [ ] Implementar `POST /api/v1/resumenes/ocr`.
- [ ] Implementar `POST /api/v1/transferencias`.
- [ ] Implementar `POST /api/v1/recurrentes/:id/confirmar`.
- [ ] Implementar `POST /api/v1/resumenes/:id/confirmar`.
- [ ] Implementar `POST /api/v1/transacciones/:id/categoria`.
- [ ] Implementar idempotencia de transacciones basada en `origen|monto|comercio|fecha`.
- [ ] Añadir validación de entrada con Zod o esquema equivalente.
- [ ] Añadir autenticación Bearer token y CORS restringido.

### EPIC-3: UI/UX de PWA
- [ ] Diseñar navegación principal: Home, Movimientos, Agregar, Análisis, Metas.
- [ ] Implementar formulario de nuevo gasto/ingreso.
- [ ] Implementar listado de movimientos con filtros y estado visual.
- [ ] Implementar widget de `Pendientes/Vencidos`.
- [ ] Implementar alta/edición de cuentas con tarjetas de crédito.
- [ ] Implementar transferencia entre cuentas propias.
- [ ] Reusar componentes clave: selector de categoría, selector de cuentas, campo de nota, selector de fecha.

### EPIC-4: Captura e integración de plataforma
- [ ] Documentar y validar payload del Atajo iOS para Apple Pay.
- [ ] Implementar matching de cuenta por `ultimosDigitos`.
- [ ] Implementar flujo OCR con Live Text + IA.
- [ ] Agregar soporte offline básico con IndexedDB.

### EPIC-5: Pruebas y calidad
- [ ] Escribir tests unitarios para servicios de dominio.
- [ ] Escribir tests de integración para endpoints.
- [ ] Verificar reglas de tarjetas, confirmación y doble conteo.
- [ ] Configurar CI básica y herramientas de lint/format.

## Estado del Sprint 1

Sprint 1 completado en backend:
- Definición del esquema y migraciones.
- Lógica de dominio `crearTransaccion()` con idempotencia y balance derivado.
- Endpoint `POST /api/v1/gastos` con validación básica.
- Tests de integración/unitarios y CI configurado.
- Merge a `main` realizado en https://github.com/rafaric/finnances/pull/11.

## Prioridad Sprint 2

1. Implementar `POST /api/v1/gastos/ocr` con manejo de fallos y estado `PENDIENTE_REVISION`.
	- Valida la entrada OCR/IA y no genera 500s por datos incompletos.
	- Crea transacciones provisionales con estado `PENDIENTE_REVISION` cuando no se puede confirmar automáticamente.
	- Permite corrección posterior sin duplicar la operación.

2. Implementar `POST /api/v1/transferencias`.
	- Ajusta ambos saldos en una transacción DB atómica.
	- Registra la transferencia y genera la transacción asociada con idempotencia.

3. Implementar `POST /api/v1/transacciones/:id/categoria`.
	- Reasigna categoría sin romper la idempotencia original.
	- Valida existencia y pertenencia de la transacción.

4. Iniciar la UI PWA de nuevo gasto y listado de movimientos.
	- Crear pantalla de onboarding de gasto con monto, cuenta, categoría y fecha.
	- Mostrar movimientos recientes con estado y saldo calculado.

5. Documentar API y reglas de balance en `docs/04-api-y-arquitectura-tecnica.md`.
	- Explicar `saldoInicial + movimientos` como fuente única de verdad.
	- Definir contratos de los endpoints implementados.

## Próximas tareas (alta prioridad)

- Implementar `POST /api/v1/gastos/ocr` con manejo de fallo y estado `PENDIENTE_REVISION`.
	- Descripción: Endpoint que recibe datos OCR/IA, crea transacción provisional y retorna 202 cuando debe revisarse.
	- Criterios de aceptación:
		- Valida la entrada OCR/IA y no genera 500s por datos incompletos.
		- Crea transacciones en estado `PENDIENTE_REVISION` cuando no se puede confirmar automáticamente.
		- Permite una ruta de corrección posterior sin duplicar la operación.

- Implementar `POST /api/v1/transferencias`.
	- Descripción: Servicio y endpoint para transferencias internas entre cuentas propias.
	- Criterios de aceptación:
		- Ajusta ambos saldos en una transacción DB atómica.
		- Registra la transferencia y genera la transacción asociada con idempotencia.

- Implementar `POST /api/v1/transacciones/:id/categoria`.
	- Descripción: Endpoint para reasignar la categoría de una transacción ya existente.
	- Criterios de aceptación:
		- Valida que la transacción existe y pertenece al usuario.
		- Actualiza la categoría sin alterar la idempotencia original.

- Avanzar en UI/UX de PWA: formulario y listado de movimientos.
	- Descripción: Comenzar el frontend con el flujo de nuevo gasto y la vista de movimientos.

- Documentar el contrato de API y los flujos de balance.
	- Descripción: Actualizar `docs/04-api-y-arquitectura-tecnica.md` con los endpoints actuales y el cálculo de `saldoInicial + movimientos`.
