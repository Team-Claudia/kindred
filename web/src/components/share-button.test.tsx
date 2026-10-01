import { fireEvent, render, screen } from '@testing-library/react'
import '@/i18n'
import { platform } from '@/platform'
import { ShareButton } from './share-button'

const content = { text: 'Physio ride on Friday', url: 'https://kindred.example/i/123' }

afterEach(() => {
  vi.restoreAllMocks()
})

test('opens the share sheet and shows no fallback', async () => {
  const shareSpy = vi.spyOn(platform, 'share').mockResolvedValue('shared')
  render(<ShareButton content={content} />)
  fireEvent.click(screen.getByRole('button', { name: 'Share' }))
  await vi.waitFor(() => expect(shareSpy).toHaveBeenCalledWith(content))
  expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument()
})

test('offers Copy link and WhatsApp without a share sheet', async () => {
  vi.spyOn(platform, 'share').mockResolvedValue('unsupported')
  const copySpy = vi.spyOn(platform, 'copyText').mockResolvedValue(true)
  render(<ShareButton content={content} />)

  fireEvent.click(screen.getByRole('button', { name: 'Share' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }))

  expect(copySpy).toHaveBeenCalledWith(content.url)
  expect(await screen.findByText('Link copied')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Send on WhatsApp' })).toHaveAttribute(
    'href',
    platform.whatsAppUrl(content),
  )
})

test('says so when copying fails', async () => {
  vi.spyOn(platform, 'share').mockResolvedValue('unsupported')
  vi.spyOn(platform, 'copyText').mockResolvedValue(false)
  render(<ShareButton content={content} />)

  fireEvent.click(screen.getByRole('button', { name: 'Share' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }))

  expect(await screen.findByText(/Couldn't copy/)).toBeInTheDocument()
})

test('shows nothing extra when the member cancels the sheet', async () => {
  const shareSpy = vi.spyOn(platform, 'share').mockResolvedValue('cancelled')
  render(<ShareButton content={content} />)
  fireEvent.click(screen.getByRole('button', { name: 'Share' }))
  await vi.waitFor(() => expect(shareSpy).toHaveBeenCalled())
  expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument()
})
