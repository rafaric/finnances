# PRD 03 — Reglas de Negocio Financieras

## 1. Cálculo de saldo — siempre derivado, nunca editable

```
saldo(cuenta) = saldoInicial
              + Σ transacciones propias (Apple Pay, OCR, Manual, Recurrentes confirmados, Resúmenes confirmados)
              - Σ transferencias salientes
              + Σ transferencias entrantes
```

- Para `TARJETA_CREDITO`, `saldoInicial` se carga como **negativo** (es
  deuda). La misma fórmula de arriba funciona sin ramas condicionales: un
  gasto nuevo hace el número más negativo, un pago de resumen lo acerca a
  cero. No crear una función de cálculo separada para tarjetas.
- El usuario nunca edita el saldo directamente. Solo carga `saldoInicial`
  una vez, al alta de la cuenta.
- **No mostrar un único número "Disponible" que mezcle activos (efectivo,
  billeteras, cuentas bancarias) con pasivos (deuda de tarjeta).** Son
  preguntas distintas: "¿cuánto tengo para gastar hoy?" vs "¿cuál es mi
  patrimonio neto?". Mostrar ambos números por separado.

## 2. Máquina de estados: Proyectado → Confirmado → Omitido

Aplica a `InstanciaGastoRecurrente`, `InstanciaResumen`, y por extensión de
grupo a `Cuota` (vía confirmación del `Resumen` que la contiene).

**Regla de oro: nunca pasar de `PROYECTADO` a `CONFIRMADO` solo porque pasó
la fecha de vencimiento.** Se confirma únicamente por:

- **(a) Matching automático** contra una `Transaccion` real recién llegada
  (por Apple Pay o por compartir la notificación del banco vía OCR), usando
  ventana de fecha ± tolerancia y monto ± tolerancia de redondeo.
- **(b) Confirmación manual explícita del usuario**, desde el widget de
  "Pendientes/Vencidos" en el home.

`PROYECTADO` **nunca** entra en el cálculo de saldo de una `Cuenta` (sección
1). Solo entra en la vista de "proyección del mes" como compromiso futuro
no confirmado.

### 2.1 Generación diaria de proyecciones (recurrentes)

Job diario que, para cada `GastoRecurrente` activo cuya fecha de
vencimiento cae hoy:
- Si `tipoMonto = FIJO`: crea `InstanciaGastoRecurrente` con
  `monto = montoFijo`, `estado = PROYECTADO`.
- Si `tipoMonto = VARIABLE`: intenta `estimarMontoVariable()` (promedio de
  las últimas 3 instancias `CONFIRMADO` de ese mismo recurrente). Si hay
  estimación, se guarda con `montoEsEstimado = true`. Si no hay historial,
  `monto = null` — el sistema muestra el compromiso igual, sin inventar un
  número.
- El job **nunca** descuenta saldo ni crea una `Transaccion`. Solo genera la
  proyección y, si corresponde, dispara un push de aviso (chequeando saldo
  disponible de la cuenta esperada, solo para avisar, nunca para ejecutar).

### 2.2 Confirmación de recurrentes — cuenta real vs cuenta esperada

Al confirmar, el usuario elige la `Cuenta` real desde la que se pagó (puede
diferir de `gastoRecurrente.cuentaId`, ej. pagó con otra billetera por una
promoción puntual). El selector viene pre-cargado con la cuenta esperada
como default, pero debe permitir cambiarla. La confirmación:
1. Crea una `Transaccion` con `origen: RECURRENTE_CONFIRMADO`, reusando la
   misma función central `crearTransaccion()` que usan los demás orígenes
   (no crear un camino de persistencia paralelo).
2. Actualiza la `InstanciaGastoRecurrente` a `CONFIRMADO`, guarda
   `cuentaRealId` y `transaccionId`.

Copy dinámico según `metodoPago`:
- `DEBITO_AUTOMATICO` → "¿Se pudo realizar el débito automático?" (el
  usuario sabe si había fondos, el sistema no).
- `MANUAL` → "¿Ya pagaste esto?"

### 2.3 Débito automático fallido por falta de fondos

No modelar como un estado nuevo. Es el mismo `PROYECTADO` sin confirmar. La
diferencia la da el copy (2.2), no la máquina de estados — evita
multiplicar estados por cada matiz de negocio.

## 3. Cuotas y Resúmenes de tarjeta de crédito

### 3.1 Momento de carga: al momento de la compra, no al llegar el resumen

Toda compra en tarjeta se registra en el instante (Apple Pay / OCR /
Manual), generando `Compra` + N `Cuota` con `fechaImputacion` calculada
según `Cuenta.diaCierre` (no según `fechaCompra`). El `Resumen` **no es la
fuente de carga** — es una capa de verificación posterior. Perder este
orden rompe la visibilidad en tiempo real de la proyección mensual.

### 3.2 Confirmación a nivel Resumen, propagada a Cuotas

