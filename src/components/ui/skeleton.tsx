import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-xl bg-[linear-gradient(100deg,var(--muted)_25%,color-mix(in_oklch,var(--muted),var(--foreground)_7%)_45%,var(--muted)_65%)] bg-[length:240%_100%]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
