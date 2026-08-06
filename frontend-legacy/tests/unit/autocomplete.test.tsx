import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Autocomplete } from '@/components/ui'

describe('Autocomplete', () => {
  it('filters and selects with keyboard', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Autocomplete
        aria-label="منتج"
        options={[
          { value: 'a', label: 'فستان' },
          { value: 'b', label: 'عباية' }
        ]}
        value={null}
        onChange={onChange}
      />
    )
    const input = screen.getByRole('combobox', { name: 'منتج' })
    await user.click(input)
    await user.type(input, 'عبا')
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
