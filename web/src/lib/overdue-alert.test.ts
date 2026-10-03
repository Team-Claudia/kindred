import { overdueAlertFor, type HistoryEvent } from './overdue-alert'

const due = '2026-09-24T17:00:00+00:00'

function alerted(startsAt: string, told: unknown, at = '2026-09-24T17:00:30Z'): HistoryEvent {
  return { type: 'overdue_alerted', data: { starts_at: startsAt, told } as HistoryEvent['data'], at }
}

describe('overdueAlertFor', () => {
  test('nothing before the alert has gone out', () => {
    expect(overdueAlertFor(undefined, due)).toBeNull()
    expect(overdueAlertFor([{ type: 'created', data: {}, at: due }], due)).toBeNull()
  })

  test('the alert for the current due time, whatever its formatting', () => {
    expect(overdueAlertFor([alerted('2026-09-24T10:00:00-07:00', ['jonah', 'maya'])], due)).toEqual({
      told: ['jonah', 'maya'],
      at: '2026-09-24T17:00:30Z',
    })
  })

  test('an alert for an earlier due time no longer counts', () => {
    expect(overdueAlertFor([alerted('2026-09-23T17:00:00Z', ['maya'])], due)).toBeNull()
  })

  test('the newest matching alert wins', () => {
    const history = [
      alerted(due, ['maya'], '2026-09-24T17:00:10Z'),
      alerted(due, ['ada'], '2026-09-24T17:01:00Z'),
    ]
    expect(overdueAlertFor(history, due)?.told).toEqual(['ada'])
  })

  test('malformed rows are ignored', () => {
    expect(overdueAlertFor([{ type: 'overdue_alerted', data: null, at: due }], due)).toBeNull()
    expect(overdueAlertFor([alerted(due, 'maya')], due)).toEqual({
      told: [],
      at: '2026-09-24T17:00:30Z',
    })
    expect(overdueAlertFor([alerted(due, ['maya', 7])], due)?.told).toEqual(['maya'])
  })
})
