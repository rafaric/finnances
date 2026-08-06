# PRD 04 — API y Arquitectura Técnica

## 1. Endpoints

Separados por responsabilidad — no todo converge en un único handler HTTP,
aunque sí converjan en una única función de negocio.

```
POST /api/v1/gastos                → Apple Pay + Manual (dato ya estructurado)
POST /api/v1/ingresos              → ingreso manual categorizado
POST /api/v1/gastos/ocr            → recibe texto crudo de Live Text, llama IA, estructura
PATCH /api/v1/gastos/ocr/:id/corregir → corrige un gasto OCR pendiente y lo confirma si queda completo
POST /api/v1/resumenes/ocr         → ingesta de resumen de tarjeta (texto de PDF/mail/captura)
POST /api/v1/transferencias        → movimiento entre cuentas propias
POST /api/v1/recurrentes/:id/confirmar   → confirma InstanciaGastoRecurrente
POST /api/v1/resumenes/:id/confirmar     → confirma pago de Resumen (propaga a Cuotas)
POST /api/v1/transacciones/:id/categoria → resuelve PENDIENTE_CATEGORIA (transferencias a personas)
GET /api/v1/transacciones          → movimientos combinados, filtros y paginación
GET/POST/PATCH /api/v1/categorias  → gestión de categorías
GET/POST/PATCH/DELETE /api/v1/subcategorias → gestión de subcategorías
```

**Por qué separar `/gastos` y `/gastos/ocr` en vez de un único endpoint:**
el flujo OCR necesita una etapa de interpretación con IA que los otros
orígenes no necesitan (manejo de fallo, parseo de JSON, fallback a
`PENDIENTE_REVISION`). Mezclar esa lógica condicional en un único handler
viola responsabilidad única a nivel de endpoint. Ambos endpoints deben
converger en la **misma función interna** `crearTransaccion()` para no
duplicar lógica de idempotencia/persistencia/push.

```typescript
// Patrón de referencia — capa de servicio separada del handler HTTP
async function crearTransaccion(data: TransaccionInput): Promise<Transaccion> {
  const idempotencyKey = generarIdempotencyKey(data);
  const existente = await db.transaccion.findUnique({ where: { idempotencyKey } });
  if (existente) return existente; // no es error, devolver 200

  const nueva = await db.transaccion.create({ data: { ...data, idempotencyKey } });
  await enviarWebPush(nueva); // fire and forget
  return nueva;
}
```

`confirmarInstanciaRecurrente()` y `confirmarPagoResumen()` también deben
llamar a esta misma función central — un cuarto/quinto origen
(`RECURRENTE_CONFIRMADO`, `RESUMEN_CONFIRMADO`) del mismo pipeline, nunca un
camino de persistencia paralelo.

## 2. Idempotencia

```typescript
function generarIdempotencyKey(data: {
  monto: number; comercio: string; fecha: string; origen: string;
}): string {
  const fechaTruncada = data.fecha.slice(0, 16); // truncar a MINUTO, no segundo
  const raw = `${data.origen}|${data.monto}|${data.comercio}|${fechaTruncada}`;
  return createHash('sha256').update(raw).digest('hex');
}
```

Truncar a minuto (no segundo) es deliberado: absorbe reintentos de red del
Atajo de iOS (1-2 segundos de diferencia entre intento original y retry) sin
generar duplicados. La clave es determinística a partir del **evento de
negocio**, no del timestamp exacto del request.

## 3. Validación de entrada

Usar un validador de schema (Zod o equivalente) en el borde de cada
endpoint — nunca confiar en el JSON crudo del request. Ejemplo de
requirement condicional:

```typescript
const transaccionSchema = z.object({
  monto: z.number().positive(),
  categoriaId: z.string(),
  subcategoriaId: z.string().optional(),
  comercio: z.string().optional(),
  origen: z.enum(['APPLE_PAY', 'OCR_IA', 'MANUAL', 'RECURRENTE_CONFIRMADO', 'RESUMEN_CONFIRMADO']),
}).refine(
  (data) => data.origen === 'MANUAL' || !!data.comercio,
  { message: 'comercio es requerido salvo en carga manual' }
);
```

