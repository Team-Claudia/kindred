import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Share } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import {
  Avatar,
  CheckboxField,
  ErrorText,
  Heading,
  LoadingScreen,
  Notice,
  RelationshipField,
  SetupScreen,
  StepProgress,
  TextField,
} from '@/components/circle-setup'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import {
  circleKeys,
  firstName,
  inviteUrl,
  nameFromAccount,
  relationshipLabel,
  signInPath,
  useAuthUser,
  useCircleMembers,
  useMyMembership,
  useProfile,
  type CircleMember,
} from '@/lib/circles'
import { errorMessage } from '@/lib/errors'
import { platform } from '@/platform'

// /welcome: set up a Care Circle in three steps (wireframes 04–06). Someone
// who's already in a circle lands straight on step 3, the invite step.
export default function Welcome() {
  const { t } = useTranslation()
  const { user, loading } = useAuthUser()
  const profile = useProfile(user?.id)
  const membership = useMyMembership(user?.id)
  const queryClient = useQueryClient()

  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [relationship, setRelationship] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  const create = useMutation({
    mutationFn: api.createCircle,
    // ['my-circle'] is the sign-in guard's "is this person in a circle?" (task 1.1).
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-membership'] }),
        queryClient.invalidateQueries({ queryKey: ['my-circle'] }),
      ]),
  })

  if (loading || (user && (profile.isPending || membership.isPending))) return <LoadingScreen />

  if (!user) {
    return (
      <SetupScreen
        title={t('welcome.title')}
        footer={
          <Button asChild size="lg">
            <Link to={signInPath('/welcome')}>{t('circleSetup.signIn')}</Link>
          </Button>
        }
      >
        <p>{t('circleSetup.signedOut')}</p>
      </SetupScreen>
    )
  }

  const circle = membership.data?.circles
  if (circle) {
    return (
      <InviteStep
        userId={user.id}
        circleId={circle.id}
        recipientName={circle.care_recipient_name}
        isAdmin={membership.data?.role === 'admin'}
      />
    )
  }

  // Filled in from the profile, or from Google, until the member edits it.
  const displayName = name ?? (profile.data?.display_name || nameFromAccount(user))
  const nameError = showErrors && !displayName.trim() ? t('circleSetup.nameRequired') : undefined
  const termsError = showErrors && !agreed ? t('circleSetup.termsRequired') : undefined
  const recipientError =
    showErrors && !recipient.trim() ? t('welcome.recipientRequired') : undefined

  if (step === 1) {
    return (
      <SetupScreen
        title={t('welcome.title')}
        footer={
          <Button
            size="lg"
            onClick={() => {
              if (!displayName.trim() || !agreed) return setShowErrors(true)
              setShowErrors(false)
              setStep(2)
            }}
          >
            {t('welcome.continue')}
          </Button>
        }
      >
        <StepProgress step={1} label={t('welcome.stepYou')} />
        <Heading intro={user.email ? t('circleSetup.signedInAs', { email: user.email }) : undefined}>
          {t('welcome.nameHeading')}
        </Heading>
        <TextField
          label={t('circleSetup.yourName')}
          value={displayName}
          onChange={setName}
          autoComplete="name"
          hint={t('welcome.nameHint')}
          error={nameError}
        />
        <CheckboxField checked={agreed} onChange={setAgreed} error={termsError}>
          {t('circleSetup.agreeTerms')}
        </CheckboxField>
      </SetupScreen>
    )
  }

  return (
    <SetupScreen
      title={t('welcome.title')}
      onBack={() => setStep(1)}
      footer={
        <>
          <ErrorText>{create.error ? errorMessage(create.error) : null}</ErrorText>
          <Button
            size="lg"
            disabled={create.isPending}
            onClick={() => {
              if (!recipient.trim()) return setShowErrors(true)
              create.mutate({
                care_recipient_name: recipient.trim(),
                relationship,
                time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                display_name: displayName.trim(),
              })
            }}
          >
            {create.isPending ? t('welcome.creating') : t('welcome.continue')}
          </Button>
        </>
      }
    >
      <StepProgress step={2} label={t('welcome.stepLovedOne')} />
      <Heading intro={t('welcome.recipientIntro')}>{t('welcome.recipientHeading')}</Heading>
      <TextField
        label={t('welcome.recipientName')}
        value={recipient}
        onChange={setRecipient}
        error={recipientError}
      />
      <RelationshipField
        label={t('welcome.relationshipLabel')}
        value={relationship}
        onChange={setRelationship}
        hint={t('welcome.relationshipHint')}
      />
      <Notice>{t('welcome.notMedical')}</Notice>
    </SetupScreen>
  )
}

