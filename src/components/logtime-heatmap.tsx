import type { LogtimeIntensity, LogtimeSlot } from '@/types'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

const intensityClass: Record<LogtimeIntensity, string> = {
  0: 'bg-blue-500/10',
  1: 'bg-blue-400/35',
  2: 'bg-blue-500/55',
  3: 'bg-blue-600/80',
  4: 'bg-blue-800',
}

const intensityLabel: Record<LogtimeIntensity, string> = {
  0: 'No activity',
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Very high',
}

type LogtimeHeatmapProps = {
  logtime: LogtimeSlot[]
  className?: string
}

/**
 * GitHub-style contribution heatmap for logtime:
 * rows = time slots, columns = Mon–Sun
 */
export function LogtimeHeatmap({ logtime, className }: LogtimeHeatmapProps) {
  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div
        className="grid gap-1.5 sm:gap-2"
        style={{
          gridTemplateColumns: 'auto repeat(7, minmax(0, 1fr))',
        }}
      >
        {/* Header row: empty corner + day labels */}
        <div />
        {DAY_LABELS.map((day, i) => (
          <div
            key={`${day}-${i}`}
            className="flex items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {/* Time rows */}
        {logtime.map((slot) => (
          <div key={slot.time} className="contents">
            <div className="flex items-center pr-2 text-xs tabular-nums text-muted-foreground sm:pr-3">
              {slot.time}
            </div>
            {slot.days.map((level, dayIndex) => (
              <div
                key={`${slot.time}-${dayIndex}`}
                title={`${slot.time} · ${DAY_LABELS[dayIndex]}: ${intensityLabel[level]}`}
                className={cn(
                  'aspect-square w-full max-w-10 justify-self-center rounded-md sm:rounded-lg',
                  intensityClass[level]
                )}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1.5 text-[0.65rem] text-muted-foreground">
        <span>Less</span>
        {([0, 1, 2, 3, 4] as LogtimeIntensity[]).map((level) => (
          <span
            key={level}
            className={cn('size-3 rounded-sm', intensityClass[level])}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
