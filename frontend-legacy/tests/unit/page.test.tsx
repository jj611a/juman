import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Page,
  PageActions,
  PageContent,
  PageFooter,
  PageHeader,
  PageSubtitle,
  PageTitle,
  PageToolbar
} from '@/components/ui'

describe('Page', () => {
  it('renders prop-driven header slots and content', () => {
    render(
      <div dir="rtl">
        <Page>
          <PageHeader
            title="عنوان الصفحة"
            description="وصف"
            breadcrumbs={<nav aria-label="breadcrumb">فتات</nav>}
            actions={<button type="button">إجراء</button>}
          />
          <PageContent>الجسم</PageContent>
          <PageActions>
            <button type="button">حفظ</button>
          </PageActions>
        </Page>
      </div>
    )
    expect(screen.getByRole('heading', { level: 1, name: 'عنوان الصفحة' })).toBeInTheDocument()
    expect(screen.getByText('وصف')).toBeInTheDocument()
    expect(screen.getByText('فتات')).toBeInTheDocument()
    expect(screen.getByText('الجسم')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'حفظ' })).toBeInTheDocument()
  })

  it('supports compositional header, toolbar, footer, and size', () => {
    const { container } = render(
      <div dir="rtl">
        <Page size="md" as="main">
          <PageHeader>
            <PageTitle>مركّب</PageTitle>
            <PageSubtitle>فرعي</PageSubtitle>
            <PageActions>
              <button type="button">عمل</button>
            </PageActions>
          </PageHeader>
          <PageToolbar>
            <span>شريط</span>
          </PageToolbar>
          <PageContent>محتوى</PageContent>
          <PageFooter>
            <span>تذييل</span>
          </PageFooter>
        </Page>
      </div>
    )
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'مركّب' })).toBeInTheDocument()
    expect(screen.getByRole('toolbar')).toHaveTextContent('شريط')
    expect(screen.getByText('تذييل').closest('footer')).toBeTruthy()
    expect(container.querySelector('.max-w-5xl')).toBeTruthy()
    const actions = screen.getByRole('button', { name: 'عمل' }).parentElement
    expect(actions?.className).toMatch(/justify-end/)
  })

  it('PageContent shows loading and empty', () => {
    const { rerender } = render(
      <div dir="rtl">
        <PageContent loading>مخفي</PageContent>
      </div>
    )
    expect(screen.getByText('جاري التحميل…')).toBeInTheDocument()
    expect(screen.queryByText('مخفي')).not.toBeInTheDocument()

    rerender(
      <div dir="rtl">
        <PageContent empty={<span>فارغ</span>} />
      </div>
    )
    expect(screen.getByText('فارغ')).toBeInTheDocument()
  })

  it('children win over title props on PageHeader', () => {
    render(
      <div dir="rtl">
        <PageHeader title="من الخصائص">
          <PageTitle>من الأبناء</PageTitle>
        </PageHeader>
      </div>
    )
    expect(screen.getByRole('heading', { name: 'من الأبناء' })).toBeInTheDocument()
    expect(screen.queryByText('من الخصائص')).not.toBeInTheDocument()
  })
})
