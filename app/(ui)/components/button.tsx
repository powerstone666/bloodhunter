import { cn } from "@/app/(common-lib)/lib/utils"
import { forwardRef } from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "filled" | "outlined" | "text" | "tonal"
  size?: "sm" | "md" | "lg"
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "filled", size = "md", children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 ease-out active:scale-95 disabled:scale-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-38 disabled:pointer-events-none disabled:cursor-not-allowed"
    
    const variants = {
      filled: "bg-primary text-on-primary hover:shadow-md focus:ring-primary",
      outlined: "border border-outline text-primary hover:bg-primary/8 focus:ring-primary",
      text: "text-primary hover:bg-primary/8 focus:ring-primary",
      tonal: "bg-secondary-container text-on-secondary-container hover:shadow-sm focus:ring-secondary",
    }
    
    const sizes = {
      sm: "h-8 px-4 text-sm",
      md: "h-10 px-6 text-base",
      lg: "h-14 px-8 text-base",
    }
    
    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
