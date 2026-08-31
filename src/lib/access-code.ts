/** Espejo de `src/modules/galleries/lib/access-code.ts` en la app web. */

export const ACCESS_CODE_LENGTH = 10;

/** Tolerante a como lo teclee el cliente: mayúsculas, sin separadores. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** `4F7K9M2XQ8` → `4F7K9-M2XQ8`, para mostrarlo mientras escribe. */
export function formatAccessCode(code: string): string {
  const normalized = normalizeCode(code).slice(0, ACCESS_CODE_LENGTH);
  return normalized.length > 5
    ? `${normalized.slice(0, 5)}-${normalized.slice(5)}`
    : normalized;
}
