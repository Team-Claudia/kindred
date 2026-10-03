import { availabilitySlot, formAvailabilitySlot } from './availability'
import { newItemForm } from './item-form'

// Toronto still changes its clocks (1 Nov 2026), unlike Vancouver in newer tz data.
const TZ = 'America/Toronto'

test('an appointment with an end is checked from start to end', () => {
  expect(
    availabilitySlot(
      { kind: 'appointment', starts_at: '2026-10-16T13:30:00Z', ends_at: '2026-10-16T14:15:00Z' },
      TZ,
    ),
  ).toEqual({ start: '2026-10-16T13:30:00.000Z', end: '2026-10-16T14:15:00.000Z' })
})

test('an appointment with no end is checked for an hour', () => {
  expect(availabilitySlot({ kind: 'appointment', starts_at: '2026-10-16T13:30:00Z', ends_at: null }, TZ)).toEqual({
    start: '2026-10-16T13:30:00.000Z',
    end: '2026-10-16T14:30:00.000Z',
  })
})

test('a task with a time is checked for 15 minutes', () => {
  expect(availabilitySlot({ kind: 'task', starts_at: '2026-10-16T13:30:00Z', ends_at: null }, TZ)).toEqual({
    start: '2026-10-16T13:30:00.000Z',
    end: '2026-10-16T13:45:00.000Z',
  })
})

test('a task with no time has no slot', () => {
  // 23:59 in Toronto on 16 Oct (EDT, UTC−4).
  expect(availabilitySlot({ kind: 'task', starts_at: '2026-10-17T03:59:00Z', ends_at: null }, TZ)).toBeNull()
})

test('the create sheet has a slot once it has a date and a time, in the circle’s time zone', () => {
  const form = newItemForm('appointment', '2026-11-02')
  expect(formAvailabilitySlot(form, TZ)).toBeNull()
  // After the clocks go back on 1 Nov: EST, UTC−5.
  expect(formAvailabilitySlot({ ...form, time: '09:30', endTime: '10:00' }, TZ)).toEqual({
    start: '2026-11-02T14:30:00.000Z',
    end: '2026-11-02T15:00:00.000Z',
  })
  expect(formAvailabilitySlot({ ...form, date: '', time: '09:30' }, TZ)).toBeNull()
})
