import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui'

describe('Drawer', () => {
  it('defaults to right side and closes with Escape', async () => {
    const user = userEvent.setup()
    render(
      <div dir="rtl">
        <Drawer>
          <DrawerTrigger asChild>
            <Button>درج</Button>
          </DrawerTrigger>
          <DrawerContent data-testid="drawer-panel">
            <DrawerTitle>عنوان الدرج</DrawerTitle>
          </DrawerContent>
        </Drawer>
      </div>
    )

    await user.click(screen.getByRole('button', { name: 'درج' }))
    const panel = await screen.findByTestId('drawer-panel')
    expect(panel).toBeInTheDocument()
    expect(panel.className).toMatch(/end-0/)
    expect(panel.className).toMatch(/drawer-md|w-\[var\(--drawer-md\)\]/)

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('drawer-panel')).not.toBeInTheDocument()
  })
})
