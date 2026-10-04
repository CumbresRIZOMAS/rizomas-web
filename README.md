# rizomas-web

Panel web técnico/administrativo de RIZOMAS. React + Vite + TypeScript, desplegado en Cloudflare Pages. Consume la API de [`RIZOMAS_back`](https://github.com/CumbresRIZOMAS/RIZOMAS_back).

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

Todo lo que empieza por `VITE_` queda expuesto en el navegador: aquí solo van valores públicos, nunca secretos.

## Estructura

```
src/
  app/          raíz de la aplicación (App, rutas, layout)
  shared/
    api/        cliente HTTP contra rizomas-backend
    config/     lectura de variables de entorno
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

## Despliegue (Cloudflare Pages)

- Build command: `npm run build`
- Output directory: `dist`
- Variables de entorno: las de la tabla anterior, configuradas en el proyecto de Pages.

## Convenciones

- Ramas: `main` (protegida) + `develop` + `feat/<modulo>-<tarea>`.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`).
