import { REMIND_AFTER_MS, shouldShowInstallGuide } from './install-guide'

const now = 1_800_000_000_000

test('never shows from the Home Screen', () => {
  expect(shouldShowInstallGuide(true, null, now)).toBe(false)
})

test('shows in a browser tab until put off', () => {
  expect(shouldShowInstallGuide(false, null, now)).toBe(true)
})

test('"Remind me later" hides it for a while, then it comes back', () => {
  expect(shouldShowInstallGuide(false, String(now - 1000), now)).toBe(false)
  expect(shouldShowInstallGuide(false, String(now - REMIND_AFTER_MS), now)).toBe(true)
})

test('shows if the stored value is unreadable', () => {
  expect(shouldShowInstallGuide(false, 'garbage', now)).toBe(true)
})
