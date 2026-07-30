import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui'

describe('Tooltip', () => {
  it('shows content on focus', async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>زر</Button>
          </TooltipTrigger>
          <TooltipContent>تلميح</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
    await user.tab()
    expect(await screen.findByText('تلميح')).toBeInTheDocument()
  })
})
