import * as React from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  REPORT_CHART_AXIS,
  REPORT_CHART_GRID,
  REPORT_CHART_TOOLTIP_BG,
  REPORT_CHART_TOOLTIP_BORDER,
  reportChartColor
} from './chartTheme'

export interface ReportLineSeries {
  key: string
  label: string
  color?: string
}

export interface ReportLineChartProps {
  data: Array<Record<string, string | number>>
  xKey: string
  series: ReportLineSeries[]
  height?: number
  yFormatter?: (value: number) => string
}

export function ReportLineChart({
  data,
  xKey,
  series,
  height = 280,
  yFormatter
}: ReportLineChartProps): React.ReactElement {
  return (
    <div dir="ltr" className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={REPORT_CHART_GRID} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} stroke={REPORT_CHART_AXIS} tick={{ fill: REPORT_CHART_AXIS, fontSize: 12 }} />
          <YAxis
            stroke={REPORT_CHART_AXIS}
            tick={{ fill: REPORT_CHART_AXIS, fontSize: 12 }}
            tickFormatter={(v) => (yFormatter ? yFormatter(Number(v)) : String(v))}
          />
          <Tooltip
            contentStyle={{
              background: REPORT_CHART_TOOLTIP_BG,
              border: `1px solid ${REPORT_CHART_TOOLTIP_BORDER}`,
              borderRadius: 8
            }}
            formatter={(value, name) => [
              yFormatter ? yFormatter(Number(value)) : String(value),
              String(name)
            ]}
          />
          <Legend wrapperStyle={{ direction: 'rtl', textAlign: 'right' }} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? reportChartColor(i)}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
