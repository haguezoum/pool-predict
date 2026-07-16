import { useId, useState } from 'react'
import Stack from '@mui/material/Stack'
import { LineChart } from '@mui/x-charts/LineChart'
import type { ProjectResultView } from '@shared/contracts'
import { useTheme } from '@/context/theme-context'
import type { FridayResult } from '@/types'

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
    projectSeries: isDark ? '#c084fc' : '#9333ea',
  }
}

type FridayLineChartProps = {
  fridays: FridayResult[]
  /** Candidate login — shown in tooltip context */
  login: string
  projectResults?: ProjectResultView[]
  showSeriesControls?: boolean
  projectStatus?: 'idle' | 'loading' | 'error'
}

/**
 * MUI LineChart of Friday results.
 * - Null points = not validated (gaps; connectNulls bridges the line)
 * - Hover a mark to see the exact score (from API soon)
 * - Axis / grid / legend colors follow light & dark theme
 */
export function FridayLineChart({
  fridays,
  login,
  projectResults = [],
  showSeriesControls = false,
  projectStatus = 'idle',
}: FridayLineChartProps) {
  const colors = useChartColors()
  const controlsId = useId()
  const [showExams, setShowExams] = useState(true)
  const [showProjects, setShowProjects] = useState(true)
  const xData = fridays.map((f) => f.label)
  const data = fridays.map((f) => f.value)
  const projectWeeks = fridays.map((_, week) => {
    const scores = projectResults
      .filter((project) => project.week === week && project.score !== null)
      .map((project) => project.score as number)
    return {
      count: scores.length,
      value: scores.length === 0
        ? null
        : Math.round(scores.reduce((total, score) => total + score, 0) / scores.length),
    }
  })
  const examSeriesId = `exams-${login}`
  const projectSeriesId = `projects-${login}`
  const series = [
    ...(!showSeriesControls || showExams
      ? [{
          id: examSeriesId,
          label: showSeriesControls ? 'Exams' : `@${login}`,
          data,
          connectNulls: true,
          showMark: true,
          color: colors.series,
          valueFormatter: (value: number | null, { dataIndex }: { dataIndex: number }) => {
            const friday = fridays[dataIndex]
            if (value == null || !friday?.validated) return 'Not validated'
            return friday.score ? `Score ${friday.score}` : String(value)
          },
        }]
      : []),
    ...(showSeriesControls && showProjects
      ? [{
          id: projectSeriesId,
          label: 'Projects',
          data: projectWeeks.map((week) => week.value),
          connectNulls: true,
          showMark: true,
          color: colors.projectSeries,
          valueFormatter: (value: number | null, { dataIndex }: { dataIndex: number }) => {
            const week = projectWeeks[dataIndex]
            if (value == null || !week?.count) return 'No project score'
            return `Average ${value} · ${week.count} project${week.count === 1 ? '' : 's'}`
          },
        }]
      : []),
  ]

  return (
    <div className="relative z-10 flex w-full flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {showSeriesControls ? 'Weekly scores · 0–100' : 'Last 4 exams'}
        </p>
        {showSeriesControls ? (
          <fieldset className="flex items-center gap-3" aria-label="Chart lines">
            <label
              htmlFor={`${controlsId}-exams`}
              className="flex cursor-pointer items-center gap-1.5 text-xs font-medium"
            >
              <input
                id={`${controlsId}-exams`}
                type="checkbox"
                checked={showExams}
                onChange={(event) => setShowExams(event.target.checked)}
                className="size-3.5 accent-emerald-600"
              />
              Exams
            </label>
            <label
              htmlFor={`${controlsId}-projects`}
              className="flex cursor-pointer items-center gap-1.5 text-xs font-medium"
            >
              <input
                id={`${controlsId}-projects`}
                type="checkbox"
                checked={showProjects}
                onChange={(event) => setShowProjects(event.target.checked)}
                className="size-3.5 accent-purple-600"
              />
              Projects
            </label>
          </fieldset>
        ) : null}
      </div>
      {showSeriesControls && projectStatus !== 'idle' ? (
        <p className="text-xs text-muted-foreground" role="status">
          {projectStatus === 'loading'
            ? 'Loading live project scores…'
            : 'Project scores are temporarily unavailable.'}
        </p>
      ) : null}
      <Stack sx={{ width: '100%', height: showSeriesControls ? 220 : 140, overflow: 'visible' }}>
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
          series={series}
          margin={{ top: showSeriesControls ? 28 : 12, right: 12, bottom: 4, left: 8 }}
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
              strokeWidth: 1.5,
            },
            [`& .MuiLineElement-root[data-series="${projectSeriesId}"]`]: {
              strokeDasharray: '6 4',
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
