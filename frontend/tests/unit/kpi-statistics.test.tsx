import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KPICard, StatisticsCard } from '@/components/ui'

describe('KPICard', () => {
  it('renders value and loading', () => {
    const { rerender } = render(
      <div dir="rtl">
        <KPICard title="الإيراد" value="1,200" trend="up" trendLabel="+12%" />
      </div>
    )
    expect(screen.getByText('الإيراد')).toBeInTheDocument()
    expect(screen.getByText('1,200')).toBeInTheDocument()
    rerender(
      <div dir="rtl">
        <KPICard title="الإيراد" value="1,200" loading />
      </div>
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders subtitle and trend together', () => {
    render(
      <div dir="rtl">
        <KPICard
          title="الإيراد"
          value="1,200"
          subtitle="هذا الشهر"
          trend="up"
          trendLabel="+12%"
        />
      </div>
    )
    expect(screen.getByText('هذا الشهر')).toBeInTheDocument()
    expect(screen.getByText('+12%')).toBeInTheDocument()
  })
})

describe('StatisticsCard', () => {
  it('renders summaries and comparison', () => {
    render(
      <div dir="rtl">
        <StatisticsCard
          title="ملخص"
          values={[
            { label: 'أجور', value: '10' },
            { label: 'مبيعات', value: '4' }
          ]}
          comparison={{ label: 'مقارنة', value: '14', delta: '+2' }}
        />
      </div>
    )
    expect(screen.getByText('أجور')).toBeInTheDocument()
    expect(screen.getByText('مقارنة')).toBeInTheDocument()
  })
})
