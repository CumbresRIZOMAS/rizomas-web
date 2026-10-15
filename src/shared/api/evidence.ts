import { api } from './client'
import type { Evidence, SignedUrl } from './types'

/** Nombre aceptado por el backend: [a-zA-Z0-9/_-] y una extensión. */
export function safeFileName(name: string): string {
  const punto = name.lastIndexOf('.')
  const ext = (punto > 0 ? name.slice(punto + 1) : 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
  const base =
    (punto > 0 ? name.slice(0, punto) : name)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^[^a-zA-Z0-9]+/, '')
      .slice(0, 120) || 'foto'
  return `${base}.${ext.toLowerCase()}`
}

/**
 * Sube una foto de evidencia (RF-17): pide una URL prefirmada al backend, sube
 * el archivo directo a R2 y registra los metadatos. Queda PENDIENTE de moderación.
 */
export async function uploadEvidence(
  token: string | undefined,
  file: File,
  target: { farmId: string; lotId?: string; laborId?: string },
): Promise<Evidence> {
  const contentType = file.type || 'image/jpeg'
  const signed = await api<SignedUrl>('/evidence/upload-url', {
    method: 'POST',
    token,
    body: { farmId: target.farmId, fileName: safeFileName(file.name), contentType },
  })
  const put = await fetch(signed.url, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } })
  if (!put.ok) throw new Error(`No se pudo subir ${file.name}`)
  return api<Evidence>('/evidence', {
    method: 'POST',
    token,
    body: {
      ...target,
      objectKey: signed.objectKey,
      capturedAt: file.lastModified ? new Date(file.lastModified).toISOString() : undefined,
    },
  })
}
