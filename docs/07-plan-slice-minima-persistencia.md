# Plan de Frontend: Primera Vertical Real

## Objetivo

Convertir el scaffold React/Vite existente en una primera vertical funcional
de la PWA Finnances, conectada a los contratos reales del backend.

La primera vertical se enfoca exclusivamente en **registrar gastos**. No se
implementa todavía la carga manual de ingresos porque el backend aún no tiene
un endpoint para ese flujo.

## Design Read

PWA personal de finanzas para un usuario individual, mobile-first, con una
interfaz calma y contable, basada en la estética verde sobria ya existente.

Principios visuales:

- Una sola paleta verde con fondos claros y modo oscuro equivalente.
- Densidad media, priorizando lectura rápida y contexto.
- Sin estética de dashboard SaaS genérico.
- Sin datos ficticios: estados vacíos honestos cuando todavía no hay datos.
- Controles táctiles claros y navegación inferior persistente.

## Alcance de la Primera Vertical

### Incluido

- Configuración de conexión por token durante la sesión.
- Onboarding y alta de cuenta.
- Listado de cuentas reales.
- Home conectado a cuentas y resumen mensual.
- Registro manual de gastos.
- Listado de movimientos reales.
- Análisis mensual básico.
- Estados de carga, error, vacío y éxito.
- Responsive mobile-first.

### Fuera de alcance

- Alta manual de ingresos.
- Toggle Gasto/Ingreso.
- Transferencias desde la interfaz.
- OCR y corrección de pendientes.
- Recurrentes y resúmenes.
- IndexedDB y cola offline.
- Web Push.
- Metas de ahorro.
- Gráficos avanzados o librerías de visualización.

## Contratos Backend Disponibles

El frontend consumirá estos endpoints existentes:

- `POST /api/v1/cuentas`
- `GET /api/v1/cuentas`
- `POST /api/v1/gastos`
- `GET /api/v1/transacciones`
- `GET /api/v1/resumen-mensual?periodo=YYYY-MM`

Todos requieren:

```http
Authorization: Bearer <API_TOKEN>
```

Las respuestas usan DTOs explícitos y los errores tienen esta forma:

```typescript
interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
```

## Arquitectura Frontend

### Stack

- React 19.
- Vite.
- TypeScript.
- CSS existente, sin agregar una librería visual todavía.
- Estado local con hooks de React; no agregar estado global hasta que exista
  una necesidad real.
- No agregar router en esta primera vertical: la navegación actual por estado
  es suficiente y mantiene el bundle pequeño.

### Estructura objetivo

```text
frontend/src/
  api/
    client.ts
    types.ts
  components/
    AccountSelector.tsx
    CategorySelector.tsx
    DateField.tsx
    EmptyState.tsx
    ErrorState.tsx
    LoadingState.tsx
    MoneyInput.tsx
    BottomNavigation.tsx
    CuentaResumen.tsx
  features/
    onboarding/
    home/
    gastos/
    movimientos/
    analisis/
  lib/
    formatters.ts
  App.tsx
  index.css
```

La estructura puede crecer por feature, pero cada componente compartido debe
tener una única implementación.

## Slice 1: Conexión y Onboarding

### Conexión

- Mantener el token únicamente en `sessionStorage` durante desarrollo.
- No usar variables `VITE_*` para secretos: Vite las expone en el bundle.
- La pantalla solicita solo el token, no un `accountId` manual.
- Después de autenticar, `GET /api/v1/cuentas` determina las cuentas
  disponibles.

### Sin cuentas

Si el token es válido pero no hay cuentas:

- mostrar onboarding de alta de cuenta;
- no mostrar Home vacío;
- explicar que el saldo actual será derivado y no editable.

### Alta de cuenta

Campos:

- nombre;
- tipo;
- saldo inicial;
- banco opcional;
- últimos dígitos opcionales;
- color identificador;
- día de cierre y pago para tarjetas.

Para `TARJETA_CREDITO`:

- preseleccionar saldo negativo;
- usar copy orientado a deuda: “¿Cuánto debés actualmente?”;
- mostrar el saldo actual como dato derivado, no como input editable.

## Slice 2: Home Real

Al cargar el Home, consultar en paralelo:

- `GET /api/v1/cuentas`;
- `GET /api/v1/resumen-mensual?periodo=YYYY-MM`.

Mostrar:

- selector horizontal de mes;
- disponible líquido;
- deuda de tarjetas separada;
- ingresos del período como dato de resumen, no como acción de carga;
- gastos del período;
- ahorro y margen;
- sección colapsada de “Mis cuentas” con contador;
- acciones rápidas.

Acciones activas:

- `Registrar gasto`.

Acciones futuras, no visibles como botones deshabilitados:

- transferir;
- recurrentes;
- asistente.

Estados:

- skeleton durante carga;
- error contextual con reintento;
- empty state si el período no tiene movimientos;
- onboarding si no existen cuentas.

Los valores deben venir del `ResumenMensualDTO`. El frontend no recalcula
gastos ni categorías.

## Slice 3: Registrar Gasto

### Formulario

