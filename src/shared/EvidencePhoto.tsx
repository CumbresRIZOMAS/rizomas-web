import { useEffect, useState } from 'react'
import { api } from './api/client'
import type { SignedUrl } from './api/types'
import { useAuth } from './auth/context'
import { Icon } from './ui'

/** URL prefirmada temporal para ver una foto; el bucket de R2 nunca es público. */
function useSignedPhoto(objectKey: string): string | null {
  const { token } = useAuth()
  const [url, setUrl] = useState<{ key: string; url: string | null } | null>(null)
  useEffect(() => {
    let vigente = true
    api<SignedUrl>('/evidence/download-url', { method: 'POST', token: token ?? undefined, body: { objectKey } })
      .then((r) => vigente && setUrl({ key: objectKey, url: r.url }))
      .catch(() => vigente && setUrl({ key: objectKey, url: null }))
    return () => {
      vigente = false
    }
  }, [objectKey, token])
  return url?.key === objectKey ? url.url : null
}

/** Foto de evidencia del panel; mientras carga (o si falla) muestra el ícono de cámara. */
export function EvidencePhoto({ objectKey, alt, size = 38 }: { objectKey: string; alt: string; size?: number }) {
  const url = useSignedPhoto(objectKey)
  return url ? <img src={url} alt={alt} /> : <Icon name="camera" size={size} />
}
