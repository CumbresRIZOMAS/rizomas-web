export function normalizePhone(value: string) {
  const input = value.trim()
  const digits = input.replace(/\D/g, '')
  if (/^3\d{9}$/.test(digits)) return `+57${digits}`
  if (/^57\d{10}$/.test(digits)) return `+${digits}`
  if (/^\+[1-9]\d{7,14}$/.test(input)) return input
  throw new Error('Escribe un celular colombiano de 10 dígitos o un número internacional con + y código de país')
}
