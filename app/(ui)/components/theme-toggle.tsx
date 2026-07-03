"use client"

import { useTheme } from "@/app/(ui)/components/theme-provider"
import { Button } from "@/app/(ui)/components/button"
import { Moon, Sun, Monitor } from "lucide-react"
import { useSyncExternalStore } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  if (!mounted) {
    return <div className="h-10 w-10 shrink-0" />
  }

  const handleToggle = () => {
    if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("system")
    } else {
      setTheme("light")
    }
  }

  return (
    <Button
      variant="text"
      size="sm"
      className="h-10 w-10 rounded-full flex items-center justify-center p-0 text-on-surface-variant hover:bg-surface-variant cursor-pointer shrink-0"
      onClick={handleToggle}
      title={`Theme: ${theme}. Click to toggle.`}
    >
      {theme === "light" && <Sun className="h-5 w-5" />}
      {theme === "dark" && <Moon className="h-5 w-5" />}
      {theme === "system" && <Monitor className="h-5 w-5" />}
      {theme !== "light" && theme !== "dark" && theme !== "system" && (
        <Monitor className="h-5 w-5" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
