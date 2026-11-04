export function normalizePhone(value: string) {
  const input = value.trim()
  const digits = input.replace(/\D/g, '')
  if (/^3\d{9}$/.test(digits)) return `+57${digits}`
  if (/^57\d{10}$/.test(digits)) return `+${digits}`
  if (/^\+[1-9]\d{7,14}$/.test(input)) return input
  throw new Error('Escribe un celular colombiano de 10 dígitos o un número internacional con + y código de país')
}

/** Presenta celulares colombianos en la interfaz sin el prefijo internacional. */
export function localPhoneDisplay(value: string | null | undefined): string {
  const raw = value?.trim() ?? ''
  const digits = raw.replace(/\D/g, '')
  return /^57\d{10}$/.test(digits) ? digits.slice(2) : raw
}

/** Acepta entrada pegada como +57…, 57… o los 10 dígitos locales. */
export function localPhoneInput(value: string): string {
  if (value.includes('@')) return value
  const digits = value.replace(/\D/g, '')
  if (/^57\d{10}$/.test(digits)) return digits.slice(2)
  if (/^\+[1-9]\d{7,14}$/.test(value.trim())) return value.trim()
  return digits
}
