# rizomas-web

Panel web técnico/administrativo de RIZOMAS. React + Vite + TypeScript, desplegado en Cloudflare Workers. Consume la API de [`RIZOMAS_back`](https://github.com/CumbresRIZOMAS/RIZOMAS_back).

## Levantar el entorno local

Requisitos: Node 20+.

```bash
npm install
cp .env.example .env   # completar valores
npm run dev            # http://localhost:5173
```

El backend debe permitir este origen en su `CORS_ORIGIN` (por defecto `http://localhost:5173`).

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base de rizomas-backend, sin `/api/v1` |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key de Supabase (pública) |
| `VITE_CONTACT_EMAIL` | Opcional. Correo de contacto del portal público; sin él no se muestran los botones de contacto |

Todo lo que empieza por `VITE_` queda expuesto en el navegador: aquí solo van valores públicos, nunca secretos.

## Estructura

```
src/
  app/          raíz de la aplicación (App, rutas, layout)
  shared/
    api/        cliente HTTP, hooks (useApiQuery / useApiMutation) y tipos de la API
    auth/       sesión de Supabase Auth y rol del usuario
    config/     lectura de variables de entorno
    ui.tsx      componentes compartidos (campos, encabezados, estados)
  test/         utilidades de prueba (sesión y backend simulados)
  features/     un folder por módulo del dominio
    usuarios        RF-01, RF-22
    fincas          RF-02
    lotes           RF-03
    cultivos        RF-04, RF-05, RF-09
    labores         RF-06
    cosechas        RF-07, RF-08
    comercial       RF-16 (compras/ventas, acceso restringido)
    suelos          RF-10, RF-11, RF-12
    bioinsumos      RF-13
    cafe            RF-14
    trazabilidad    RF-15
    evidencias      RF-17 (incluye bandeja de moderación)
    publicaciones   RF-18
    reportes        RF-20, RF-21
```

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/fincas` | Lista de fincas; crear finca |
| `/fincas/:id` | Resumen, editar datos, lotes y labores de la finca |
| `/lotes/:id` | Cultivos del lote (agregar cultivo) y sus labores |
| `/suelos/rangos` | Catálogo de rangos de referencia de suelo (RF-11) |

Las labores respetan la regla xor del dominio: se registran sobre un lote **o** sobre un cultivo, nunca ambos. Una cosecha siempre va sobre un cultivo.

Los botones se muestran u ocultan según el rol del token (claim `user_role`), pero eso es solo cosmético: los permisos reales los valida el backend (ASR-01). Si el token no trae rol, se muestran las acciones y el backend responde 403 cuando no corresponde.

## Pruebas

```bash
npm test
```

Vitest + Testing Library, con el backend simulado (`src/test/utils.tsx`).

## Despliegue (Cloudflare Workers)

Cada push a `main` se despliega en https://rizomas-web.c-tellezs.workers.dev.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy` (usa `wrangler.jsonc`)
- `wrangler.jsonc` sirve `dist/` y redirige cualquier ruta a `index.html` para que funcionen las URLs del panel.
- Variables de entorno: las de la tabla anterior, configuradas como **variables de build** del proyecto en Cloudflare (Vite las incrusta al compilar). Sin ellas, el panel muestra qué falta en lugar de romperse.
- El origen del panel debe estar en `CORS_ORIGIN` del backend y en el CORS del bucket R2.

## Convenciones

- Ramas: `main` (protegida) + `develop` + `feat/<modulo>-<tarea>`.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`).
