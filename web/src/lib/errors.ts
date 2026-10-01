import type { PostgrestError } from '@supabase/supabase-js'
import i18n from '@/i18n'

// Every typed error an RPC can raise (implementation plan §4.2). RPCs raise
// the code as the message and put any values the message needs (e.g. a name)
// in DETAIL as a JSON object.
export const errorCodes = [
  'already_in_circle',
  'not_member',
  'invite_expired',
  'invite_not_found',
  'already_in_other_circle',
  'not_admin',
  'invalid_input',
  'stale_version',
  'invalid_state',
  'assignment_no_longer_available',
  'already_claimed',
  'not_owner',
  'coverage_limit_reached',
  'coverage_resolved',
  'not_implemented',
] as const

export type ErrorCode = (typeof errorCodes)[number] | 'unknown'

export class RpcError extends Error {
  readonly code: ErrorCode
  readonly params: Record<string, string>

  constructor(code: ErrorCode, params: Record<string, string> = {}, cause?: unknown) {
    super(code, { cause })
    this.name = 'RpcError'
    this.code = code
    this.params = params
  }
}

function isErrorCode(value: string): value is (typeof errorCodes)[number] {
  return (errorCodes as readonly string[]).includes(value)
}

function parseDetail(detail: string | undefined): Record<string, string> {
  if (!detail) return {}
  try {
    const parsed: unknown = JSON.parse(detail)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, String(value)]),
      )
    }
  } catch {
    // DETAIL wasn't JSON; ignore it.
  }
  return {}
}

export function toRpcError(error: Pick<PostgrestError, 'message' | 'details'>): RpcError {
  const code = isErrorCode(error.message) ? error.message : 'unknown'
  return new RpcError(code, parseDetail(error.details), error)
}

// The plain-language message for any error, ready to show to the member.
// Messages with a "_named" variant use it when the RPC sent a name.
export function errorMessage(error: unknown): string {
  const { code, params } = error instanceof RpcError ? error : new RpcError('unknown')
  return i18n.t(`errors.${code}`, { ...params, context: params.name ? 'named' : undefined })
}
