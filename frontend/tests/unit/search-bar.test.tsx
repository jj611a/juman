import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '@/components/ui'

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces value changes and clears', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onValueChange = vi.fn()
    render(
      <div dir="rtl">
        <SearchBar value="" onValueChange={onValueChange} debounceMs={300} />
      </div>
    )
    const input = screen.getByRole('searchbox')
    await user.type(input, 'فس')
    expect(onValueChange).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(onValueChange).toHaveBeenCalledWith('فس')
    await user.click(screen.getByLabelText('مسح'))
    expect(onValueChange).toHaveBeenCalledWith('')
  })

  it('invokes onShortcut on Ctrl+K and focuses the input', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onShortcut = vi.fn()
    render(
      <div dir="rtl">
        <SearchBar value="" onValueChange={() => undefined} onShortcut={onShortcut} shortcutHint="Ctrl+K" />
      </div>
    )
    await user.keyboard('{Control>}k{/Control}')
    expect(onShortcut).toHaveBeenCalled()
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })
})
