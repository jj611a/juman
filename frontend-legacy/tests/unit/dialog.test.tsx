import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from '@/components/ui'

describe('Dialog', () => {
  it('opens and closes with Escape; restores focus', async () => {
    const user = userEvent.setup()
    render(
      <div dir="rtl">
        <Dialog>
          <DialogTrigger asChild>
            <Button>افتح</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>عنوان الحوار</DialogTitle>
            <DialogDescription>وصف الحوار</DialogDescription>
          </DialogContent>
        </Dialog>
      </div>
    )

    const trigger = screen.getByRole('button', { name: 'افتح' })
    await user.click(trigger)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('عنوان الحوار')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
