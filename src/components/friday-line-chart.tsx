import Stack from '@mui/material/Stack'
import { LineChart } from '@mui/x-charts/LineChart'
import { useTheme } from '@/context/theme-context'
import type { FridayResult } from '@/types'

const margin = { top: 12, right: 12, bottom: 4, left: 8 }

/** Chart colors that track light / dark app theme */
function useChartColors() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return {
    axis: isDark ? 'oklch(0.97 0.01 240)' : 'oklch(0.35 0.04 258)',
    tickLabel: isDark ? 'oklch(0.85 0.02 245)' : 'oklch(0.45 0.03 250)',
    grid: isDark ? 'oklch(0.64 0.15 241 / 20%)' : 'oklch(0.50 0.03 250 / 18%)',
    label: isDark ? 'oklch(0.97 0.01 240)' : 'oklch(0.25 0.04 258)',
    series: isDark ? '#22c55e' : '#16a34a',
    markStroke: isDark ? '#16a34a' : '#15803d',
  }
}

type FridayLineChartProps = {
  fridays: FridayResult[]
  /** Candidate login — shown in tooltip context */
  login: string
}

/**
 * MUI LineChart of Friday results.
 * - Null points = not validated (gaps; connectNulls bridges the line)
 * - Hover a mark to see the exact score (from API soon)
 * - Axis / grid / legend colors follow light & dark theme
 */
export function FridayLineChart({ fridays, login }: FridayLineChartProps) {
  const colors = useChartColors()
  const xData = fridays.map((f) => f.label)
  const data = fridays.map((f) => f.value)

  return (
    <div className="relative z-10 flex w-full flex-col gap-1">
      <p className="text-xs text-muted-foreground">Last 4 exams</p>
      <Stack sx={{ width: '100%', height: 140, overflow: 'visible' }}>
        <LineChart
          key={colors.axis}
          xAxis={[
            {
              data: xData,
              scaleType: 'point',
              height: 28,
              tickLabelStyle: {
                fill: colors.tickLabel,
                fontSize: 10,
              },
            },
          ]}
          yAxis={[
            {
              width: 32,
              min: 0,
              max: 100,
              tickNumber: 5,
              tickLabelStyle: {
                fill: colors.tickLabel,
                fontSize: 10,
              },
            },
          ]}
          series={[
            {
              id: `scores-${login}`,
              label: `@${login}`,
              data,
              connectNulls: true,
              showMark: true,
              color: colors.series,
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
              stroke: `${colors.axis} !important`,
              strokeWidth: 1,
            },
            '& .MuiChartsAxis-tick': {
              stroke: `${colors.axis} !important`,
              strokeWidth: 1,
            },
            '& .MuiChartsAxis-tickLabel tspan, & .MuiChartsAxis-tickLabel': {
              fill: `${colors.tickLabel} !important`,
              fontSize: 10,
            },
            '& .MuiChartsGrid-line': {
              stroke: colors.grid,
              strokeDasharray: '3 3',
            },
            '& .MuiMarkElement-root': {
              fill: colors.series,
              stroke: colors.markStroke,
            },
            '& .MuiChartsLabel-root': {
              color: `${colors.label} !important`,
            },
            '& .MuiChartsLegend-series, & .MuiChartsLegend-label, & .MuiChartsLegend-root':
              {
                color: `${colors.label} !important`,
              },
            '& .MuiChartsLegend-series text, & .MuiChartsLegend-label text': {
              fill: `${colors.label} !important`,
            },
          }}
        />
      </Stack>
    </div>
  )
}
