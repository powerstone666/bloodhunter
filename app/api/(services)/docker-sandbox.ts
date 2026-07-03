import { spawn, ChildProcess } from "child_process"
import { createScanEvent } from "../(db)/scan-events-repository"
import { log } from "./logger"
import { DEFAULT_DOCKER_IMAGE } from "./docker-config"

export interface SandboxConfig {
  scanId: string
  agentId: string
  targetUrl: string
  image?: string
}

export interface ExecResult {
  exitCode: number
  stdout: string
  stderr: string
  duration: number
}

export class DockerSandbox {
  private containerId: string | null = null
  private containerName: string | null = null
  private processes: Map<string, ChildProcess> = new Map()
  private config: SandboxConfig

  constructor(config: SandboxConfig) {
    this.config = config
  }

  getContainerId(): string | null {
    return this.containerId
  }

  getContainerName(): string | null {
    return this.containerName
  }

  async start(): Promise<void> {
    const image = this.config.image || DEFAULT_DOCKER_IMAGE

    log.info("SANDBOX", "Starting Docker sandbox", { scanId: this.config.scanId, image })
    this.logEvent("info", `Starting Docker sandbox with image: ${image}`)

    try {
      this.containerName = `bloodhunter-${this.config.scanId}-${Date.now()}`
      log.debug("SANDBOX", "Container name generated", { name: this.containerName })

      const args = [
        "run",
        "-d",
        "--name", this.containerName,
        "--network", "host",
        "--cap-add=NET_RAW",
        "-e", `TARGET_URL=${this.config.targetUrl}`,
        "-e", `SCAN_ID=${this.config.scanId}`,
        image,
        "sleep", "infinity"
      ]

      log.debug("SANDBOX", "Docker run command", { args: `docker ${args.join(" ")}` })

      const result = await this.execDocker(args)

      if (result.exitCode !== 0) {
        log.error("SANDBOX", "Docker run failed", undefined, { exitCode: result.exitCode, stderr: result.stderr })
        throw new Error(`Failed to start container: ${result.stderr}`)
      }

      this.containerId = result.stdout.trim()
      log.success("SANDBOX", "Container created", { containerId: this.containerId, name: this.containerName })
      this.logEvent("success", `Sandbox container started: ${this.containerName} (${this.containerId.substring(0, 12)})`)

      log.debug("SANDBOX", "Verifying container is running...")
      const checkResult = await this.execDocker(["inspect", "--format", "{{.State.Running}}", this.containerName])
      if (checkResult.stdout.trim() !== "true") {
        log.error("SANDBOX", "Container not in running state", undefined, { state: checkResult.stdout.trim() })
        throw new Error("Container started but is not running")
      }
      log.success("SANDBOX", "Container verified running")

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      log.error("SANDBOX", "Sandbox start failed", undefined, { error: errMsg })
      this.logEvent("error", `Failed to start sandbox: ${errMsg}`)
      throw error
    }
  }

