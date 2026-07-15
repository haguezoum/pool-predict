import { cn } from '@/lib/utils'

/** Official-style 42 monogram for the Intra login button */
export function FortyTwoLogo({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-5', className)}
      aria-hidden
      {...props}
    >
      <path d="M3 20.5h6.2V14H3V8.5h12.5V26H9.2v-5.5H3zm16.8-12h6.3l6.2 9.2V8.5H39V26h-6.3l-6.2-9.2V26H20V8.5h-.2z" />
    </svg>
  )
}
