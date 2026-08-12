# Atajos OCR y Wallet / Apple Pay

## Estado publicado

- El atajo OCR compartido debe usar el backend público de Cloud Run, no una IP local.
- Los pagos capturados desde Wallet se guardan como `PENDIENTE_REVISION` y aparecen en la PWA para confirmar antes de afectar el saldo.

El Atajo se dispara con la automatización personal de iOS **Al realizar un pago sin contacto**.

## Acción de red

Agregar una acción `Obtener contenido de URL` con:

- Método: `POST`
- URL: `https://finnances-backend-844688226186.us-east1.run.app/api/v1/gastos/wallet`
- Headers: `Authorization: Bearer TU_API_TOKEN`, `Content-Type: application/json`
- Cuerpo JSON:

```json
{
  "monto": 12500,
  "comercio": "Comercio recibido por Wallet",
  "tarjeta": "Visa terminada en 1234",
  "fecha": "2026-08-09T15:30:00.000Z",
  "idempotencyKey": "wallet-<identificador-del-evento>"
}
```

El campo `tarjeta` debe conservar los últimos cuatro dígitos. El backend los usa para resolver la cuenta. La clave debe ser estable durante los reintentos del mismo evento.

## Resultado Wallet

- `202`: movimiento guardado como pendiente de revisión para confirmarlo desde la PWA.

La automatización de iOS puede requerir confirmación del usuario cuando ejecuta una acción de red. No se debe presentar como una automatización completamente sin interacción.

## Atajo OCR actualizado

En el atajo `Crear gasto`, reemplazar únicamente la URL de la acción `Obtener contenido de URL`:

```text
https://finnances-backend-844688226186.us-east1.run.app/api/v1/gastos/ocr
```

El token Bearer se configura localmente en el dispositivo y no debe publicarse en GitHub ni en este documento.

## Atajo Apple Pay

Crear una automatización personal de Atajos con el disparador **Al realizar un pago sin contacto**. Usar la entrada automática de la automatización para construir el JSON y enviarlo a `/api/v1/gastos/wallet`:

```json
{
  "monto": "Importe del evento Wallet",
  "comercio": "Comercio del evento Wallet",
  "tarjeta": "Tarjeta del evento Wallet",
  "fecha": "Fecha del evento Wallet",
  "idempotencyKey": "apple-pay-<identificador estable del evento>"
}
```

La respuesta esperada es `202`. El movimiento aparecerá en **Inicio → Para resolver** dentro de la PWA. El atajo debe mostrar una notificación indicando que el pago quedó pendiente de confirmación.
