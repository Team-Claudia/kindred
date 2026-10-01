import type { User } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useEffect, useState } from 'react'
import * as api from './api'
import { supabase } from './supabase'

// Care Circle setup and joining (task 1.2): /welcome and /join/:code.

// The care recipient's relationship to a member, stored as one of these keys
// in circle_members.relationship and shown through circleSetup.relationship.
export const relationships = [
  'parent',
  'grandparent',
  'spouse',
  'sibling',
  'child',
  'otherRelative',
  'friend',
  'other',
] as const

export type Relationship = (typeof relationships)[number]

export function relationshipLabel(t: TFunction, value: string | null): string | null {
  if (!value) return null
  return (relationships as readonly string[]).includes(value)
    ? t(`circleSetup.relationship.${value as Relationship}`)
    : value
}

// Where to send a signed-out visitor so they come back to the invite after
// signing in.
export function signInPath(next: string): string {
  return `/sign-in?${new URLSearchParams({ next }).toString()}`
}

export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? ''
}

// The name Google gave us, if the member signed in with Google.
export function nameFromAccount(user: User | null): string {
  const metadata = user?.user_metadata as { full_name?: unknown; name?: unknown } | undefined
  const name = metadata?.full_name ?? metadata?.name
  return typeof name === 'string' ? name : ''
}

// The signed-in user, or null. loading is true until the session is known.
export function useAuthUser() {
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({
    user: null,
    loading: true,
  })

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ user: data.session?.user ?? null, loading: false })
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ user: session?.user ?? null, loading: false })
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}

export const circleKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  myMembership: (userId: string) => ['my-membership', userId] as const,
  members: ['circle-members'] as const,
  invitePreview: (code: string, userId: string | null) => ['invite-preview', code, userId] as const,
  newInvite: (circleId: string) => ['new-invite', circleId] as const,
}

async function rows<T>(query: PromiseLike<{ data: T; error: Error | null }>): Promise<T> {
  const { data, error } = await query
  if (error) throw error
  return data
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: circleKeys.profile(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: () =>
      rows(supabase.from('profiles').select('display_name').eq('id', userId!).maybeSingle()),
  })
}

// The caller's own membership and circle, or null if they aren't in one.
export function useMyMembership(userId: string | undefined) {
  return useQuery({
    queryKey: circleKeys.myMembership(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: () =>
      rows(
        supabase
          .from('circle_members')
          .select('role, relationship, circles(id, care_recipient_name)')
          .eq('user_id', userId!)
          .maybeSingle(),
      ),
  })
}

export function useCircleMembers({ refetchInterval }: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: circleKeys.members,
    refetchInterval,
    queryFn: () =>
      rows(
        supabase
          .from('circle_members')
          .select('user_id, role, relationship, joined_at, profiles(display_name)')
          .order('joined_at')
          .order('user_id'),
      ),
  })
}

export type CircleMember = NonNullable<ReturnType<typeof useCircleMembers>['data']>[number]

// What /join/:code shows before joining (wireframe 07). Keyed by user, since
// is_member and in_other_circle depend on who's asking.
export function useInvitePreview(code: string, userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: circleKeys.invitePreview(code, userId),
    enabled,
    retry: false,
    queryFn: () => api.invitePreview(code),
  })
}