Un resumen se paga como un todo (no cuota por cuota). Al confirmar el pago
de un `Resumen`:
1. Todas las `Cuota` con `fechaImputacion` en ese período pasan a
   `CONFIRMADO`, sin importar si se pagó el total o el mínimo — su
   cronograma pactado no cambia.
2. Se registra el movimiento real por el monto efectivamente pagado
   (`montoPagado`), no por el total del resumen.
3. `estado` del `Resumen` pasa a `PAGADO_TOTAL` si `montoPagado >=
   montoTotalInformado`, si no `PAGADO_PARCIAL`.

### 3.3 Evitar doble conteo entre Cuotas y pago de Resumen

El pago del resumen **no es, en su mayoría, un gasto nuevo** — es la
liquidación de compras ya contabilizadas por categoría en el momento de
comprar. Al confirmar el pago:

```
montoYaContabilizado = Σ Cuota.monto imputadas a ese período (ya están en
                        Comida/Ocio/etc desde el momento de la compra)
cargosNuevos = Resumen.montoTotalInformado - montoYaContabilizado
             (interés de financiación + impuestos + percepciones + comisiones)
```

Solo `cargosNuevos` debe crear una `Transaccion` nueva bajo categoría
`DEUDAS` (subcategoría "Costo financiero tarjeta"). El resto del pago se
trata como liquidación de saldo, **sin volver a sumarse** a "gastos por
categoría del mes" — de lo contrario, cada peso gastado con tarjeta se
cuenta dos veces: una al comprar, otra al pagar el resumen.

### 3.4 Reconciliación resumen vs cuotas registradas

Al ingerir un `Resumen` (vía OCR o carga manual), comparar
`totalConsumosInformado` contra la suma de `Cuota.monto` imputadas a ese
período. Si la diferencia supera una tolerancia de centavos, no ajustar
silenciosamente — mostrar al usuario: puede indicar una compra no
capturada (transferencia sin OCR) o un cargo del banco no asociado a
compra propia.

### 3.5 Pago mínimo / deuda financiada

`saldoFinanciado` de un `Resumen` **se lee del próximo resumen real**
(el banco ya incluye ahí el interés cobrado por financiar) — nunca se
calcula con una fórmula propia. El objetivo de mostrar este número mes a
mes en el dashboard no es solo informativo: es el mecanismo de
comportamiento más efectivo para visibilizar el costo de pagar mínimo sin
que la app "sermonee" al usuario.

### 3.6 Límite disponible de tarjeta

No lineal respecto al monto de la compra (impuesto PAIS en dólares, CFT en
cuotas con interés, seguros, comisiones). **Nunca calcular** —
`Cuenta.limiteDisponible` se captura por OCR de notificación bancaria (si
el texto la incluye) o carga manual esporádica, con
`limiteActualizadoEn` para que la UI muestre "actualizado al [fecha]" en
vez de una falsa precisión.

## 4. Categorización de transferencias a personas

El nombre de un destinatario persona física no contiene información de
rubro (a diferencia de un comercio). No usar IA para "adivinar" — usar
`ContactoCategoria` como mapeo aprendido:

1. Primera vez que aparece un nombre: la `Transaccion` se guarda con
   `estado: PENDIENTE_CATEGORIA`, aparece en el widget de "Sin categorizar".
2. El usuario asigna categoría una vez, con checkbox "¿Guardar para futuros
   pagos a [nombre]?".
3. Si se guarda, se crea/actualiza `ContactoCategoria` — desde ahí, todo
   pago futuro a ese nombre se auto-categoriza sin fricción.
4. **Caso borde (no bloqueante para v1):** si el monto de una transacción
   auto-categorizada por `ContactoCategoria` se aleja mucho del promedio
   histórico para ese contacto (ej. 5x lo habitual), considerar mostrarla
   en el widget de revisión igual, en vez de aplicar la categoría a ciegas.

## 5. Reconciliación de cuentas puente

`Cuenta.esCuentaPuente = true` marca cuentas que, por patrón de uso, deben
tender a $0 (se fondean justo antes de un pago específico y se vacían casi
al instante — patrón común con billeteras usadas solo para recargas o
pagos puntuales).

Job periódico que calcula `saldo(cuenta)` para toda cuenta puente; si el
resultado se aleja de $0 más allá de una tolerancia mínima, dispara aviso:
puede indicar un `GastoRecurrente` que se ejecutó sin que su transferencia
de fondeo correspondiente llegara ese ciclo. Este chequeo existe
específicamente porque este tipo de agujero es **invisible en vistas
mensuales** (los movimientos del mes en curso pueden cerrar perfecto,
mientras el arrastre viene de un ciclo anterior) y solo se detecta
reconstruyendo el historial completo de la cuenta a mano — el objetivo es
que el sistema lo detecte antes de que el usuario tenga que hacerlo.

Vínculo opcional `Transaccion.transferenciaFondeoId` permite, cuando se
usa, auditar 1 a 1 qué transferencia cubrió qué gasto específico.