El formulario muestra únicamente un flujo de gasto. No incluye toggle
Gasto/Ingreso.

Orden:

1. Monto grande con teclado numérico.
2. Fecha con shortcuts “Hoy” y “Ayer” más selector completo.
3. Selector de cuenta con saldo actual.
4. Selector de categoría con las siete categorías fijas.
5. Nota opcional, máximo 60 caracteres.
6. Acción `Registrar gasto`.

La UI envía el monto positivo. El backend lo normaliza y persiste negativo.

### Envío

```http
POST /api/v1/gastos
```

Después de una respuesta exitosa:

- mostrar el saldo recalculado incluido en `TransaccionResponseDTO`;
- actualizar cuentas;
- actualizar resumen mensual;
- actualizar movimientos;
- volver al Home o mostrar confirmación contextual.

Errores:

- `BAD_REQUEST`: mostrar validación cerca del formulario;
- `UNAUTHORIZED`: solicitar nuevamente conexión;
- `INTERNAL_ERROR`: conservar datos del formulario y permitir reintentar.

## Slice 4: Movimientos

Consumir:

```http
GET /api/v1/transacciones
```

Filtros:

- período;
- cuenta;
- categoría;
- estado;
- paginación.

Cada movimiento debe mostrar:

- categoría;
- comercio si existe;
- fecha;
- cuenta;
- estado;
- monto con formato monetario;
- origen manual u OCR.

Los gastos se almacenan con signo negativo, pero la UI puede mostrar el monto
como egreso con formato visual claro. No se deben convertir silenciosamente
los datos recibidos antes de decidir cómo presentarlos.

Las transferencias internas no aparecen en este listado porque no son gastos
ni ingresos económicos.

Estados:

- loading skeleton;
- lista vacía con CTA `Registrar gasto`;
- error con reintento;
- paginación sin duplicar items.

## Slice 5: Análisis

Consumir el mismo endpoint del Home:

```http
GET /api/v1/resumen-mensual?periodo=YYYY-MM
```

Mostrar:

- ingresos;
- gastos;
- ahorro;
- margen;
- lista de gastos por categoría ordenada por monto;
- porcentajes devueltos por backend.

No recalcular totales en frontend. No mostrar gráficos avanzados hasta tener
una necesidad concreta y una librería justificada.

Los períodos sin datos deben comunicarse como ausencia de movimientos, no como
un rendimiento financiero falso de cero.

## Componentes Compartidos Obligatorios

- `AccountSelector`: lista cuentas y saldo actual.
- `CategorySelector`: grid único de siete categorías.
- `DateField`: Hoy, Ayer y selector completo.
- `MoneyInput`: entrada positiva para gastos.
- `CuentaResumen`: representación compacta de cuenta y saldo.
- `LoadingState`: skeletons según la forma final.
- `EmptyState`: mensaje y acción contextual.
- `ErrorState`: mensaje del `ApiError` y reintento.
- `BottomNavigation`: Inicio, Movimientos, (+), Análisis y Metas.

## Cliente API

Centralizar en `frontend/src/api/`:

- URL base desde `VITE_API_URL`.
- Header Bearer.
- `response.ok` y parseo de `ApiError`.
- Tipos espejo de los DTOs backend.
- Funciones por recurso:
  - `listCuentas()`;
  - `crearCuenta()`;
  - `listTransacciones()`;
  - `crearGasto()`;
  - `getResumenMensual()`.

Ningún componente debe construir URLs ni headers manualmente.

## Orden de Implementacion

1. Validar el scaffold actual con `npm install`, `npm run build` y lint.
2. Separar el cliente API y los tipos de DTO.
3. Implementar conexión por token y carga de cuentas.
4. Implementar onboarding de alta de cuenta.
5. Implementar Home real con cuentas y resumen mensual.
6. Implementar `AccountSelector` y conectarlo al formulario.
7. Implementar registro manual de gasto.
8. Implementar Movimientos con filtros y paginación.
9. Implementar Análisis reutilizando el resumen mensual.
10. Agregar tests de cliente, componentes y flujos críticos.
11. Verificar responsive, modo claro/oscuro y accesibilidad.

## Criterios de Terminado

La primera vertical frontend está terminada cuando el usuario puede:

- conectar la PWA con un token durante la sesión;
- crear una cuenta si todavía no tiene ninguna;
- ver sus cuentas y saldos derivados;
- ver disponible líquido y deuda de tarjetas por separado;
- registrar únicamente gastos manuales;
- recibir feedback con el saldo actualizado;
- consultar movimientos reales con filtros;
- consultar análisis mensual real;
- navegar entre Inicio, Movimientos, Agregar, Análisis y Metas;
- distinguir loading, vacío y error sin datos ficticios;
- usar la interfaz en móvil y escritorio.

## Siguientes Slices

- Transferencias entre cuentas.
- OCR y corrección de pendientes.
- Widget unificado de pendientes/vencidos.
- Alta de ingresos cuando exista el contrato backend.
- Recurrentes y resúmenes.
- IndexedDB y soporte offline.
- Web Push.
- Metas de ahorro.
