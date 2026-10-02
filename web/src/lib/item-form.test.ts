import type { Item } from './items'
import {
  createItemArgs,
  itemPatch,
  itemToForm,
  needsReconfirm,
  newItemForm,
  validateItemForm,
  type ItemForm,
} from './item-form'

const zone = 'America/Vancouver' // UTC−7 in September

function item(overrides: Partial<Item>): Item {
  return {
    id: 'item',
    circle_id: 'circle-1',
    kind: 'task',
    title: 'Refill meds',
    starts_at: '2026-09-25T00:00:00Z', // Wed 24, 5 pm
    ends_at: null,
    state: 'assigned',
    owner_id: 'maya',
    proposed_assignee_id: null,
    location: null,
    location_lat: null,
    location_lng: null,
    private_notes: null,
    series_id: null,
    follow_up_of: null,
    created_by: 'maya',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    version: 3,
    ...overrides,
  }
}

function form(overrides: Partial<ItemForm>): ItemForm {
  return { ...newItemForm('task', '2026-09-24'), title: 'Refill meds', ...overrides }
}

describe('validateItemForm', () => {
  test('a task needs only a title and a date', () => {
    expect(validateItemForm(form({}))).toEqual({})
  })

  test('a blank title is missing', () => {
    expect(validateItemForm(form({ title: '   ' }))).toEqual({ title: 'titleRequired' })
  })

  test('titles, locations and notes have the database limits', () => {
    expect(
      validateItemForm(
        form({
          kind: 'appointment',
          time: '14:00',
          title: 'x'.repeat(201),
          location: 'x'.repeat(201),
          notes: 'x'.repeat(4001),
        }),
      ),
    ).toEqual({ title: 'titleTooLong', location: 'locationTooLong', notes: 'notesTooLong' })
    expect(validateItemForm(form({ title: 'x'.repeat(200), notes: 'x'.repeat(4000) }))).toEqual({})
  })

  test('an emoji counts as one character, as in Postgres', () => {
    expect(validateItemForm(form({ title: '💊'.repeat(200) }))).toEqual({})
  })

  test('a date is needed', () => {
    expect(validateItemForm(form({ date: '' }))).toEqual({ date: 'dateRequired' })
  })

  test('an appointment needs a start time, and an end no earlier', () => {
    expect(validateItemForm(form({ kind: 'appointment' }))).toEqual({ time: 'timeRequired' })
    expect(validateItemForm(form({ kind: 'appointment', time: '14:00', endTime: '13:00' }))).toEqual({
      endTime: 'endBeforeStart',
    })
    expect(validateItemForm(form({ kind: 'appointment', time: '14:00', endTime: '14:00' }))).toEqual({})
  })
})

describe('createItemArgs', () => {
  test('reads the date and time in the circle time zone', () => {
    expect(createItemArgs(form({ time: '17:00' }), zone)).toEqual({
      kind: 'task',
      title: 'Refill meds',
      starts_at: '2026-09-25T00:00:00.000Z',
    })
  })

  test('a task with no time is due at the end of its day', () => {
    expect(createItemArgs(form({}), zone).starts_at).toBe('2026-09-25T06:59:00.000Z')
  })

  test('an appointment sends its end, location, notes and assignee', () => {
    expect(
      createItemArgs(
        form({
          kind: 'appointment',
          title: '  Cardiology ',
          time: '14:00',
          endTime: '15:30',
          location: ' Riverside Clinic ',
          notes: 'Bring the list',
          assigneeId: 'jonah',
        }),
        zone,
      ),
    ).toEqual({
      kind: 'appointment',
      title: 'Cardiology',
      starts_at: '2026-09-24T21:00:00.000Z',
      ends_at: '2026-09-24T22:30:00.000Z',
      location: 'Riverside Clinic',
      private_notes: 'Bring the list',
      assignee_id: 'jonah',
    })
  })

  test('a task never sends a location', () => {
    expect(createItemArgs(form({ location: 'Somewhere' }), zone)).not.toHaveProperty('location')
  })
})

describe('itemToForm', () => {
  test('shows the date and time in the circle time zone', () => {
    expect(itemToForm(item({}), zone)).toMatchObject({ date: '2026-09-24', time: '17:00' })
  })

  test('a task due at the end of the day has no time', () => {
    expect(itemToForm(item({ starts_at: '2026-09-25T06:59:00Z' }), zone)).toMatchObject({
      date: '2026-09-24',
      time: '',
    })
  })

  test('an appointment keeps its end and location', () => {
    expect(
      itemToForm(
        item({
          kind: 'appointment',
          starts_at: '2026-09-24T21:00:00Z',
          ends_at: '2026-09-24T22:00:00Z',
          location: 'Clinic',
          private_notes: 'Notes',
        }),
        zone,
      ),
    ).toMatchObject({ time: '14:00', endTime: '15:00', location: 'Clinic', notes: 'Notes' })
  })
})

describe('itemPatch', () => {
  test('an unchanged form changes nothing', () => {
    const existing = item({ private_notes: 'Call first' })
    expect(itemPatch(itemToForm(existing, zone), existing, zone)).toEqual({})
  })

  test('sends only the fields that changed', () => {
    const existing = item({})
    const edited = { ...itemToForm(existing, zone), title: 'Refill all meds', time: '18:00' }
    expect(itemPatch(edited, existing, zone)).toEqual({
      title: 'Refill all meds',
      starts_at: '2026-09-25T01:00:00.000Z',
    })
  })

  test('a stored time with seconds is left alone unless the time is changed', () => {
    const existing = item({ starts_at: '2026-09-25T00:00:42.123Z' })
    const edited = { ...itemToForm(existing, zone), title: 'Refill all meds' }
    expect(itemPatch(edited, existing, zone)).toEqual({ title: 'Refill all meds' })
  })

  test('moving an appointment to another day moves its end too', () => {
    const existing = item({
      kind: 'appointment',
      starts_at: '2026-09-24T21:00:00Z',
      ends_at: '2026-09-24T22:00:00Z',
    })
    const edited = { ...itemToForm(existing, zone), date: '2026-09-25' }
    expect(itemPatch(edited, existing, zone)).toEqual({
      starts_at: '2026-09-25T21:00:00.000Z',
      ends_at: '2026-09-25T22:00:00.000Z',
    })
  })

  test('clearing notes or a location sends null', () => {
    const existing = item({ kind: 'appointment', location: 'Clinic', private_notes: 'Notes' })
    const edited = { ...itemToForm(existing, zone), location: ' ', notes: '' }
    expect(itemPatch(edited, existing, zone)).toEqual({ location: null, private_notes: null })
  })
})

describe('needsReconfirm', () => {
  const assigned = item({ state: 'assigned', owner_id: 'jonah' })

  test('a time change by someone else sends it back to the owner', () => {
    expect(needsReconfirm({ starts_at: '2026-09-26T00:00:00Z' }, assigned, 'maya')).toBe(true)
  })

  test('the owner changing their own time does not', () => {
    expect(needsReconfirm({ starts_at: '2026-09-26T00:00:00Z' }, assigned, 'jonah')).toBe(false)
  })

  test('other edits keep the owner', () => {
    expect(needsReconfirm({ title: 'New name' }, assigned, 'maya')).toBe(false)
  })
})
