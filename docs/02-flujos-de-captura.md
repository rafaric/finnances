# PRD 02 — Flujos de Captura de Transacciones

## Flujo A — Apple Pay / Wallet (automatización iOS)

**Disparador:** evento nativo "Al realizar un pago sin contacto con mi
tarjeta o pase de Wallet" (Atajos de iOS).

**Limitación de plataforma a documentar en el producto, no a intentar
evitar:** cualquier Personal Automation de Atajos que incluya una acción de
red requiere confirmación del usuario por defecto (Apple lo fuerza por
seguridad). Se puede desactivar "Preguntar antes de ejecutar", pero eso
también desactiva la notificación de confirmación. **No vender esto como
"0 toques"** — el toque real es "confirmar en la notificación del Atajo".

**Proceso:**
1. iOS captura `monto`, `comercio`, `tarjeta`, `fecha`.
2. El Atajo hace `POST /api/v1/gastos` con esos datos.
3. Backend persiste (ver idempotencia en `04-api-y-arquitectura-tecnica.md`)
   y dispara Web Push de confirmación.
4. `resolverCuenta()` hace matching automático de la `Cuenta` correcta por
   `ultimosDigitos` extraídos del texto de tarjeta (`"Visa **** 1234"` →
   `1234`).

## Flujo B — OCR vía Share Sheet (transferencias, QR, comprobantes)

Este es el flujo de **mayor volumen real** en el contexto argentino (>80%
de los pagos del usuario son transferencia/QR, no NFC).

**Proceso:**
1. Usuario comparte una captura de pantalla del comprobante.
2. Acción nativa "Extraer texto de la imagen" (Apple Live Text) — **gratis,
   on-device**. Este paso resuelve el OCR sin costo; no reinventar esto.
3. El texto crudo (desordenado, sin estructura fija) se envía a
   `POST /api/v1/gastos/ocr`.
4. Backend llama a un modelo de IA liviano (Gemini Flash / GPT-4o-mini /
   Claude Haiku o equivalente) con un prompt que exige **respuesta JSON
   estricta, sin texto adicional**.
5. Se parsea el JSON con try/catch obligatorio. Si falla o el modelo
   alucina, la transacción se guarda igual con `estado: PENDIENTE_REVISION`
   y `textoCrudoOCR` completo — nunca se pierde el dato, nunca se rompe el
   flujo con un 500.

**Por qué mandar texto y no imagen al modelo de IA:** los tokens de imagen
son 10-50x más caros que texto equivalente. El trabajo de "ver" ya lo hizo
gratis Live Text; pagarle a un modelo de visión para resolver lo mismo es
desperdiciar presupuesto. Costo estimado con esta arquitectura: fracciones
de centavo de dólar por transacción, para el volumen de un usuario
individual eso es centavos al mes.

**Prompt de referencia (ajustar según proveedor elegido):**
```
Extraé de este texto: monto, comercio, fecha, y si aparece, el límite
disponible informado y si es una transferencia a una persona física
(esTransferenciaAPersona: boolean).
Respondé SOLO JSON, sin texto adicional:
{monto, comercio, fecha, limiteDisponibleInformado: number|null,
 esTransferenciaAPersona: boolean}
```

**Ramificación por tipo de destinatario:**
- Si `esTransferenciaAPersona = true` → no intentar inferir categoría por
  nombre (el nombre de una persona no contiene esa información). Usar
  `ContactoCategoria` (ver `03-reglas-de-negocio-financieras.md`).
- Si es comercio → la categoría puede inferirse razonablemente del nombre
  del comercio, con posibilidad de ajuste manual.

**Matching de límite disponible de tarjeta:** si el texto de una
notificación bancaria incluye "límite disponible: $X", capturarlo en
`Cuenta.limiteDisponible` / `limiteActualizadoEn`. Nunca calcular este
número — ver principio 2.1 en `00-vision-general.md`.

**Ingesta de Resumen de tarjeta (variante del mismo pipeline):**
`POST /api/v1/resumenes/ocr` recibe el texto extraído del PDF/mail del
resumen (o vía Share Sheet + Live Text si es una captura). El prompt cambia
para extraer: `saldoActual`, `pagoMinimo`, `fechaVencimientoActual`,
`fechaProximoCierre`, `totalConsumosDelMes`, `interesFinanciacion`. Mismo
manejo de fallo → `PENDIENTE_REVISION`, nunca se descarta el dato.

## Flujo C — Carga Manual

**Disparador:** apertura directa de la PWA, vista `/nuevo-gasto`.

**Diseño de formulario (validado contra patrones de UI reales, ver
`05-ux-ui-guidelines.md`):**
- Monto grande, teclado numérico, arriba de todo.
- Fecha con shortcuts "Hoy"/"Ayer" + selector completo como fallback.
- Categoría como grid de un toque (7 categorías fijas del enum).
- Método de pago (Cuenta) con selector + default razonable.
- **Comercio es opcional en este flujo** (a diferencia de Apple Pay/OCR,
  donde viene gratis del dato fuente). Pedirlo a mano en carga manual es
  fricción sin beneficio — la categoría ya alcanza para reportes.
- Soporte offline vía IndexedDB si no hay conexión; sincroniza al
  reconectar.

## Transferencias entre cuentas propias (flujo separado, no es "gasto")

Ver modelo `TransferenciaInterna` en `01-modelo-de-datos.md`. UI: selector
Origen/Destino tipo cards, monto, "Disponible: $X" de la cuenta origen
mostrado antes de confirmar, fecha con default "hoy", nota opcional
(máx. 60 caracteres). **Nunca se registra como `Transaccion`.**

## Confirmación de compromisos pendientes (recurrentes, resúmenes)

No es un flujo de captura de dato nuevo — es una **acción de confirmación**
sobre datos que ya existen en el sistema como `PROYECTADO`. Se resuelve con
un widget único ("Pendientes de confirmar / Vencidos") reusado para
recurrentes, resúmenes y transferencias sin categorizar. Ver
`03-reglas-de-negocio-financieras.md` para el detalle de la máquina de
estados y `05-ux-ui-guidelines.md` para el diseño del widget.