## 4. Manejo de fallo del modelo de IA (OCR)

Nunca romper el flujo con un 500 ni descartar el dato silenciosamente.

```typescript
app.post('/api/v1/gastos/ocr', async (req, res) => {
  const { textoCrudo } = req.body;
  const estructurado = await interpretarConIA(textoCrudo);

  if (!estructurado.exito) {
    const pendiente = await crearTransaccion({
      ...estructurado.parcial,
      estado: 'PENDIENTE_REVISION',
      textoCrudoOCR: textoCrudo,
      origen: 'OCR_IA',
    });
    return res.status(202).json(pendiente); // 202 Accepted, no 201 — aceptado pero no confirmado
  }

  const transaccion = await crearTransaccion({ ...estructurado.datos, textoCrudoOCR: textoCrudo, origen: 'OCR_IA' });
  res.status(201).json(transaccion);
});
```

Prompt al modelo: exigir explícitamente "SOLO JSON, sin texto adicional,
sin backticks". Envolver siempre el `JSON.parse()` en try/catch.

### 4.1 Flujo de corrección de OCR pendiente

Cuando el parser OCR detecta el monto pero no puede inferir una categoría, la
transacción se guarda como `PENDIENTE_CATEGORIA` en lugar de `PENDIENTE_REVISION`.
Ese estado indica que hay suficiente información para crear el gasto, pero falta
la clasificación correcta de negocio.

- `POST /api/v1/gastos/ocr` crea el movimiento OCR.
- Si falta categoría y el monto está presente, devuelve `202 Accepted` con
  `estado: PENDIENTE_CATEGORIA`.
- El cliente debe corregir la categoría mediante:
  `PATCH /api/v1/gastos/ocr/:id/corregir`.
- Cuando la corrección aporta `categoriaId` válida, el backend actualiza el
  registro, confirma la transacción y ajusta el saldo de la cuenta.

Esto permite separar el reconocimiento de texto del paso de clasificación, con un
workflow claro para la UX de revisión de gastos.

## 5. Web Push

- Requiere la PWA **instalada** (Agregar a pantalla de inicio) y corriendo
  en modo standalone — `PushManager` no está disponible en Safari/iOS fuera
  de ese contexto. Documentar como requisito de onboarding duro, no
  opcional.
- VAPID keys para el protocolo Web Push estándar.
- Se dispara al confirmar persistencia exitosa de una `Transaccion` nueva
  (fire-and-forget, no bloquea la respuesta HTTP), y desde los jobs
  periódicos de recordatorio (vencimientos próximos, cuentas puente
  desbalanceadas).

## 6. Seguridad — ajustada al contexto de uso personal (no multi-tenant)

Para una app de un solo usuario, sobre-ingeniería de seguridad
multi-tenant (rotación automática de tokens, scopes granulares por
dispositivo) no aporta valor proporcional al esfuerzo. Alcanza con:

- Token Bearer estático en el header `Authorization` de las llamadas desde
  el Atajo de iOS.
- El Atajo en sí ya está protegido por el passcode/Face ID del dispositivo
  — cubre el vector "me roban el teléfono".
- Único riesgo real: compartir el archivo `.shortcut` (si alguna vez se
  comparte para pedir ayuda, en un foro, etc.) expone el token en texto
  plano dentro del archivo — quitarlo manualmente antes de compartir. Es un
  proceso humano, no algo a arquitecturar.
- CORS restringido al dominio propio de la PWA — no hay frontend de
  terceros consumiendo la API.

## 7. Persistencia de saldo

No hay tabla de "saldo actual" editable. Se calcula on-demand (ver
`03-reglas-de-negocio-financieras.md`, sección 1). Si el volumen de datos
lo justifica más adelante, se puede cachear con invalidación al insertar un
movimiento nuevo — optimización futura, no requisito de v1.
