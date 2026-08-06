import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui'

describe('DropdownMenu', () => {
  it('opens and activates an item', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <div dir="rtl">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>قائمة</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onSelect}>عرض</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
    await user.click(screen.getByRole('button', { name: 'قائمة' }))
    await user.click(await screen.findByText('عرض'))
    expect(onSelect).toHaveBeenCalled()
  })
})
