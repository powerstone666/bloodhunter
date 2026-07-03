import { cn } from "@/app/(common-lib)/lib/utils"
import { forwardRef } from "react"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[96px] w-full rounded-xl bg-surface-variant px-4 py-3 text-base text-on-surface",
          "placeholder:text-on-surface-variant/60",
          "transition-all duration-200 ease-out hover:bg-surface-variant/80 focus:scale-[1.005]",
          "focus:outline-none focus:ring-2 focus:ring-primary",
          "disabled:opacity-38",
          "resize-vertical",
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
