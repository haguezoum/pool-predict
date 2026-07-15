import Stack from '@mui/material/Stack'
import { LineChart } from '@mui/x-charts/LineChart'
import type { FridayResult } from '@/types'

const margin = { top: 12, right: 12, bottom: 4, left: 8 }

type FridayLineChartProps = {
  fridays: FridayResult[]
  /** Candidate login — shown in tooltip context */
  login: string
}

/**
 * MUI LineChart of Friday results.
 * - Null points = not validated (gaps; connectNulls bridges the line)
 * - Hover a mark to see the exact score (from API soon)
 */
export function FridayLineChart({ fridays, login }: FridayLineChartProps) {
  const xData = fridays.map((f) => f.label)
  const data = fridays.map((f) => f.value)

  return (
    <div className="relative z-10 flex w-full flex-col gap-1">
      <p className="text-xs text-muted-foreground">Last 4 exams</p>
      <Stack sx={{ width: '100%', height: 140, overflow: 'visible' }}>
        <LineChart
          xAxis={[
            {
              data: xData,
              scaleType: 'point',
              height: 28,
              tickLabelStyle: { fill: '#ffffff', fontSize: 10 },
            },
          ]}
          yAxis={[
            {
              width: 32,
              min: 0,
              max: 100,
              tickNumber: 5,
              tickLabelStyle: { fill: '#ffffff', fontSize: 10 },
            },
          ]}
          series={[
            {
              id: `scores-${login}`,
              label: `@${login}`,
              data,
              connectNulls: true,
              showMark: true,
              color: '#22c55e',
              valueFormatter: (value, { dataIndex }) => {
                const friday = fridays[dataIndex]
                if (value == null || !friday?.validated) {
                  return 'Not validated'
                }
                return friday.score ? `Score ${friday.score}` : String(value)
              },
            },
          ]}
          margin={margin}
          grid={{ horizontal: true }}
          slotProps={{
            tooltip: {
              // Popper portals to body — keep above grid cards
              sx: { zIndex: 9999 },
              style: { zIndex: 9999 },
              disablePortal: false,
            },
          }}
          sx={{
            width: '100%',
            overflow: 'visible',
            '& .MuiChartsAxis-line': {
              stroke: '#ffffff !important',
              strokeWidth: 1,
            },
            '& .MuiChartsAxis-tick': {
              stroke: '#ffffff !important',
              strokeWidth: 1,
            },
            '& .MuiChartsAxis-tickLabel tspan, & .MuiChartsAxis-tickLabel': {
              fill: '#ffffff !important',
              fontSize: 10,
            },
            '& .MuiChartsGrid-line': {
              stroke: 'rgba(255,255,255,0.2)',
              strokeDasharray: '3 3',
            },
            '& .MuiMarkElement-root': {
              fill: '#22c55e',
              stroke: '#16a34a',
            },
            // Legend series label (e.g. @anass) — span uses color
            '& .MuiChartsLabel-root': {
              color: '#ffffff !important',
            },
            '& .MuiChartsLegend-series, & .MuiChartsLegend-label, & .MuiChartsLegend-root':
              {
                color: '#ffffff !important',
              },
            '& .MuiChartsLegend-series text, & .MuiChartsLegend-label text': {
              fill: '#ffffff !important',
            },
          }}
        />
      </Stack>
    </div>
  )
}
