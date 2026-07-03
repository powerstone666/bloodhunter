import { cn } from "@/app/(common-lib)/lib/utils"
import { forwardRef } from "react"

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-sm font-medium text-on-surface-variant",
          className
        )}
        {...props}
      />
    )
  }
)
Label.displayName = "Label"

export { Label }