function InviteStep({
  userId,
  circleId,
  recipientName,
  isAdmin,
}: {
  userId: string
  circleId: string
  recipientName: string
  isAdmin: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [fallbackLink, setFallbackLink] = useState<string | null>(null)
  const [shareError, setShareError] = useState<unknown>(null)

  // Make the code as soon as the step opens, so tapping Share opens the share
  // sheet straight away (iOS only allows it right after a tap). A query, not
  // a mutation, so it runs once however often the screen renders.
  const invite = useQuery({
    queryKey: circleKeys.newInvite(circleId),
    queryFn: api.createInvite,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })

  // Poll while this step is open, so people appear as they join.
  const members = useCircleMembers({ refetchInterval: 5000 })

  const promote = useMutation({
    mutationFn: api.setAdmin,
    onSettled: () => queryClient.invalidateQueries({ queryKey: circleKeys.members }),
  })

  async function share() {
    if (!invite.data) return
    const url = inviteUrl(invite.data)
    setShareError(null)
    try {
      const result = await platform.share({
        text: t('welcome.shareText', { name: recipientName }),
        url,
      })
      if (result === 'unsupported') setFallbackLink(url)
    } catch (error) {
      setShareError(error)
      setFallbackLink(url)
    }
  }

  const list = members.data ?? []
  const error = invite.error ?? promote.error ?? members.error ?? shareError

  return (
    <SetupScreen
      title={t('welcome.title')}
      footer={
        <>
          <Button size="lg" onClick={() => navigate('/')}>
            {t('welcome.done')}
          </Button>
          <Button variant="link" onClick={() => navigate('/')}>
            {t('welcome.skip')}
          </Button>
        </>
      }
    >
      <StepProgress step={3} label={t('welcome.stepCircle')} />
      <Heading intro={t('welcome.inviteIntro', { name: recipientName })}>
        {t('welcome.inviteHeading')}
      </Heading>

      <div className="flex flex-col gap-2">
        <Button variant="outline" size="lg" disabled={!invite.data} onClick={() => void share()}>
          <Share aria-hidden />
          {invite.data ? t('welcome.shareInvite') : t('welcome.preparingInvite')}
        </Button>
        <p className="text-sm text-muted-foreground">{t('welcome.shareHint')}</p>
        {fallbackLink && (
          <div className="flex flex-col gap-2">
            <p className="text-sm">{t('welcome.copyInstead')}</p>
            <input
              readOnly
              aria-label={t('welcome.inviteLink')}
              value={fallbackLink}
              onFocus={(event) => event.currentTarget.select()}
              className="h-12 w-full rounded-lg border border-input bg-muted px-4 font-mono text-base"
            />
          </div>
        )}
        <ErrorText>{error ? errorMessage(error) : null}</ErrorText>
      </div>

      <section className="flex flex-col gap-1">
        <h3 className="font-mono text-sm font-medium tracking-wider text-muted-foreground uppercase">
          {t('welcome.members', { count: list.length })}
        </h3>
        <ul className="divide-y">
          {list.map((member) => (
            <MemberRow key={member.user_id} member={member} isMe={member.user_id === userId} />
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t('welcome.membersHint')}</p>
      </section>

      {isAdmin &&
        list
          .filter((member) => member.user_id !== userId)
          .map((member) => (
            <Notice key={member.user_id}>
              <CheckboxField
                checked={member.role === 'admin'}
                disabled={member.role === 'admin' || promote.isPending}
                onChange={(checked) => checked && promote.mutate(member.user_id)}
              >
                {t('welcome.makeAdmin', { name: memberFirstName(member, t) })}
              </CheckboxField>
            </Notice>
          ))}
    </SetupScreen>
  )
}

function memberName(member: CircleMember, t: (key: string) => string) {
  return member.profiles?.display_name?.trim() || t('circleSetup.unnamedMember')
}

function memberFirstName(member: CircleMember, t: (key: string) => string) {
  return firstName(member.profiles?.display_name) || t('circleSetup.unnamedMember')
}

function MemberRow({ member, isMe }: { member: CircleMember; isMe: boolean }) {
  const { t } = useTranslation()
  const name = memberName(member, t)
  const isAdmin = member.role === 'admin'
  const badge = isMe
    ? isAdmin
      ? t('circleSetup.youAdmin')
      : t('circleSetup.you')
    : isAdmin
      ? t('circleSetup.admin')
      : t('circleSetup.joined')

  return (
    <li className="flex items-center gap-4 py-3">
      <Avatar name={name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{name}</span>
        {member.relationship && (
          <span className="truncate text-sm text-muted-foreground">
            {relationshipLabel(t, member.relationship)}
          </span>
        )}
      </div>
      <span className="shrink-0 rounded-full border px-3 py-1 text-sm">{badge}</span>
    </li>
  )
}
