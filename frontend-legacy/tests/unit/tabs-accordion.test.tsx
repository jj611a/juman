import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui'

describe('Tabs', () => {
  it('activates tab with keyboard (RTL)', async () => {
    const user = userEvent.setup()
    render(
      <div dir="rtl">
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">واحد</TabsTrigger>
            <TabsTrigger value="two">اثنان</TabsTrigger>
          </TabsList>
          <TabsContent value="one">محتوى واحد</TabsContent>
          <TabsContent value="two">محتوى اثنان</TabsContent>
        </Tabs>
      </div>
    )

    expect(screen.getByText('محتوى واحد')).toBeInTheDocument()
    const tabOne = screen.getByRole('tab', { name: 'واحد' })
    tabOne.focus()
    await user.keyboard('{ArrowLeft}')
    expect(await screen.findByText('محتوى اثنان')).toBeInTheDocument()
  })

  it('supports controlled mode, disabled, icon and badge', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <div dir="rtl">
        <Tabs value="a" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="a" icon="LayoutGrid" badge={3}>
              أ
            </TabsTrigger>
            <TabsTrigger value="b">ب</TabsTrigger>
            <TabsTrigger value="c" disabled>
              ج
            </TabsTrigger>
          </TabsList>
          <TabsContent value="a">محتوى أ</TabsContent>
          <TabsContent value="b">محتوى ب</TabsContent>
        </Tabs>
      </div>
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'ج' })).toBeDisabled()
    await user.click(screen.getByRole('tab', { name: 'ب' }))
    expect(onValueChange).toHaveBeenCalledWith('b')
  })

  it('lazy=false keeps inactive content mounted but hidden', () => {
    render(
      <div dir="rtl">
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">أ</TabsTrigger>
            <TabsTrigger value="b">ب</TabsTrigger>
          </TabsList>
          <TabsContent value="a" lazy={false}>
            ثابت-أ
          </TabsContent>
          <TabsContent value="b" lazy={false}>
            ثابت-ب
          </TabsContent>
        </Tabs>
      </div>
    )
    expect(screen.getByText('ثابت-أ')).toBeInTheDocument()
    expect(screen.getByText('ثابت-ب')).toBeInTheDocument()
  })
})

describe('Accordion', () => {
  it('opens item via keyboard activation', async () => {
    const user = userEvent.setup()
    render(
      <div dir="rtl">
        <Accordion type="single" collapsible>
          <AccordionItem value="a">
            <AccordionTrigger>سؤال</AccordionTrigger>
            <AccordionContent>جواب</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    )

    const trigger = screen.getByRole('button', { name: /سؤال/ })
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('جواب')).toBeInTheDocument()
  })
})
