import { useId, useState } from 'react'
import Stack from '@mui/material/Stack'
import useMediaQuery from '@mui/material/useMediaQuery'
import { LineChart } from '@mui/x-charts/LineChart'
import type { ProjectResultView } from '@shared/contracts'
import { useTheme } from '@/context/theme-context'
import type { FridayResult } from '@/types'

/** Chart colors that track light / dark app theme */
function useChartColors() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return {
    axis: isDark ? 'oklch(0.94 0.01 245 / 56%)' : 'oklch(0.28 0.03 255 / 46%)',
    tickLabel: isDark ? 'oklch(0.78 0.02 245)' : 'oklch(0.45 0.025 250)',
    grid: isDark ? 'oklch(0.94 0.01 245 / 10%)' : 'oklch(0.28 0.03 255 / 10%)',
    label: isDark ? 'oklch(0.94 0.01 245)' : 'oklch(0.25 0.03 258)',
    series: 'var(--chart-exam-series)',
    projectSeries: 'var(--chart-project-series)',
    examAxis: 'var(--chart-exam-label)',
  }
}

type FridayLineChartProps = {
  fridays: FridayResult[]
  /** Candidate login — shown in tooltip context */
  login: string
  projectResults?: ProjectResultView[]
  showSeriesControls?: boolean
}

function projectAxisLabel(name: string) {
  return name
    .replace(/^C Piscine\s+/i, '')
    .replace(/^Piscine C\s+/i, '')
    .trim()
}

