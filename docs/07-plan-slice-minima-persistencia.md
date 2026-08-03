# Plan de Slice Minima de Persistencia

## Objetivo

Preparar el backend para que el frontend pueda trabajar con datos reales de
cuentas, movimientos y resumen mensual, sin duplicar reglas de negocio ni
inventar datos en la interfaz.

Esta slice no implementa todavía toda la PWA. Cierra el contrato mínimo de
persistencia y lectura necesario para construir el Home, la carga manual y el
listado de movimientos.

## Convencion monetaria

`Transaccion.monto` se persiste con signo:

- Gasto: monto negativo. Ejemplo: `-150`.
- Ingreso: se mantiene modelado en `Ingreso`, no se crea una `Transaccion`.
- Transferencia interna: se persiste únicamente en `TransferenciaInterna`.

El saldo derivado de una cuenta es:

```text
saldoActual = saldoInicial
            + suma(Transaccion confirmadas)
            - transferencias salientes
            + transferencias entrantes
```

Ejemplo:

```text
saldoInicial = 500
gasto = -150
saldoActual = 350
```

La API puede recibir un gasto como monto positivo desde la UI. La capa de
servicio debe normalizarlo a negativo antes de persistirlo. La UI no debe
obligar al usuario a escribir el signo.

## Alcance

### Incluido

- Normalización de signos en la creación de gastos manuales y OCR.
- Corrección de `calcularSaldo()` y sus pruebas.
- Alta y listado de cuentas.
- Listado filtrable de transacciones.
- Resumen mensual centralizado.
- DTOs explícitos para todas las respuestas.
- Error DTO único para todos los errores HTTP.
- Tests de dominio y HTTP de los nuevos contratos.

### Fuera de esta slice

- Frontend conectado a datos reales.
- IndexedDB y cola offline.
- Web Push.
- Confirmación de gastos recurrentes.
- Confirmación de resúmenes.
- Motor completo de cuotas y reconciliación de tarjetas.
- Dashboard de gráficos avanzados.

## Contratos API

Todos los endpoints requieren `Authorization: Bearer <API_TOKEN>` y nunca
devuelven entidades ORM directamente.

### Crear cuenta

```http
POST /api/v1/cuentas
```

Payload mínimo:

```json
{
  "nombre": "Banco principal",
  "tipo": "CUENTA_BANCARIA",
  "saldoInicial": "500"
}
```

La respuesta es `CuentaResponseDTO`.

### Listar cuentas

```http
GET /api/v1/cuentas
```

Respuesta: `CuentaResponseDTO[]`.

Cada saldo se calcula con `calcularSaldo()` al momento de responder. No se
agrega ni se usa un campo persistido `saldoActual`.

### CuentaResponseDTO

```typescript
interface CuentaResponseDTO {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  banco?: string;
  ultimosDigitos?: string;
  colorIdentificador?: string;
  saldoInicial: number;
  saldoActual: number;
  diaCierre?: number;
  diaPago?: number;
}
```

`CuentaResumenDTO` continúa siendo el tipo compartido para cuentas anidadas
dentro de otras respuestas. No se redefinen sus campos inline.

### Listar transacciones

```http
GET /api/v1/transacciones
```

Query params opcionales:

- `cuentaId`
- `periodo` con formato `YYYY-MM`
- `categoria`
- `estado`
- `page`, default `1`
- `limit`, default `20`, máximo `100`

Respuesta:

```typescript
interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
}
```

El tipo de item es `TransaccionResponseDTO`. El listado no incluye

### Resumen mensual

```http
GET /api/v1/resumen-mensual?periodo=2026-08
```

Respuesta:

```typescript
interface ResumenMensualDTO {
  periodo: string;
  ingresos: number;
  gastos: number;
  ahorro: number;
  margen: number;
  gastosPorCategoria: GastoCategoriaDTO[];
  disponibleLiquido: number;
  deudaTarjetas: number;
}

interface GastoCategoriaDTO {
  categoria: Categoria;
  monto: number;
  porcentaje: number;
}
```

Reglas:

- `gastos` se expone como monto positivo, aunque las transacciones se
  persistan con signo negativo.
- `ingresos` se calcula desde `Ingreso`.
- `gastosPorCategoria` consulta únicamente `Transaccion` confirmadas.
- Las transferencias internas nunca aparecen como gasto ni ingreso.
- `disponibleLiquido` suma cuentas de activos, excluyendo tarjetas.
- `deudaTarjetas` representa la deuda de cuentas `TARJETA_CREDITO` por
  separado.
