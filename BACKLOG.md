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

## Prioridad de primer sprint

1. Definir schema de datos e implementar migraciones.
2. Implementar `crearTransaccion()` con idempotencia y cálculo de saldo.
3. Implementar `POST /api/v1/gastos` y validación básica.
4. Implementar formulario básico de nuevo gasto e inicio de la PWA.
5. Agregar tests unitarios para creación de transacciones y cálculo de saldo.
