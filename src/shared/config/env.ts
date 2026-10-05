// Variables públicas de Vite (prefijo VITE_). Nunca poner secretos aquí:
// todo lo que empieza por VITE_ termina dentro del bundle que ve el navegador.
export const env = {
  apiUrl: (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, ''),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
}

/** Variables que faltan para que el panel funcione; se muestran en pantalla en vez de romper la app. */
export function missingEnv(): string[] {
  return [
    !env.apiUrl && 'VITE_API_URL',
    !env.supabaseUrl && 'VITE_SUPABASE_URL',
    !env.supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
  ].filter((v): v is string => Boolean(v))
}
