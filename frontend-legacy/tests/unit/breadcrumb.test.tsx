import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  buildBreadcrumbTrail
} from '@/components/ui'

describe('Breadcrumb', () => {
  it('exposes nav landmark and current page', () => {
    render(
      <div dir="rtl">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#/dev">الرئيسية</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbCurrent>الحالي</BreadcrumbCurrent>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    )

    expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toBeInTheDocument()
    const current = screen.getByText('الحالي')
    expect(current.closest('[aria-current="page"]')).toBeTruthy()
  })

  it('supports RTL truncation and custom separator', () => {
    const { container } = render(
      <div dir="rtl">
        <Breadcrumb>
          <BreadcrumbList truncate>
            <BreadcrumbItem>
              <BreadcrumbLink href="#/" icon="House">
                الرئيسية بمسار طويل جداً للتحقق من القص
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbCurrent>صفحة طويلة الاسم أيضاً للقص</BreadcrumbCurrent>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    )
    expect(container.querySelector('[data-truncate]')).toBeTruthy()
    expect(screen.getByText('/')).toBeInTheDocument()
  })

  it('is keyboard focusable on links', async () => {
    const user = userEvent.setup()
    render(
      <div dir="rtl">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#/dev">الرئيسية</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbCurrent>الحالي</BreadcrumbCurrent>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    )
    await user.tab()
    expect(screen.getByRole('link', { name: 'الرئيسية' })).toHaveFocus()
  })

  it('buildBreadcrumbTrail collapses middle crumbs', () => {
    const trail = buildBreadcrumbTrail(
      [
        { id: '1', label: 'أ' },
        { id: '2', label: 'ب' },
        { id: '3', label: 'ج' },
        { id: '4', label: 'د' },
        { id: '5', label: 'هـ', current: true }
      ],
      { maxItems: 4 }
    )
    expect(trail).toHaveLength(4)
    expect(trail[1]?.id).toBe('__ellipsis')
    expect(trail[0]?.label).toBe('أ')
    expect(trail.at(-1)?.label).toBe('هـ')
  })

  it('renders Home + ellipsis for long dynamic paths', () => {
    const crumbs = buildBreadcrumbTrail(
      [
        { id: 'home', label: 'الرئيسية', href: '#', icon: 'House' },
        { id: 'm', label: 'المخزون', href: '#' },
        { id: 's', label: 'الفساتين', href: '#' },
        { id: 'd', label: 'تفاصيل', current: true }
      ],
      { maxItems: 3 }
    )
    render(
      <div dir="rtl">
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.flatMap((c, i) => {
              const nodes = []
              if (i > 0) nodes.push(<BreadcrumbSeparator key={`sep-${c.id}`} />)
              nodes.push(
                <BreadcrumbItem key={c.id}>
                  {c.id === '__ellipsis' ? (
                    <BreadcrumbEllipsis />
                  ) : c.current ? (
                    <BreadcrumbCurrent>{c.label}</BreadcrumbCurrent>
                  ) : (
                    <BreadcrumbLink href={c.href} icon={c.icon}>
                      {c.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              )
              return nodes
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    )
    expect(screen.getByText('المزيد')).toBeInTheDocument()
    expect(screen.getByText('تفاصيل')).toBeInTheDocument()
    expect(screen.getByText('الرئيسية')).toBeInTheDocument()
  })

  it('dynamic trail updates', () => {
    const { rerender } = render(
      <div dir="rtl">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">الرئيسية</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbCurrent>أ</BreadcrumbCurrent>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    )
    expect(screen.getByText('أ')).toBeInTheDocument()
    rerender(
      <div dir="rtl">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">الرئيسية</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">المخزون</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbCurrent>ب</BreadcrumbCurrent>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    )
    expect(screen.getByText('المخزون')).toBeInTheDocument()
    expect(screen.getByText('ب')).toBeInTheDocument()
    expect(screen.queryByText('أ')).not.toBeInTheDocument()
  })
})
