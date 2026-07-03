type LogLevel = "debug" | "info" | "warn" | "error" | "success"

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
}

const STAGE_ICONS: Record<string, string> = {
  SCAN: "🔍",
  DOCKER: "🐳",
  AGENT: "🤖",
  TOOL: "🔧",
  MODEL: "🧠",
  PROMPT: "📝",
  EVENT: "📡",
  DB: "💾",
  AUTH: "🔐",
  SANDBOX: "📦",
  SHELL: "⚡",
  HTTP: "🌐",
  ERROR: "❌",
  SUCCESS: "✅",
  WARN: "⚠️",
  START: "🚀",
  STOP: "🛑",
  TIMER: "⏱️",
}

class Logger {
  private minLevel: LogLevel = process.env.LOG_LEVEL === "debug" ? "debug" : "info"
  private timers = new Map<string, number>()

  private levelOrder: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    success: 1,
  }

  private levelColors: Record<LogLevel, string> = {
    debug: COLORS.gray,
    info: COLORS.blue,
    warn: COLORS.yellow,
    error: COLORS.red,
    success: COLORS.green,
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelOrder[level] >= this.levelOrder[this.minLevel]
  }

  private timestamp(): string {
    return `${COLORS.dim}${new Date().toISOString().split("T")[1].replace("Z", "")}${COLORS.reset}`
  }

  private formatStage(stage: string): string {
    const icon = STAGE_ICONS[stage] || "•"
    return `${COLORS.cyan}${icon} [${stage}]${COLORS.reset}`
  }

  private formatLevel(level: LogLevel): string {
    return `${this.levelColors[level]}${level.toUpperCase().padEnd(7)}${COLORS.reset}`
  }

  private formatContext(ctx?: Record<string, unknown>): string {
    if (!ctx || Object.keys(ctx).length === 0) return ""
    const parts = Object.entries(ctx)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${COLORS.dim}${k}=${COLORS.reset}${typeof v === "string" ? v : JSON.stringify(v)}`)
    return parts.length > 0 ? ` ${parts.join(" ")}` : ""
  }

  private formatData(data?: Record<string, unknown>): string {
    if (!data || Object.keys(data).length === 0) return ""
    return `\n    ${COLORS.dim}${JSON.stringify(data, null, 2).split("\n").join("\n    ")}${COLORS.reset}`
  }

  log(level: LogLevel, stage: string, message: string, ctx?: Record<string, unknown>, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return
    const line = `${this.timestamp()} ${this.formatLevel(level)} ${this.formatStage(stage)} ${message}${this.formatContext(ctx)}${this.formatData(data)}`
    
    if (level === "error") {
      console.error(line)
    } else if (level === "warn") {
      console.warn(line)
    } else if (level === "debug") {
      console.debug(line)
    } else {
      console.log(line)
    }
  }

  debug(stage: string, message: string, ctx?: Record<string, unknown>, data?: Record<string, unknown>): void {
    this.log("debug", stage, message, ctx, data)
  }

  info(stage: string, message: string, ctx?: Record<string, unknown>, data?: Record<string, unknown>): void {
    this.log("info", stage, message, ctx, data)
  }

  warn(stage: string, message: string, ctx?: Record<string, unknown>, data?: Record<string, unknown>): void {
    this.log("warn", stage, message, ctx, data)
  }

  error(stage: string, message: string, ctx?: Record<string, unknown>, data?: Record<string, unknown>): void {
    this.log("error", stage, message, ctx, data)
  }

  success(stage: string, message: string, ctx?: Record<string, unknown>, data?: Record<string, unknown>): void {
    this.log("success", stage, message, ctx, data)
  }

  startTimer(label: string): void {
    this.timers.set(label, Date.now())
    this.info("TIMER", `Started: ${label}`)
  }

  stopTimer(label: string, stage?: string): number {
    const start = this.timers.get(label)
    if (!start) return 0
    const duration = Date.now() - start
    this.timers.delete(label)
    const s = stage || "TIMER"
    const formatted = duration > 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`
    this.info(s, `⏱️  ${label} completed in ${formatted}`)
    return duration
  }

  divider(title?: string): void {
    const line = "─".repeat(60)
    if (title) {
      console.log(`\n${COLORS.dim}${line}${COLORS.reset}`)
      console.log(`${COLORS.bold}${COLORS.cyan}  ${title}${COLORS.reset}`)
      console.log(`${COLORS.dim}${line}${COLORS.reset}\n`)
    } else {
      console.log(`${COLORS.dim}${line}${COLORS.reset}`)
    }
  }

  banner(title: string, subtitle?: string): void {
    const width = 60
    const border = "═".repeat(width)
    console.log(`\n${COLORS.cyan}╔${border}╗${COLORS.reset}`)
    console.log(`${COLORS.cyan}║${COLORS.reset}${COLORS.bold}${COLORS.white}${title.padStart(Math.floor((width + title.length) / 2)).padEnd(width)}${COLORS.reset}${COLORS.cyan}║${COLORS.reset}`)
    if (subtitle) {
      console.log(`${COLORS.cyan}║${COLORS.reset}${COLORS.dim}${subtitle.padStart(Math.floor((width + subtitle.length) / 2)).padEnd(width)}${COLORS.reset}${COLORS.cyan}║${COLORS.reset}`)
    }
    console.log(`${COLORS.cyan}╚${border}╝${COLORS.reset}\n`)
  }
}

export const log = new Logger()
