import i18n from '@/i18n'
import type { Item } from './items'
import {
  appointmentShare,
  assignmentRequestShare,
  coverageRequestShare,
  inviteShare,
  ITEM_SHARE_KINDS,
  itemShare,
  shareWhen,
  taskShare,
} from './share-text'

const timeZone = 'America/Vancouver'
const url = 'https://kindred.example/i/7f3c9a'
const ctx = { t: i18n.t, locale: 'en-CA', timeZone, url }

const notes = 'Door code 4321, key under the mat'
const updateText = 'The doctor said the results look worrying'

// Friday, October 3, 2025 at 9:30 a.m. in Vancouver (16:30 UTC).
const base: Item = {
  id: '7f3c9a',
  circle_id: 'circle',
  series_id: null,
  kind: 'task',
  title: 'Pick up prescription',
  starts_at: '2025-10-03T16:30:00Z',
  ends_at: null,
  location: null,
  private_notes: notes,
  state: 'needs_someone',
  owner_id: null,
  proposed_assignee_id: null,
  version: 1,
  created_by: 'maya',
  created_at: '2025-10-01T16:00:00Z',
  updated_at: '2025-10-01T16:00:00Z',
} as Item

// A task with no time is saved at 23:59 in the circle's time zone.
const noTimeTask: Item = { ...base, starts_at: '2025-10-04T06:59:00Z' }

const appointment: Item = {
  ...base,
  kind: 'appointment',
  title: 'Physio',
  starts_at: '2025-10-03T21:00:00Z', // 2:00 p.m.
  ends_at: '2025-10-03T22:00:00Z', // 3:00 p.m.
  location: 'Riverside Clinic, 4th floor',
}

/** Every builder's output for `item`, so leaks are checked everywhere at once. */
function allTexts(item: Item) {
  return [
    taskShare(item, 'Jonah', ctx),
    taskShare(item, null, ctx),
    appointmentShare(item, 'Jonah', ctx),
    appointmentShare(item, null, ctx),
    assignmentRequestShare(item, 'Jonah', ctx),
    assignmentRequestShare(item, null, ctx),
    coverageRequestShare(item, 'Maya', ctx),
    coverageRequestShare(item, null, ctx),
  ]
}

describe('shareWhen', () => {
  test('a task with a time shows the date and time in the circle time zone', () => {
    expect(shareWhen(base, ctx)).toMatch(/^Friday, October 3 at 9:30\sa\.m\.$/)
  })

  test('a task with no time shows the date only', () => {
    expect(shareWhen(noTimeTask, ctx)).toBe('Friday, October 3')
  })

  test('an appointment shows its start and end', () => {
    expect(shareWhen(appointment, ctx)).toMatch(/^Friday, October 3 at 2:00\sp\.m\. – 3:00\sp\.m\.$/)
  })

  test('uses the circle time zone, not the phone', () => {
    expect(shareWhen(base, { ...ctx, timeZone: 'America/Toronto' })).toMatch(/12:30\sp\.m\./)
  })
})

// The space before "a.m."/"p.m." varies by ICU version, so compare with \s.
const am930 = String.raw`Friday, October 3 at 9:30\sa\.m\.`
const pm2to3 = String.raw`Friday, October 3 at 2:00\sp\.m\. – 3:00\sp\.m\.`

describe('taskShare', () => {
  test('has the title, due date and who has it, with the link', () => {
    const share = taskShare(base, 'Jonah', ctx)
    expect(share.url).toBe(url)
    expect(share.text).toMatch(new RegExp(`^Pick up prescription\nDue ${am930}\nJonah has it$`))
  })

  test('says it needs someone, and leaves out the time when there is none', () => {
    expect(taskShare(noTimeTask, null, ctx).text).toBe(
      'Pick up prescription\nDue Friday, October 3\nNeeds someone. Can you take it?',
    )
  })
})

