import * as React from 'react'
import { Link, Navigate } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle, Page, PageHeader } from '@/components/ui'
import { useAnyPermission, usePermission } from '@/hooks/usePermission'

interface ReportCategory {
  to: string
  title: string
  description: string
  permission?: string
  financial?: boolean
}

/** Nest V2-available report categories only (inspections/processing/sales removed). */
const CATEGORIES: ReportCategory[] = [
  {
    to: '/reports/dashboard',
    title: 'لوحة التشغيل',
    description: 'لقطة تشغيلية — تأجير، مخزون، تسويات، إيراد'
  },
  {
    to: '/reports/inventory',
    title: 'المخزون',
    description: 'توزيع العناصر حسب الحالة والخصائص'
  },
  {
    to: '/reports/rentals',
    title: 'الإيجارات',
    description: 'ملخص الإيجارات الحالية والمتأخرة والتاريخ'
  },
  {
    to: '/reports/reservations',
    title: 'الحجوزات',
    description: 'حجوزات الفترة'
  },
  {
    to: '/reports/customers',
    title: 'العملاء',
    description: 'تقارير العملاء (حسب المعرّف في Backend V2)'
  },
  {
    to: '/reports/financial',
    title: 'المالي',
    description: 'إيراد، مستحقات، رسوم وتسويات',
    financial: true
  }
]

export default function ReportsHomePage(): React.ReactElement {
  const canView = useAnyPermission(['reports.view'])
  const canFinancial = usePermission('reports.financial.view')

  if (!canView) return <Navigate to="/forbidden" replace />

  return (
    <Page size="lg" as="main">
      <PageHeader title="التقارير" description="تقارير تشغيلية ومالية — القيم من الخادم فقط." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CATEGORIES.map((cat) => {
          if (cat.financial && !canFinancial) return null
          return (
            <Link key={cat.to} to={cat.to} className="block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <Card className="h-full transition-colors hover:border-brand">
                <CardHeader>
                  <CardTitle>{cat.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-caption text-muted-foreground">{cat.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </Page>
  )
}
