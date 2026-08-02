# PRD 00 — Visión General y Principios de Arquitectura

## 1. Qué es este producto

PWA de finanzas personales, **uso individual (no multi-tenant)**, pensada para el
contexto financiero argentino: tarjetas de crédito con cuotas, pago mínimo,
resúmenes con impuestos/percepciones, billeteras virtuales múltiples,
transferencias como método de pago dominante, e ingresos con fecha de cobro
desacoplada del período que financian.

Se apoya en tres canales de captura de gastos:

- **Flujo A — Apple Pay / Wallet:** automatización iOS (Atajos) disparada por
  pago NFC. Requiere confirmación del usuario (limitación de iOS, no evitable).
- **Flujo B — OCR vía Share Sheet:** captura de pantalla de comprobantes
  (transferencias, QR, Mercado Pago/MODO) → Live Text (on-device, gratis) →
  texto crudo → backend → modelo de IA liviano estructura el dato en JSON.
- **Flujo C — Carga manual:** formulario rápido en la PWA, con soporte
  offline (IndexedDB).

## 2. Principios de diseño que gobiernan TODO el sistema

Estos principios son no negociables y deben aplicarse consistentemente en
cualquier feature nueva. Se derivaron de errores reales encontrados auditando
una app de referencia (Finnwise) contra datos reales del usuario.

### 2.1 Capturá, no repliques fórmulas que no controlás
Cuando un dato depende de variables externas que el sistema no puede conocer
con certeza (interés de financiación de tarjeta, impuestos/percepciones,
límite de crédito disponible, tasa vigente), **no se calcula internamente**.
Se captura desde la fuente oficial (resumen del banco) y se guarda tal cual.
Un dato ausente es honesto; un dato mal calculado con apariencia de precisión
es peligroso.

### 2.2 Nunca confirmes un movimiento de dinero por el paso del tiempo
Todo compromiso de pago (recurrente, cuota, resumen) nace en estado
`PROYECTADO`. Solo pasa a `CONFIRMADO` por evidencia real: matching automático
contra una transacción capturada, o confirmación explícita del usuario.
**Nunca** se asume "ya se pagó" solo porque venció la fecha. Este es el
principio que evita el bug central encontrado en la app de referencia:
gastos recurrentes ejecutados automáticamente que descuentan saldo sin
verificar que el dinero para cubrirlos efectivamente existía.

### 2.3 Cada peso se cuenta una sola vez, en el lugar correcto
- Una **transferencia entre cuentas propias** no es gasto ni ingreso — no debe
  aparecer en reportes de "gastos del período" bajo ninguna circunstancia.
- El **pago de un resumen de tarjeta** no es, en su mayoría, gasto nuevo: es
  la liquidación de compras que ya se contabilizaron en el momento de
  comprar. Solo el interés/impuestos/comisiones del resumen son gasto nuevo
  genuino.
- Toda función que agregue "gastos del período" debe ser una **única fuente
  de verdad**, consumida por todas las pantallas (home, análisis, etc.). Dos
  implementaciones separadas del mismo cálculo divergen tarde o temprano.

### 2.4 Separá "cuándo pasó" de "a qué período pertenece"
Aplica en tres lugares distintos con el mismo patrón:
- `Ingreso.fechaCobro` vs `Ingreso.periodoDisponible` (cobrás el último día
  hábil de un mes, esa plata financia el mes siguiente).
- `Cuota.fechaImputacion` (a qué resumen de tarjeta cae, según cierre) vs
  `Compra.fechaCompra` (cuándo se hizo la compra).
- Cualquier gasto recurrente cuyo vencimiento de calendario no coincide con
  el período que afecta.

### 2.5 No inventes un dato que no existe en ninguna fuente
Ejemplos: la categoría de una transferencia a una persona (el nombre no
contiene esa información — se resuelve con un mapeo aprendido, no con IA
adivinando), o el monto de un gasto recurrente variable antes de que llegue
la factura (se muestra como estimado o ausente, nunca como dato cierto).

### 2.6 Complejidad proporcional a la incertidumbre
Usar IA (modelo liviano de texto) solo donde hay incertidumbre real de
extracción (OCR de comprobantes con layout variable, resúmenes de tarjeta).
No usar IA para confirmar datos que el sistema ya conoce (ej. gastos
recurrentes con monto fijo ya cargado — ahí alcanza un toggle sí/no).

### 2.7 YAGNI con criterio
No automatizar lo que se puede resolver con un proceso humano simple y poco
frecuente (ej. calcular "último día hábil" con calendario de feriados
argentinos vs. simplemente elegir "período siguiente" al cargar el ingreso
a mano). Automatizar solo cuando el costo manual empieza a doler.

## 3. Alcance explícitamente fuera de la v1

- Multi-usuario / multi-tenant.
- Integración bancaria real (Open Banking / scraping de home banking).
- Motor de amortización de préstamos con tasa variable (UVA) — se captura,
  no se calcula.
- Réplica de fórmula de interés de financiación de tarjeta — se captura del
  resumen real.
- Gestión de metas de ahorro (mencionado como posible extensión futura).

## 4. Documentos relacionados

- `01-modelo-de-datos.md` — schema completo de entidades y relaciones.
- `02-flujos-de-captura.md` — Apple Pay, OCR-IA, Manual, Transferencias.
- `03-reglas-de-negocio-financieras.md` — máquinas de estado, tarjetas de
  crédito, categorización, reconciliación.
- `04-api-y-arquitectura-tecnica.md` — endpoints, idempotencia, seguridad,
  notificaciones push.
- `05-ux-ui-guidelines.md` — patrones de interfaz validados contra una app
  de referencia real.
