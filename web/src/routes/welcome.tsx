import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { Share } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import {
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
import { AgreeTermsText } from '@/components/legal'
import { MemberRow } from '@/components/member-list'
import { ShareButton } from '@/components/share-button'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { googleName, myCircleKey, signInPath, useAuth } from '@/lib/auth'
import {
  circleKeys,
  firstName,
  useCircleMembers,
  useMyMembership,
  useProfile,
  type CircleMember,
} from '@/lib/circles'
import { errorMessage, RpcError } from '@/lib/errors'
import { inviteCodeFromText } from '@/lib/invite-code'
import { inviteShare } from '@/lib/share-text'
import { platform } from '@/platform'

// /welcome: set up a Care Circle in three steps (wireframes 04–06). Someone
// who's already in a circle lands straight on step 3, the invite step.
export default function Welcome() {
  const { t } = useTranslation()
  const auth = useAuth()
  const loading = auth.status === 'loading'
  const user = auth.status === 'signed_in' ? auth.session.user : null
  const profile = useProfile(user?.id)
  const membership = useMyMembership(user?.id)
  const queryClient = useQueryClient()

  const [step, setStep] = useState<1 | 2 | 'code'>(1)
  const [name, setName] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [relationship, setRelationship] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  const create = useMutation({
    mutationFn: api.createCircle,
    // myCircleKey is the sign-in guard's "is this person in a circle?" (task 1.1).
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-membership'] }),
        queryClient.invalidateQueries({ queryKey: myCircleKey }),
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
  const displayName = name ?? (profile.data?.display_name || googleName(user) || '')
  const nameError = showErrors && !displayName.trim() ? t('circleSetup.nameRequired') : undefined
  const termsError = showErrors && !agreed ? t('circleSetup.termsRequired') : undefined
  const recipientError =
    showErrors && !recipient.trim() ? t('welcome.recipientRequired') : undefined

  if (step === 'code') return <InviteCodeStep userId={user.id} onBack={() => setStep(1)} />

  if (step === 1) {
    return (
      <SetupScreen
        title={t('welcome.title')}
        footer={
          <>
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
            {/* The Home Screen app always opens at /, so an invite link can't
                bring people here: they enter its code instead (task 4.10). */}
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                setShowErrors(false)
                setStep('code')
              }}
            >
              {t('welcome.haveCode')}
            </Button>
          </>
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
          <AgreeTermsText />
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
        recipientName={recipient}
        value={relationship}
        onChange={setRelationship}
        hint={t('welcome.relationshipHint')}
      />
      <Notice>{t('welcome.notMedical')}</Notice>
    </SetupScreen>
  )
}

// "I have an invite code": checks the code (or a pasted invite link) with
// invite_preview, then hands over to /join/:code to join (task 4.10).
function InviteCodeStep({ userId, onBack }: { userId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)

  const check = useMutation({
    mutationFn: (code: string) => api.invitePreview(code),
    onSuccess: (preview, code) => {
      // /join/:code shows this straight away rather than asking again.
      queryClient.setQueryData(circleKeys.invitePreview(code, userId), preview)
      navigate(`/join/${code}`)
    },
  })

  const error = invalid ? t('inviteCode.invalid') : check.error ? inviteCodeError(check.error, t) : undefined

  return (
    <SetupScreen
      title={t('inviteCode.title')}
      onBack={onBack}
      footer={
        <Button
          size="lg"
          disabled={check.isPending}
          onClick={() => {
            const code = inviteCodeFromText(text)
            setInvalid(!code)
            if (code) check.mutate(code)
          }}
        >
          {check.isPending ? t('inviteCode.checking') : t('inviteCode.submit')}
        </Button>
      }
    >
      <Heading intro={t('inviteCode.intro')}>{t('inviteCode.heading')}</Heading>
      <TextField
        label={t('inviteCode.label')}
        value={text}
        onChange={(value) => {
          setText(value)
          setInvalid(false)
          check.reset()
        }}
        hint={t('inviteCode.hint')}
        error={error}
        autoComplete="off"
        verbatim
        maxLength={500}
      />
    </SetupScreen>
  )
}

function inviteCodeError(error: Error, t: TFunction) {
  const code = error instanceof RpcError ? error.code : null
  if (code === 'invite_not_found') return t('inviteCode.notFound')
  if (code === 'invite_expired') return t('inviteCode.expired')
  return errorMessage(error)
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
  // Make the code as soon as the step opens, so tapping Share opens the share
  // sheet straight away (iOS only allows it right after a tap). A query, not
  // a mutation, so it runs once however often the screen renders.
  const invite = useQuery({
    queryKey: circleKeys.newInvite(circleId),
    queryFn: api.createInvite,
    staleTime: Infinity,
    retry: 2,
    refetchOnWindowFocus: false,
  })

  // Poll while this step is open, so people appear as they join.
  const members = useCircleMembers({ refetchInterval: 5000 })

  const promote = useMutation({
    mutationFn: api.setAdmin,
    onSettled: () => queryClient.invalidateQueries({ queryKey: circleKeys.members }),
  })

  const list = members.data ?? []
  const error = promote.error ?? members.error

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
        {invite.data ? (
          <ShareButton
            size="lg"
            label={t('welcome.shareInvite')}
            content={inviteShare(recipientName, platform.appUrl(`/join/${invite.data}`), t)}
          />
        ) : invite.isError ? (
          <>
            <ErrorText>{errorMessage(invite.error)}</ErrorText>
            <Button variant="outline" size="lg" onClick={() => void invite.refetch()}>
              {t('common.tryAgain')}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="lg" disabled>
            <Share aria-hidden />
            {t('welcome.preparingInvite')}
          </Button>
        )}
        <p className="text-sm text-muted-foreground">{t('welcome.shareHint')}</p>
        <ErrorText>{error ? errorMessage(error) : null}</ErrorText>
      </div>

      <section className="flex flex-col gap-1">
        <h3 className="font-mono text-sm font-medium tracking-wider text-muted-foreground uppercase">
          {t('welcome.members', { count: list.length })}
        </h3>
        <ul className="divide-y">
          {list.map((member) => (
            <MemberRow
              key={member.user_id}
              member={member}
              viewerId={userId}
              recipientName={recipientName}
              otherBadge="joined"
            />
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

function memberFirstName(member: CircleMember, t: (key: string) => string) {
  return firstName(member.profiles?.display_name) || t('circleSetup.unnamedMember')
}
