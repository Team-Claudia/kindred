import i18n from '@/i18n'
import { relationshipLabel, relationships } from './circles'

vi.mock('./supabase', () => ({ supabase: {} }))

const t = i18n.t.bind(i18n)

// Stored as what Dad is to the member ("Dad is my parent"); shown from the
// member's side (task 4.9).
test.each([
  ['parent', "Dad's child"],
  ['grandparent', "Dad's grandchild"],
  ['spouse', "Dad's spouse or partner"],
  ['sibling', "Dad's sibling"],
  ['child', "Dad's parent"],
  ['otherRelative', "Dad's relative"],
  ['friend', "Dad's friend"],
  ['other', 'Helps care for Dad'],
])('a member who said Dad is their %s shows as "%s"', (value, label) => {
  expect(relationshipLabel(t, value, 'Dad')).toBe(label)
})

test('every option has a label', () => {
  for (const value of relationships) {
    expect(relationshipLabel(t, value, 'Dad')).not.toMatch(/relationshipOf/)
  }
})

test('reads a key stored in another case', () => {
  expect(relationshipLabel(t, 'Parent', 'Dad')).toBe("Dad's child")
})

test.each([
  ['no relationship', null, 'Dad'],
  ['an unknown relationship', 'cousin', 'Dad'],
  ['no care recipient name yet', 'parent', undefined],
])('shows nothing for %s', (_label, value, name) => {
  expect(relationshipLabel(t, value, name)).toBeNull()
})
