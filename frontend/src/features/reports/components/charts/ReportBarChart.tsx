import * as React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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

export interface ReportBarChartProps {
  data: Array<Record<string, string | number>>
  categoryKey: string
  valueKey: string
  valueLabel?: string
  height?: number
  layout?: 'vertical' | 'horizontal'
  color?: string
}

export function ReportBarChart({
  data,
  categoryKey,
  valueKey,
  valueLabel,
  height = 280,
  layout = 'horizontal',
  color
}: ReportBarChartProps): React.ReactElement {
  const fill = color ?? reportChartColor(0)
  return (
    <div dir="ltr" className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={layout}
          margin={{ top: 8, right: 8, left: layout === 'vertical' ? 48 : 0, bottom: 0 }}
        >
          <CartesianGrid stroke={REPORT_CHART_GRID} strokeDasharray="3 3" />
          {layout === 'vertical' ? (
            <>
              <XAxis type="number" stroke={REPORT_CHART_AXIS} tick={{ fill: REPORT_CHART_AXIS, fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey={categoryKey}
                width={120}
                stroke={REPORT_CHART_AXIS}
                tick={{ fill: REPORT_CHART_AXIS, fontSize: 11 }}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={categoryKey}
                stroke={REPORT_CHART_AXIS}
                tick={{ fill: REPORT_CHART_AXIS, fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={56}
              />
              <YAxis stroke={REPORT_CHART_AXIS} tick={{ fill: REPORT_CHART_AXIS, fontSize: 12 }} />
            </>
          )}
          <Tooltip
            contentStyle={{
              background: REPORT_CHART_TOOLTIP_BG,
              border: `1px solid ${REPORT_CHART_TOOLTIP_BORDER}`,
              borderRadius: 8
            }}
            formatter={(value) => [String(value), valueLabel ?? valueKey]}
          />
          <Bar dataKey={valueKey} fill={fill} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
