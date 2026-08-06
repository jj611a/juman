import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilePicker } from '@/components/ui'

describe('FilePicker', () => {
  it('fires onChange when a file is chosen', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FilePicker onChange={onChange} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    await user.upload(input, file)
    expect(onChange).toHaveBeenCalled()
    const list = onChange.mock.calls[0][0] as FileList
    expect(list?.[0]?.name).toBe('a.txt')
  })
})
