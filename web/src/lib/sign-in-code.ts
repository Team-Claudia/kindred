export const CODE_LENGTH = 6

/**
 * The code from typed, pasted or autofilled text: a standalone 6-digit run if
 * there is one ("Your code is 123456"), otherwise the first 6 digits
 * ("123 456").
 */
export function codeFromText(text: string): string {
  // No lookbehind: Safari before iOS 16.4 can't parse it.
  const exact = text.match(/(?:^|\D)(\d{6})(?!\d)/)
  if (exact) return exact[1]
  return text.replace(/\D/g, '').slice(0, CODE_LENGTH)
}
