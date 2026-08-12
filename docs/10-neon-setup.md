# Base de producción en Neon

## Crear el proyecto

1. Crear una cuenta en [Neon](https://neon.tech/).
2. Crear un proyecto llamado `finnances`.
3. Elegir una región cercana al backend de Cloud Run. Mantener la misma región reduce latencia.
4. Usar la rama `main` para producción.
5. No ejecutar el seed de desarrollo contra esta base.

## Obtener las conexiones

Neon muestra dos endpoints en el panel `Connect`:

- **Pooled**: usarlo como `DATABASE_URL` en Cloud Run. El host contiene `-pooler`.
- **Direct**: usarlo solo para migraciones Prisma. El host no contiene `-pooler`.

Ambas URLs deben incluir `sslmode=require`. No guardar ninguna URL en GitHub ni en archivos versionados.

## Aplicar el schema

Desde `backend/`, con la URL directa copiada desde Neon:

```bash
DATABASE_URL="postgresql://...direct...?...&sslmode=require" npx prisma migrate deploy
```

La migración debe terminar con `All migrations have been successfully applied.`

La configuración actual del schema Prisma usa `DATABASE_URL` como única variable. Por eso se reemplaza temporalmente el valor de esa variable para el comando de migración; Cloud Run usará luego la URL pooled para el tráfico normal.

## Verificación segura

Antes de conectar el frontend:

```bash
DATABASE_URL="postgresql://...direct...?...&sslmode=require" npx prisma migrate status
```

No ejecutar `npm run seed` en producción: el seed contiene datos de categorías/subcategorías de desarrollo y no debe mezclarse con datos reales.

## Variables para Cloud Run

Configurar en el servicio:

```text
DATABASE_URL=postgresql://...pooler...?...&sslmode=require
NODE_ENV=production
API_TOKEN=<token-largo-generado>
ALLOWED_ORIGIN=https://<proyecto>.vercel.app
GEMINI_API_KEY=<secret>
GEMINI_MODEL=gemini-flash-lite-latest
```

`DATABASE_URL`, `API_TOKEN` y `GEMINI_API_KEY` deben cargarse como secretos. La URL pooled es para el runtime; las migraciones se aplican fuera del contenedor con la URL directa.

## Primer usuario

Después de desplegar backend y frontend:

1. Abrir la URL de Vercel.
2. Configurar el `API_TOKEN` correspondiente.
3. Crear las cuentas reales desde la aplicación.
4. Crear o revisar categorías reales.
5. Verificar `/health`, Home, Movimientos y Análisis antes de usar capturas automáticas.
