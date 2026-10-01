import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import '@/i18n'
import { codeFromText } from '@/lib/sign-in-code'
import { CodeInput } from './code-input'

test.each([
  ['123456', '123456'],
  ['123 456', '123456'],
  ['Your Kindred code is 482913', '482913'],
  ['Code 482913, expires in 1 hour', '482913'],
  ['12-34-56', '123456'],
  ['1234567', '123456'],
  ['12', '12'],
  ['no digits', ''],
])('codeFromText(%j) is %j', (text, code) => {
  expect(codeFromText(text)).toBe(code)
})

function Harness({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <CodeInput
      id="code"
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

test('pasting a code with surrounding text fills all six boxes', () => {
  const onChange = vi.fn()
  render(<Harness onChange={onChange} />)
  const input = screen.getByRole('textbox')

  fireEvent.paste(input, { clipboardData: { getData: () => 'Your code is 123 456' } })

  expect(onChange).toHaveBeenLastCalledWith('123456')
  expect(input).toHaveValue('123456')
})

test('pasting text with no digits keeps what was typed', () => {
  render(<Harness />)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: '123' } })

  fireEvent.paste(input, { clipboardData: { getData: () => 'hello' } })

  expect(input).toHaveValue('123')
})

test('typing keeps digits only', () => {
  render(<Harness />)
  const input = screen.getByRole('textbox')

  fireEvent.change(input, { target: { value: '12a3' } })

  expect(input).toHaveValue('123')
})

test('the input stays visible to the browser so iPhone offers Paste', () => {
  render(<Harness />)
  const input = screen.getByRole('textbox')
  expect(input).not.toHaveClass('opacity-0')
  expect(input).toHaveClass('text-transparent')
})
