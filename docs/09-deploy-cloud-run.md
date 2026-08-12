# Deploy de Finnances

## Estado actual

- Backend publicado en Cloud Run: `finnances-backend` / `us-east1`.
- Frontend publicado en Vercel: `https://finnances-rho.vercel.app`.
- El backend expone `GET /health` públicamente y protege las rutas de negocio con Bearer token.
- El frontend se publica desde el repositorio remoto mediante el proyecto conectado de Vercel.

## Requisitos

- Proyecto de Google Cloud con billing habilitado.
- `gcloud` autenticado.
- APIs de Cloud Run, Artifact Registry y Cloud Build habilitadas.
- Base PostgreSQL de producción en Neon.

## Variables requeridas

Configurar en Cloud Run, nunca dentro de la imagen:

- `DATABASE_URL`: URL pooled de PostgreSQL de Neon para el runtime.
- `API_TOKEN`: token Bearer usado por la PWA y el Atajo.
- `ALLOWED_ORIGIN`: URL de Vercel, por ejemplo `https://finnances.vercel.app`.
- `GEMINI_API_KEY`: clave del proveedor Gemini.
- `GEMINI_MODEL`: opcional; por defecto `gemini-flash-lite-latest`.

## Prueba local del contenedor

Desde `backend/`:

```bash
docker build -t finnances-backend .
docker run --rm -p 8080:8080 \
  -e DATABASE_URL="..." \
  -e API_TOKEN="..." \
  -e ALLOWED_ORIGIN="http://localhost:4173" \
  finnances-backend
```

Verificar el health check:

```bash
curl http://localhost:8080/health
```

## Migraciones

Aplicar migraciones contra Neon antes del primer tráfico:

```bash
DATABASE_URL="..." npx prisma migrate deploy
```

El contenedor no ejecuta migraciones automáticamente al arrancar. Esto evita que varias instancias intenten migrar simultáneamente.

## Build y deploy del backend

Crear un repositorio Docker en Artifact Registry y desplegar:

```bash
gcloud artifacts repositories create finnances \
  --repository-format=docker \
  --location=REGION

gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/finnances/backend:latest backend

gcloud run deploy finnances-backend \
  --image REGION-docker.pkg.dev/PROJECT_ID/finnances/backend:latest \
  --region REGION \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars NODE_ENV=production,ALLOWED_ORIGIN=https://FINNANCES_VERCEL_DOMAIN
```

Las variables sensibles deben configurarse con Secret Manager o desde la sección de variables del servicio, no en el comando guardado en shell history.

## Smoke test

Cloud Run debe responder públicamente `GET /health` con `{ "status": "ok" }`. Las rutas de negocio siguen protegidas por `Authorization: Bearer <API_TOKEN>`.

## Deploy del frontend

El frontend se construye desde `frontend/` y se publica en Vercel. El proyecto debe tener configurada la variable `VITE_API_URL` apuntando a la URL pública de Cloud Run.

```bash
cd frontend
npm test
npm run build
vercel --prod
```

Después del deploy, verificar:

1. La PWA carga desde la URL de Vercel.
2. Inicio, Movimientos, Análisis y Recurrentes responden sin errores.
3. El frontend puede consultar el backend con el token configurado.

## Última actualización

2026-08-11: se documentó el flujo combinado de publicación backend/frontend y se agregó el rediseño responsive del historial de vencimientos recurrentes.
