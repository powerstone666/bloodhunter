import { cn } from "@/app/(common-lib)/lib/utils"
import { forwardRef } from "react"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-14 w-full rounded-xl bg-surface-variant px-4 py-2 text-base text-on-surface",
          "placeholder:text-on-surface-variant/60",
          "transition-all duration-200 ease-out hover:bg-surface-variant/80 focus:scale-[1.005]",
          "focus:outline-none focus:ring-2 focus:ring-primary",
          "disabled:opacity-38",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