/** Compact x-axis labels so MUI's shortenLabels doesn't ellipsize them to "". */
function examAxisLabel(label: string) {
  return label.replace(/^Exam\s+/i, '').trim() || label
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
}: FridayLineChartProps) {
  const colors = useChartColors()
  const compact = useMediaQuery('(max-width:639px)')
  const controlsId = useId()
  const [showExams, setShowExams] = useState(true)
  const [showProjects, setShowProjects] = useState(true)
  let latestValidatedProject: ProjectResultView | undefined
  for (const project of projectResults) {
    if (project.validated === true) latestValidatedProject = project
  }
  const projectTimeline = fridays.flatMap((_, examIndex) =>
    projectResults.filter((project) => project.week === examIndex && project.score !== null),
  )
  const progressIndexes = Array.from(
    { length: Math.max(fridays.length, showSeriesControls ? projectTimeline.length : 0) },
    (_, index) => index,
  )
  const examData = progressIndexes.map((index) => fridays[index]?.value ?? null)
  const projectData = progressIndexes.map((index) => projectTimeline[index]?.score ?? null)
  const examSeriesId = `exams-${login}`
  const projectSeriesId = `projects-${login}`
  const examAxisId = `exam-axis-${login}`
  const projectAxisId = `project-axis-${login}`
  const series = [
    ...(!showSeriesControls || showExams
      ? [{
          id: examSeriesId,
          label: showSeriesControls ? 'Exams' : `@${login}`,
          data: examData,
          xAxisId: showSeriesControls ? examAxisId : undefined,
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
          label: latestValidatedProject?.name ?? 'Projects',
          data: projectData,
          xAxisId: projectAxisId,
          connectNulls: true,
          showMark: true,
          color: colors.projectSeries,
          valueFormatter: (value: number | null, { dataIndex }: { dataIndex: number }) => {
            const project = projectTimeline[dataIndex]
            if (value == null || !project) return 'No project score'
            return `${project.name} · Score ${value}`
          },
        }]
      : []),
  ]

  return (
    <div className="relative z-10 flex w-full min-w-0 flex-col gap-2 overflow-hidden sm:overflow-visible">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {showSeriesControls ? 'Exam & project progression · 0–100' : 'Last 4 exams'}
        </p>
        {showSeriesControls ? (
          <fieldset className="flex items-center gap-1" aria-label="Chart lines">
            <label
              htmlFor={`${controlsId}-exams`}
              className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-2 text-xs font-medium transition-[background-color] duration-160 hover:bg-muted/52"
            >
              <input
                id={`${controlsId}-exams`}
                type="checkbox"
                checked={showExams}
                onChange={(event) => setShowExams(event.target.checked)}
                className="native-check"
                style={{ accentColor: 'var(--chart-exam-series)' }}
              />
              Exams
            </label>
            <label
              htmlFor={`${controlsId}-projects`}
              className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-2 text-xs font-medium transition-[background-color] duration-160 hover:bg-muted/52"
            >
              <input
                id={`${controlsId}-projects`}
                type="checkbox"
                checked={showProjects}
                onChange={(event) => setShowProjects(event.target.checked)}
                className="native-check"
                style={{ accentColor: 'var(--chart-project-series)' }}
              />
              Projects
            </label>
          </fieldset>
        ) : null}
      </div>
      <Stack
        sx={{
          width: '100%',
          // Card charts need bottom room for x labels; detail chart needs room for 45° project labels
          height: showSeriesControls ? (compact ? 330 : 380) : 176,
          overflow: 'visible',
          fontFamily: 'var(--font-sans)',
          '& .MuiChartsSurface-root, & svg, & .MuiChartsAxis-root, & .MuiChartsAxis-tickLabel': {
            overflow: 'visible',
          },
        }}
      >
        <LineChart
          key={colors.axis}
          // Card charts: legend steals height and squeezes x labels until MUI ellipsizes them to ""
          hideLegend={!showSeriesControls}
          xAxis={[
            ...(showSeriesControls
              ? [
                  {
                    id: projectAxisId,
                    data: progressIndexes,
                    scaleType: 'point' as const,
                    position: 'bottom' as const,
                    height: 'auto' as const,
                    valueFormatter: (value: number) => {
                      if (!showProjects) return ''
                      const project = projectTimeline[value]
                      if (
                        compact &&
                        projectTimeline.length > 5 &&
                        value !== 0 &&
                        value !== projectTimeline.length - 1 &&
                        value % 2 !== 0
                      ) {
                        return ''
                      }
                      return project ? projectAxisLabel(project.name) : ''
                    },
                    tickLabelInterval: () => true,
                    tickLabelMinGap: 0,
                    tickLabelStyle: {
                      fill: colors.projectSeries,
                      fontSize: compact ? 8 : 9,
                      fontWeight: 600,
                      angle: 45,
                      textAnchor: 'start' as const,
                      dominantBaseline: 'hanging' as const,
                    },
                  },
                  {
                    id: examAxisId,
                    data: progressIndexes,
                    scaleType: 'point' as const,
                    position: 'top' as const,
                    height: 'auto' as const,
                    valueFormatter: (value: number) => {
                      if (!showExams) return ''
                      return examAxisLabel(fridays[value]?.label ?? '')
                    },
                    tickLabelInterval: () => true,
                    tickLabelMinGap: 0,
                    tickLabelStyle: {
                      fill: colors.examAxis,
                      fontSize: 10,
                      fontWeight: 700,
                    },
                  },
                ]
              : [
                  {
                    data: progressIndexes,
                    scaleType: 'point' as const,
                    height: 'auto' as const,
                    valueFormatter: (value: number) =>
                      examAxisLabel(fridays[value]?.label ?? ''),
                    tickLabelInterval: () => true,
                    tickLabelMinGap: 0,
                    tickLabelStyle: {
                      fill: colors.tickLabel,
                      fontSize: 11,
                      fontWeight: 600,
                    },
                  },
                ]),
          ]}
          yAxis={[
            {
              width: compact ? 28 : 34,
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
          margin={{
            // Edge labels use (margin + axis) as width budget; too small → empty tspans
            top: showSeriesControls ? 36 : 8,
            right: showSeriesControls ? (compact ? 30 : 56) : 20,
            bottom: showSeriesControls ? 8 : 8,
            left: showSeriesControls ? 8 : 8,
          }}
          grid={{ horizontal: true }}
          slotProps={{
            legend: showSeriesControls
              ? {
                  direction: 'horizontal',
                  position: { vertical: 'top', horizontal: 'center' },
                  sx: {
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    rowGap: 0.5,
                    maxWidth: 180,
                    '& .MuiChartsLegend-label': {
                      maxWidth: 150,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  },
                }
              : undefined,
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
            '& .MuiChartsSurface-root, & svg': {
              overflow: 'visible',
            },
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
              fontSize: 11,
              fontWeight: 600,
            },
            [`& .MuiChartsAxis-root[data-axis-id="${examAxisId}"] .MuiChartsAxis-tickLabel tspan, & .MuiChartsAxis-root[data-axis-id="${examAxisId}"] .MuiChartsAxis-tickLabel`]: {
              fill: `${colors.examAxis} !important`,
              fontWeight: 700,
              fontSize: 10,
            },
            [`& .MuiChartsAxis-root[data-axis-id="${projectAxisId}"] .MuiChartsAxis-tickLabel tspan, & .MuiChartsAxis-root[data-axis-id="${projectAxisId}"] .MuiChartsAxis-tickLabel`]: {
              fill: `${colors.projectSeries} !important`,
              fontWeight: 600,
              fontSize: 9,
            },
            '& .MuiChartsGrid-line': {
              stroke: colors.grid,
              strokeDasharray: '3 3',
            },
            '& .MuiMarkElement-root': {
              strokeWidth: 1.5,
            },
            '& .MuiLineElement-root': {
              strokeWidth: 2.4,
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
