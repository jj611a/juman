import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui'

describe('Resizable', () => {
  it('renders group panels and handle', () => {
    render(
      <div dir="rtl" style={{ height: 200, width: 400 }}>
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize="40%">
            <span>يسار</span>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize="60%">
            <span>يمين</span>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    )

    expect(screen.getByText('يسار')).toBeInTheDocument()
    expect(screen.getByText('يمين')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })
})
