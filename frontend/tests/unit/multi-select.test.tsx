import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultiSelect } from '@/components/ui'

describe('MultiSelect', () => {
  it('toggles values', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MultiSelect
        aria-label="وسوم"
        options={[
          { value: 'a', label: 'أ' },
          { value: 'b', label: 'ب' }
        ]}
        value={[]}
        onChange={onChange}
      />
    )
    await user.click(screen.getByRole('button', { name: 'وسوم' }))
    await user.click(screen.getByRole('checkbox', { name: 'أ' }))
    expect(onChange).toHaveBeenCalledWith(['a'])
  })
})
