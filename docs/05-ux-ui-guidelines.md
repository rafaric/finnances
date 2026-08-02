# PRD 05 — UX/UI Guidelines

> Patrones validados contrastando el diseño contra una app de referencia real
> (Finnwise) usada por el propio usuario, incluyendo bugs reales encontrados
> con datos reales — cada corrección acá tiene un caso concreto detrás, no es
> una preferencia estética arbitraria.

## 1. Jerarquía general de pantallas

Bottom nav de 4-5 secciones + FAB central: **Inicio, Movimientos, (+),
Análisis, Metas**. Patrón validado: número grande arriba → contexto →
detalle desagregado abajo. Reusar esta jerarquía en el home.

## 2. Home

- Selector de mes horizontal tipo pills (`Jun 2026 / Jul 2026 / Aug 2026`),
  mes activo resaltado en negro.
- Card superior oscura con el número más importante — **pero nunca un
  "Disponible" único que mezcle activos y pasivos** (ver
  `03-reglas-de-negocio-financieras.md` sección 1). Mostrar por separado:
  "Disponible líquido" (activos) y "Deuda tarjetas" (pasivos), o un tercer
  número de "Proyectado disponible del período" que sea explícito sobre
  que es una proyección, no un hecho.
- Cards de Ingresos / Gastos del período, con iconografía de flecha
  (↓ verde ingresos, ↑ rojo gastos).
- Sección "Mis cuentas" colapsada con contador (ej. "9"), no lista completa
  siempre visible — evita saturar el home.
- Grid de "Acciones rápidas" (Agregar, Transferir, Recurrentes, Asistente)
  en vez de menú de navegación tradicional.

## 3. Widget de "Pendientes / Vencidos" (pieza central del diseño)

Reusar el mismo componente para tres casos distintos:
1. Recurrentes/resúmenes en `PROYECTADO` esperando confirmación.
2. Transacciones OCR con `PENDIENTE_REVISION`.
3. Transferencias a personas con `PENDIENTE_CATEGORIA`.

```
🟡 Pendientes de confirmar
─────────────────────────────
Resumen NBCH — $155.540
Vence 06/Ago · Débito automático
[Cuenta: NBCH ▾]      [✓ Confirmar]
─────────────────────────────
Netflix — $4.500
Vence 15/Ago · Manual
[Cuenta: Prex ▾]      [✓ Confirmar]
```

El selector de cuenta viene **pre-cargado con la cuenta esperada** como
default, pero editable — cubre el caso de pagar con otra billetera por
promoción puntual.

## 4. Formulario "Nueva transacción" (Flujo C)

Orden validado:
1. Toggle Gasto / Ingreso.
2. Monto grande, teclado numérico (`$ 0.00` placeholder).
3. Fecha: shortcuts "Hoy" / "Ayer" + chevron a selector completo — no
   limitar a un subconjunto fijo de fechas.
4. Método de pago (Cuenta), con card + chevron a detalle.
5. Categoría: grid de 7 iconos fijos (Comida, Transporte, Vivienda,
   Servicios, Ocio, Deudas, Otros).
6. Nota opcional, límite 60 caracteres.

**No incluir campo "Comercio" obligatorio en este formulario** — en carga
manual la categoría ya es suficiente información para reportes; pedir el
comercio a mano es fricción sin beneficio real (a diferencia de Apple
Pay/OCR, donde ese dato viene gratis de la fuente).

## 5. Formulario "Nuevo gasto/ingreso recurrente"

- Mismo grid de Categoría que el formulario de transacción — **un solo
  componente reusado**, no reimplementarlo dos veces.
- Tags rápidos de nombre (Netflix, Spotify, Renta, Luz, Agua, Internet,
  Gym) que autocompletan nombre + categoría + ícono — reduce fricción de
  carga real.
- Selector de frecuencia: Semanal / Quincenal / Mensual / Anual (no asumir
  que todo es mensual).
- Selector de día: shortcuts de días comunes (1, 5, 10, 15, 20, 25, 28) +
  opción "Otro día" con selector abierto 1-31. **El rango completo es
  necesario** — un vencimiento de tarjeta puede caer en cualquier día (ej.
  día 13), y forzarlo al shortcut más cercano rompe la precisión del
  recordatorio.
