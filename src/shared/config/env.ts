// Variables públicas de Vite (prefijo VITE_). Nunca poner secretos aquí:
// todo lo que empieza por VITE_ termina dentro del bundle que ve el navegador.
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`)
  return value
}

export const env = {
  apiUrl: required('VITE_API_URL', import.meta.env.VITE_API_URL),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
}
