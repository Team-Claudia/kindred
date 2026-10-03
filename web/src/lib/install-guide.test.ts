import { REMIND_AFTER_MS, shouldInstallFirst, shouldShowInstallGuide } from './install-guide'

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

describe('install before sign-in', () => {
  test('shows on an iPhone or iPad in Safari', () => {
    expect(shouldInstallFirst(true, false, null, now)).toBe(true)
  })

  test('never shows in the Home Screen app', () => {
    expect(shouldInstallFirst(true, true, null, now)).toBe(false)
  })

  test('never shows on a computer or Android phone', () => {
    expect(shouldInstallFirst(false, false, null, now)).toBe(false)
  })

  test('"Sign in here instead" hides it for a while, then it comes back', () => {
    expect(shouldInstallFirst(true, false, String(now - 1000), now)).toBe(false)
    expect(shouldInstallFirst(true, false, String(now - REMIND_AFTER_MS), now)).toBe(true)
  })
})