- Recordatorio configurable (1/2/3/5/7 días antes), no un valor fijo
  hardcodeado.
- Campo Monto: **debe permitir explícitamente "sin definir" o "variable"**
  cuando `tipoMonto = VARIABLE` — no forzar al usuario a inventar un número
  al crear el recurrente. (Bug real encontrado en la app de referencia:
  un gasto de "Internet" mostraba un monto ~10x mayor al real porque el
  monto se cargó una vez y quedó arrastrado sin corrección, al no existir
  la opción de dejarlo sin definir.)
- Campo Nota, límite 60 caracteres.

## 6. Alta/edición de Cuenta

- Tipo de método: Efectivo / Crédito / Débito / Otro — determina la
  semántica de signo del saldo inicial.
- Saldo inicial con toggle explícito Positivo/Negativo. Para
  `TARJETA_CREDITO`, pre-seleccionar "Negativo" con copy "¿Cuánto debés
  actualmente en esta tarjeta?" en vez de "¿Cuánto tenés?".
- Una vez cargado, el saldo actual **se muestra pero no es editable** — es
  dato derivado (ver `03-reglas-de-negocio-financieras.md` sección 1). No
  imitar un patrón donde el saldo actual sea un campo de texto libre
  editable en cualquier momento.
- Para `TARJETA_CREDITO`: campos "Día de corte" / "Día de pago" embebidos
  directo en el mismo formulario de alta de cuenta — no como entidad ni
  pantalla separada.
- Color identificador como selector de paleta fija.

## 7. Transferencia entre cuentas

- Selector Origen/Destino con cards grandes, flecha central.
- Lista "Desde" / "Hacia" con radio buttons, mostrando saldo de cada cuenta
  junto al nombre.
- Monto con teclado numérico + texto "Disponible: $X" de la cuenta origen
  mostrado debajo, antes de confirmar.
- Fecha con default "hoy", campo Nota opcional (60 caracteres).

## 8. Listado de Movimientos

- Search bar "Buscar por categoría, nota..." arriba de todo.
- Chips de filtro: Todos / Gastos / Ingresos + ícono de filtro avanzado +
  ícono de orden.
- Cada item: categoría (bold) → subcategoría + fecha (gris) → comercio
  (itálica) → monto (color según signo) → badge de tipo (Gasto/Ingreso/
  Transferencia entrante).
- Ícono distintivo (ej. rayo) para movimientos originados automáticamente
  (Apple Pay / débito automático) vs carga manual — ayuda al usuario a
  distinguir de un vistazo qué requirió su intervención y qué no.

## 9. Análisis / Reportes

- Balance mensual: Ingresos / Gastos / Ahorros / Margen, en cards.
- Distribución por categoría: donut chart + lista con monto y porcentaje
  por categoría, ordenada de mayor a menor.
- Tendencia de últimos N meses: gráfico de barras. **Los meses sin datos
  deben representarse explícitamente como "sin datos", nunca como barra en
  cero** — mismo principio de honestidad de datos que rige el resto del
  sistema (evita interpretar "no cargué nada este mes" como "gasté cero").

### 9.1 Regla crítica: fuente única de verdad para "Gastos del período"

**Toda pantalla que muestre un total de "Gastos del mes" (home, análisis,
cualquier reporte futuro) debe consumir la misma función de agregación.**
No implementar el cálculo de forma independiente en cada vista.

Caso real que motiva esta regla: en la app de referencia, el home mostraba
un total de Gastos distinto al de la pantalla de Análisis para el mismo
mes, con una diferencia exacta igual al monto de una transferencia interna
entre cuentas propias — una pantalla la excluía correctamente, la otra la
sumaba como gasto. Sin una única fuente de verdad, esta clase de
divergencia es prácticamente garantizada con el tiempo.

## 10. Principio de consistencia de componentes

Los siguientes elementos deben ser **un único componente reusado**, no
reimplementaciones independientes por pantalla:
- Selector de Categoría (grid de 7 iconos).
- Card de selección de Cuenta/Método de pago.
- Campo de Nota (60 caracteres).
- Selector de fecha con shortcuts + fallback abierto.
- Widget de "Pendientes/Vencidos".