describe('appointmentShare', () => {
  test('has the title, date and time, location and who is taking them', () => {
    const share = appointmentShare(appointment, 'Jonah', ctx)
    expect(share.url).toBe(url)
    expect(share.text).toMatch(
      new RegExp(`^Physio\n${pm2to3}\nRiverside Clinic, 4th floor\nJonah is taking them$`),
    )
  })

  test('leaves out a blank location and says nobody is taking them', () => {
    const text = appointmentShare({ ...appointment, location: '  ', ends_at: null }, null, ctx).text
    expect(text).toMatch(/^Physio\nFriday, October 3 at 2:00\sp\.m\.\nNobody is taking them yet\. Can you\?$/)
  })
})

describe('assignmentRequestShare', () => {
  test('asks the person for their answer', () => {
    const share = assignmentRequestShare(noTimeTask, 'Jonah', ctx)
    expect(share.url).toBe(url)
    expect(share.text).toBe(
      'Jonah, can you take this? Tap to accept or decline.\nPick up prescription\nFriday, October 3',
    )
  })

  test('still asks when the person has no name', () => {
    expect(assignmentRequestShare(noTimeTask, null, ctx).text).toBe(
      'Can you take this? Tap to accept or decline.\nPick up prescription\nFriday, October 3',
    )
  })
})

describe('coverageRequestShare', () => {
  test('says who needs cover, for what and when', () => {
    const share = coverageRequestShare(appointment, 'Maya', ctx)
    expect(share.url).toBe(url)
    expect(share.text).toMatch(new RegExp(`^Maya needs cover for Physio\n${pm2to3}\nCan you do it\\?$`))
  })

  test('works without a name', () => {
    expect(coverageRequestShare(noTimeTask, null, ctx).text).toBe(
      'Cover needed for Pick up prescription\nFriday, October 3\nCan you do it?',
    )
  })
})

describe('inviteShare', () => {
  test('invites to the Care Circle with the join link', () => {
    expect(inviteShare('Dad', 'https://kindred.example/join/ABCD1234', i18n.t)).toEqual({
      text: "Join Dad's Care Circle on Kindred",
      url: 'https://kindred.example/join/ABCD1234',
    })
  })
})

describe('privacy (US 9.4–9.5)', () => {
  test.each([
    ['task', base],
    ['task with no time', noTimeTask],
    ['appointment', appointment],
  ])('no builder includes private notes or update text: %s', (_, item) => {
    // Update text isn't an item field, but make sure it can't ride along.
    const withUpdate = { ...item, update: updateText, body: updateText } as Item
    for (const share of allTexts(withUpdate)) {
      expect(share.text).not.toContain(notes)
      expect(share.text).not.toContain(updateText)
      expect(share.url).not.toContain(notes)
    }
  })
})

describe('itemShare', () => {
  const names = { owner: 'Maya', asked: 'Jonah' }

  test.each([
    ['task', 'needs_someone', 'task', /Needs someone/],
    ['task', 'assigned', 'task', /Maya has it$/],
    ['appointment', 'needs_someone', 'appointment', /Nobody is taking them/],
    ['appointment', 'assigned', 'appointment', /Maya is taking them$/],
    ['task', 'awaiting_acceptance', 'assignment_request', /^Jonah, can you take this\?/],
    ['appointment', 'awaiting_acceptance', 'assignment_request', /^Jonah, can you take this\?/],
    ['task', 'needs_coverage', 'coverage_request', /^Maya needs cover for/],
    ['appointment', 'needs_coverage', 'coverage_request', /^Maya needs cover for/],
  ] as const)('a %s that is %s shares as %s', (kind, state, shareKind, text) => {
    const item = { ...(kind === 'appointment' ? appointment : base), state }
    const share = itemShare(item, names, ctx)
    expect(share?.kind).toBe(shareKind)
    expect(share?.content.text).toMatch(text)
    expect(share?.content.url).toBe(url)
  })

  test.each(['completed', 'cancelled'])('a %s item has nothing to share', (state) => {
    expect(itemShare({ ...base, state }, names, ctx)).toBeNull()
  })

  test('every kind it returns is one log_share accepts', () => {
    const states = ['needs_someone', 'assigned', 'awaiting_acceptance', 'needs_coverage']
    for (const item of [base, appointment]) {
      for (const state of states) {
        expect(ITEM_SHARE_KINDS).toContain(itemShare({ ...item, state }, names, ctx)?.kind)
      }
    }
  })
})
