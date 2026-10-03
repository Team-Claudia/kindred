/** Invite codes are 8 letters and numbers, and case matters (`create_invite`). */
export const INVITE_CODE_LENGTH = 8

const CODE = /^[A-Za-z0-9]{8}$/
const LINK = /\/join\/([A-Za-z0-9]{8})(?![A-Za-z0-9])/

/**
 * The invite code from what someone typed or pasted into "I have an invite
 * code": the code itself (spaces ignored), an invite link, or the whole
 * shared message with the link in it. Null if there's no code in it.
 */
export function inviteCodeFromText(text: string): string | null {
  const link = text.match(LINK)
  if (link) return link[1]
  const code = text.replace(/\s+/g, '')
  return CODE.test(code) ? code : null
}
