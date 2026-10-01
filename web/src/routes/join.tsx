import type { User } from '@supabase/supabase-js'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import {
  Avatar,
  CheckboxField,
  ErrorText,
  Heading,
  LoadingScreen,
  MessageScreen,
  Notice,
  RelationshipField,
  SetupScreen,
  TextField,
} from '@/components/circle-setup'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import {
  nameFromAccount,
  signInPath,
  useAuthUser,
  useInvitePreview,
  useProfile,
} from '@/lib/circles'
import { errorMessage, RpcError } from '@/lib/errors'

// /join/:code: an invite link (wireframes 07 and 08). Shows who invited you
// and who's already in, then asks you to sign in, then joins you.
export default function Join() {
  const { t } = useTranslation()
  const { code = '' } = useParams()
  const { user, loading } = useAuthUser()
  const preview = useInvitePreview(code, user?.id ?? null, !loading)

  if (loading || preview.isPending) return <LoadingScreen />

  if (preview.isError) {
    const error = preview.error
    const code = error instanceof RpcError ? error.code : 'unknown'
    const heading =
      code === 'invite_expired'
        ? t('join.expiredHeading')
        : code === 'invite_not_found'
          ? t('join.notFoundHeading')
          : t('join.errorHeading')
    return <MessageScreen heading={heading} body={errorMessage(error)} />
  }

  const invite = preview.data

  // Already in this circle: open it rather than joining twice (US 3.1).
  if (invite.is_member) return <Navigate to="/" replace />

  // BR-12: one circle per person.
  if (invite.in_other_circle) {
    return (
      <MessageScreen
        heading={t('join.otherCircleHeading')}
        body={t('join.otherCircleBody', { name: invite.care_recipient_name })}
      />
    )
  }

  if (!user) return <InviteLanding code={code} invite={invite} />
  return <JoinForm code={code} invite={invite} user={user} />
}

function InviteLanding({ code, invite }: { code: string; invite: api.InvitePreview }) {
  const { t, i18n } = useTranslation()
  const next = signInPath(`/join/${code}`)
  const inviter = invite.inviter_name || undefined
  const names = invite.member_names
  const others = invite.member_count - names.length
  const people = new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
    others > 0 ? [...names, t('join.others', { count: others })] : names,
  )
  const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(
    new Date(invite.expires_at),
  )

  return (
    <SetupScreen
      footer={
        <>
          <Button asChild size="lg">
            <Link to={next}>{t('join.continueGoogle')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to={next}>{t('join.emailCode')}</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t('join.expires', { inviter, date, context: inviter ? 'named' : undefined })}
          </p>
        </>
      }
    >
      <p className="font-mono text-sm font-medium tracking-wider text-muted-foreground uppercase">
        {t('join.invited')}
      </p>
      <Heading>
        {t('join.heading', {
          inviter,
          name: invite.care_recipient_name,
          context: inviter ? 'named' : undefined,
        })}
      </Heading>
      {names.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            {names.map((name, index) => (
              <Avatar key={`${name}-${index}`} name={name} className="ring-2 ring-background" />
            ))}
          </div>
          <p className="text-muted-foreground">
            {t('join.alreadyIn', { names: people, count: invite.member_count })}
          </p>
        </div>
      )}
      <Notice>{t('join.about', { name: invite.care_recipient_name })}</Notice>
    </SetupScreen>
  )
}

function JoinForm({
  code,
  invite,
  user,
}: {
  code: string
  invite: api.InvitePreview
  user: User
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profile = useProfile(user.id)
  const [name, setName] = useState<string | null>(null)
  const [relationship, setRelationship] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const recipient = invite.care_recipient_name

  const join = useMutation({
    mutationFn: api.joinCircle,
    onSuccess: async () => {
      // Everything, including the sign-in guard's ['my-circle'] (task 1.1).
      await queryClient.invalidateQueries()
      navigate('/', { replace: true })
    },
  })

  if (profile.isPending) return <LoadingScreen />

  // Filled in from the profile, or from Google, until the member edits it.
  const displayName = name ?? (profile.data?.display_name || nameFromAccount(user))
  const nameError = showErrors && !displayName.trim() ? t('circleSetup.nameRequired') : undefined
  const termsError = showErrors && !agreed ? t('circleSetup.termsRequired') : undefined

  return (
    <SetupScreen
      title={t('join.title', { name: recipient })}
      footer={
        <>
          <ErrorText>{join.error ? errorMessage(join.error) : null}</ErrorText>
          <Button
            size="lg"
            disabled={join.isPending}
            onClick={() => {
              if (!displayName.trim() || !agreed) return setShowErrors(true)
              join.mutate({ code, relationship, display_name: displayName.trim() })
            }}
          >
            {join.isPending ? t('join.joining') : t('join.submit', { name: recipient })}
          </Button>
        </>
      }
    >
      <Heading intro={user.email ? t('circleSetup.signedInAs', { email: user.email }) : undefined}>
        {t('join.lastThing')}
      </Heading>
      <TextField
        label={t('circleSetup.yourName')}
        value={displayName}
        onChange={setName}
        autoComplete="name"
        error={nameError}
      />
      <RelationshipField
        label={t('join.relationshipLabel', { name: recipient })}
        value={relationship}
        onChange={setRelationship}
        hint={t('join.relationshipHint')}
      />
      <CheckboxField checked={agreed} onChange={setAgreed} error={termsError}>
        {t('circleSetup.agreeTerms')}
      </CheckboxField>
      <Notice>{t('join.oneCircle')}</Notice>
    </SetupScreen>
  )
}
