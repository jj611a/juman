import * as React from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  REPORT_CHART_TOOLTIP_BG,
  REPORT_CHART_TOOLTIP_BORDER,
  reportChartColor
} from './chartTheme'

export interface ReportPieChartItem {
  name: string
  value: number
}

export interface ReportPieChartProps {
  data: ReportPieChartItem[]
  height?: number
}

export function ReportPieChart({ data, height = 280 }: ReportPieChartProps): React.ReactElement {
  return (
    <div dir="ltr" className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="78%"
            label={({ name, percent }) =>
              `${name} (${Math.round((percent ?? 0) * 100)}%)`
            }
          >
            {data.map((_, i) => (
              <Cell key={i} fill={reportChartColor(i)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: REPORT_CHART_TOOLTIP_BG,
              border: `1px solid ${REPORT_CHART_TOOLTIP_BORDER}`,
              borderRadius: 8
            }}
          />
          <Legend wrapperStyle={{ direction: 'rtl', textAlign: 'right' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
