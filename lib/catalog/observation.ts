export const OBSERVATION_MAX = 500

/** Observação do cliente sobre um produto: texto, sem espaços nas pontas, com limite de tamanho. */
export function cleanObservation(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim().slice(0, OBSERVATION_MAX)
  return text.length > 0 ? text : null
}
