# Atajo Wallet / Apple Pay

El Atajo se dispara con la automatización personal de iOS **Al realizar un pago sin contacto**.

## Acción de red

Agregar una acción `Obtener contenido de URL` con:

- Método: `POST`
- URL: `https://TU_DOMINIO/api/v1/gastos/wallet`
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

## Resultado

- `201`: cuenta y categoría resueltas; movimiento confirmado.
- `202`: movimiento guardado como pendiente para resolver cuenta, categoría o datos faltantes.

La automatización de iOS puede requerir confirmación del usuario cuando ejecuta una acción de red. No se debe presentar como una automatización completamente sin interacción.
