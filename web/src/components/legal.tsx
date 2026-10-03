import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

// The terms of use and privacy policy (task 4.3): their pages, and the links
// to them wherever they're mentioned. Both pages work signed out.

const inlineLink = 'font-medium underline underline-offset-4'

/** "I agree to the terms of use and privacy policy.", with both linked (setup and join). */
export function AgreeTermsText() {
  return (
    <Trans
      i18nKey="circleSetup.agreeTerms"
      components={{
        terms: <Link to="/terms" className={inlineLink} />,
        privacy: <Link to="/privacy" className={inlineLink} />,
      }}
    />
  )
}

/** "Terms of use" and "Privacy policy" as two tappable links (sign-in, settings). */
export function LegalLinks() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap justify-center gap-x-4">
      <Button asChild variant="link" className="min-h-tap px-1">
        <Link to="/terms">{t('auth.start.terms')}</Link>
      </Button>
      <Button asChild variant="link" className="min-h-tap px-1">
        <Link to="/privacy">{t('auth.start.privacy')}</Link>
      </Button>
    </div>
  )
}

/** A plain-language page of headed sections: /terms and /privacy. */
export function LegalPage({
  title,
  intro,
  sections,
  back,
}: {
  title: string
  intro: string
  sections: readonly { title: string; body: string }[]
  back: string
}) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-6 px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p>{intro}</p>
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}
      <Button asChild variant="outline" size="lg" className="mt-auto">
        <Link to="/">{back}</Link>
      </Button>
    </main>
  )
}
