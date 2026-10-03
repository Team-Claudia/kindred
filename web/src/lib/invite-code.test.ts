import { inviteCodeFromText } from './invite-code'

test('accepts a typed code, keeping its case', () => {
  expect(inviteCodeFromText('aB3dEf7h')).toBe('aB3dEf7h')
  expect(inviteCodeFromText('  aB3d Ef7h \n')).toBe('aB3dEf7h')
})

test('accepts a pasted invite link', () => {
  expect(inviteCodeFromText('https://kindred.example/join/aB3dEf7h')).toBe('aB3dEf7h')
  expect(inviteCodeFromText('kindred.example/join/aB3dEf7h?x=1')).toBe('aB3dEf7h')
})

test('accepts the whole shared message with the link in it', () => {
  expect(
    inviteCodeFromText("Join Dad's Care Circle on Kindred: https://kindred.example/join/aB3dEf7h"),
  ).toBe('aB3dEf7h')
})

test('rejects anything that is not a code', () => {
  expect(inviteCodeFromText('')).toBeNull()
  expect(inviteCodeFromText('abc')).toBeNull()
  expect(inviteCodeFromText('aB3dEf7h9')).toBeNull()
  expect(inviteCodeFromText('aB3d-Ef7')).toBeNull()
  expect(inviteCodeFromText('https://kindred.example/join/aB3dEf7h9')).toBeNull()
  expect(inviteCodeFromText('https://kindred.example/i/aB3dEf7h')).toBeNull()
})
