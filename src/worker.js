/**
 * Worker de entrada para habilitar configuración de runtime en Cloudflare.
 * Los archivos existentes se sirven desde el binding de Static Assets.
 */
export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request)
  },
}