- Los meses sin movimientos no se presentan como datos inventados: los
  agregados deben distinguir ausencia de datos de un cero real cuando el
  contrato lo requiera.

## Servicios y responsabilidades

### Normalizacion de montos

Crear una función de dominio reutilizable para gastos:

```typescript
function normalizarMontoGasto(monto: string | number): string;
```

Reglas:

- Acepta formatos numéricos válidos.
- Rechaza monto cero o inválido.
- Convierte siempre a valor negativo.
- Conserva precisión decimal compatible con el schema.
- No cambia el signo de una transacción existente durante una lectura.

### Saldo

`calcularSaldo(cuentaId)` debe:

1. Leer `Cuenta.saldoInicial`.
2. Sumar únicamente `Transaccion` con `estado = CONFIRMADA`.
3. Restar transferencias salientes.
4. Sumar transferencias entrantes.
5. No modificar ninguna fila.

### Agregacion mensual

Crear una única función de agregación para que Home y Análisis no implementen
cálculos independientes. Esta función debe consultar solamente las fuentes
correspondientes a cada concepto y excluir transferencias de los reportes
económicos.

## Migracion de datos

La base actual contiene transacciones históricas creadas antes de formalizar la
convención de signos. No se debe invertir automáticamente el signo de todas
las filas existentes: algunos movimientos pueden tener significado distinto y
una migración ciega podría corromper saldos reales.

Antes de producción:

1. Auditar transacciones existentes y clasificarlas.
2. Definir una migración explícita por lote o un reset de la base local de
   desarrollo.
3. Verificar saldo por cuenta antes y después.
4. Ejecutar los tests de regresión de saldo.

## DTOs

Crear mappers explícitos:

- `toCuentaDTO(cuenta, saldoCalculado)`
- `toTransaccionDTO({ transaccion, cuenta })`
- `toResumenMensualDTO(data)`
- `toPaginatedDTO(items, page, limit, total)`

Toda cuenta anidada debe componerse mediante `toCuentaResumenDTO()`.

## Tests de aceptación

### Dominio

- Crear gasto de `150` persiste `-150`.
- Crear gasto de `-150` no lo transforma en `150`.
- Gasto confirmado reduce saldo.
- Gasto pendiente no modifica saldo.
- Corrección OCR confirma y reduce saldo una sola vez.
- Reintento idempotente no duplica el gasto.
- Transferencia no crea `Transaccion`.
- Transferencia reduce origen y aumenta destino mediante `calcularSaldo()`.
- `saldoInicial` no cambia en ningún flujo.

### HTTP

- `POST /api/v1/cuentas` devuelve `CuentaResponseDTO`.
- `GET /api/v1/cuentas` devuelve saldos derivados.
- `GET /api/v1/transacciones` devuelve paginación y DTOs, sin campos ORM no
  expuestos.
- Los filtros de transacciones funcionan por cuenta, período, categoría y
  estado.
- `GET /api/v1/resumen-mensual` calcula gastos solo desde transacciones.
- Las transferencias no alteran totales de gastos ni ingresos.
- Los errores usan `ErrorResponseDTO`.
- Las cuentas dentro de respuestas usan `CuentaResumenDTO`.

## Orden de ejecucion

1. Implementar y probar `normalizarMontoGasto()`.
2. Ajustar creación manual/OCR y tests de signos.
3. Ajustar `calcularSaldo()` y tests de saldos.
4. Agregar DTO completo de cuenta.
5. Implementar `POST/GET /api/v1/cuentas`.
6. Implementar `GET /api/v1/transacciones` con paginación y filtros.
7. Implementar el servicio único de resumen mensual.
8. Implementar `GET /api/v1/resumen-mensual`.
9. Agregar tests HTTP de todos los contratos.
10. Recién después conectar el frontend a datos reales.

## Criterio de terminado

La slice está terminada cuando el frontend puede:

- crear y listar cuentas;
- consultar el saldo derivado de cada cuenta;
- registrar un gasto y recibir el saldo actualizado en la respuesta;
- listar movimientos reales con filtros;
- consultar ingresos, gastos y categorías de un período;
- distinguir disponible líquido de deuda de tarjetas;
- hacerlo sin que ninguna transferencia interna aparezca como gasto o ingreso;
- recibir errores con el contrato único de error.