  async exec(command: string, timeout = 300000): Promise<ExecResult> {
    if (!this.containerId) {
      log.error("SHELL", "exec called but sandbox not started", { scanId: this.config.scanId })
      throw new Error("Sandbox not started")
    }

    const startTime = Date.now()
    const truncatedCmd = command.length > 120 ? command.substring(0, 120) + "..." : command
    log.debug("SHELL", `Executing in container`, { containerId: this.containerId.substring(0, 12), command: truncatedCmd })
    this.logEvent("info", `Executing: ${truncatedCmd}`)

    try {
      const result = await this.execDocker([
        "exec",
        this.containerId,
        "sh", "-c", command
      ], timeout)

      const duration = Date.now() - startTime
      const stdoutPreview = result.stdout.substring(0, 200)
      const stderrPreview = result.stderr.substring(0, 200)

      if (result.exitCode === 0) {
        log.debug("SHELL", `Command completed`, { exitCode: result.exitCode, duration: `${duration}ms`, stdoutLen: result.stdout.length, stderrLen: result.stderr.length })
        if (stdoutPreview) log.debug("SHELL", "stdout preview", undefined, { stdout: stdoutPreview })
      } else {
        log.warn("SHELL", `Command exited with non-zero code`, { exitCode: result.exitCode, duration: `${duration}ms` })
        if (stderrPreview) log.debug("SHELL", "stderr preview", undefined, { stderr: stderrPreview })
      }

      this.logEvent("info", `Command completed in ${duration}ms (exit: ${result.exitCode})`)

      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        duration
      }

    } catch (error) {
      const duration = Date.now() - startTime
      const errMsg = error instanceof Error ? error.message : String(error)
      log.error("SHELL", `Command failed`, { duration: `${duration}ms`, error: errMsg })
      this.logEvent("error", `Command failed after ${duration}ms: ${errMsg}`)
      throw error
    }
  }

  async execTool(tool: string, args: string[], timeout = 300000): Promise<ExecResult> {
    const command = `${tool} ${args.join(" ")}`
    log.info("TOOL", `Running security tool`, { tool, args: args.join(" ") })
    return this.exec(command, timeout)
  }

  async runNmap(target: string, options: string[] = []): Promise<ExecResult> {
    const args = ["-sV", "-sC", "-O", "--top-ports", "1000", ...options, target]
    log.info("TOOL", "Running nmap scan", { target, options: args.join(" ") })
    return this.execTool("nmap", args, 600000)
  }

  async runSqlmap(url: string, options: string[] = []): Promise<ExecResult> {
    const args = ["-u", url, "--batch", "--level=3", "--risk=2", ...options]
    log.info("TOOL", "Running sqlmap", { url })
    return this.execTool("sqlmap", args, 600000)
  }

  async runNikto(url: string, options: string[] = []): Promise<ExecResult> {
    const args = ["-h", url, "-nointeractive", ...options]
    log.info("TOOL", "Running nikto", { url })
    return this.execTool("nikto", args, 600000)
  }

  async runDirb(url: string, wordlist?: string): Promise<ExecResult> {
    const args = [url]
    if (wordlist) args.push(wordlist)
    log.info("TOOL", "Running dirb", { url, wordlist: wordlist || "default" })
    return this.execTool("dirb", args, 300000)
  }

  async runWpscan(url: string, options: string[] = []): Promise<ExecResult> {
    const args = ["--url", url, "--batch", ...options]
    log.info("TOOL", "Running wpscan", { url })
    return this.execTool("wpscan", args, 600000)
  }

  async stop(): Promise<void> {
    if (!this.containerId) {
      log.debug("SANDBOX", "stop() called but no container to stop")
      return
    }

    log.info("SANDBOX", "Stopping sandbox container", { containerId: this.containerId.substring(0, 12), name: this.containerName })
    this.logEvent("info", "Stopping sandbox container...")

    try {
      const runningProcs = this.processes.size
      if (runningProcs > 0) {
        log.debug("SANDBOX", `Killing ${runningProcs} running processes`)
        for (const [id, proc] of this.processes) {
          log.debug("SANDBOX", `Killing process`, { processId: id })
          proc.kill("SIGTERM")
          this.processes.delete(id)
        }
      }

      log.debug("SANDBOX", "Stopping container...")
      await this.execDocker(["stop", this.containerId])
      log.debug("SANDBOX", "Removing container...")
      await this.execDocker(["rm", this.containerId])

      log.success("SANDBOX", "Container stopped and removed", { containerId: this.containerId.substring(0, 12) })
      this.logEvent("success", "Sandbox container stopped and removed")
      this.containerId = null
      this.containerName = null

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      log.error("SANDBOX", "Failed to stop/remove container", undefined, { error: errMsg })
      this.logEvent("error", `Failed to stop sandbox: ${errMsg}`)
    }
  }

  private async execDocker(args: string[], timeout = 60000): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn("docker", args)
      let stdout = ""
      let stderr = ""

      const timer = setTimeout(() => {
        log.warn("DOCKER", "Docker command timed out", { timeout: `${timeout}ms`, args: args.slice(0, 3).join(" ") })
        proc.kill("SIGTERM")
        reject(new Error(`Docker command timed out after ${timeout}ms`))
      }, timeout)

      proc.stdout.on("data", (data) => {
        stdout += data.toString()
      })

      proc.stderr.on("data", (data) => {
        stderr += data.toString()
      })

      proc.on("close", (code) => {
        clearTimeout(timer)
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          duration: 0
        })
      })

      proc.on("error", (error) => {
        clearTimeout(timer)
        log.error("DOCKER", "Docker process error", undefined, { error: error.message })
        reject(error)
      })
    })
  }

  private logEvent(level: "info" | "success" | "error" | "warn", message: string) {
    createScanEvent({
      scanId: this.config.scanId,
      eventType: "agent.log",
      eventData: {
        agentId: this.config.agentId,
        level,
        message: `[Sandbox] ${message}`
      },
      timestamp: new Date().toISOString()
    })
  }
}

export async function createSandbox(config: SandboxConfig): Promise<DockerSandbox> {
  log.info("SANDBOX", "createSandbox() called", { scanId: config.scanId, agentId: config.agentId })
  const sandbox = new DockerSandbox(config)
  await sandbox.start()
  return sandbox
}
