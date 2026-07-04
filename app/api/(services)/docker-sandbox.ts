/**
 * DockerSandbox — manages a Docker container lifecycle for a single scan.
 * 
 * Ported from Strix's StrixDockerSandboxClient + session_manager.
 * Key differences from the previous implementation:
 * 
 * 1. Preserves the image ENTRYPOINT (docker-entrypoint.sh runs setup)
 * 2. Uses `command: ["tail", "-f", "/dev/null"]` for keep-alive
 * 3. Adds NET_ADMIN/NET_RAW capabilities for nmap raw sockets
 * 4. Adds host.docker.internal → host-gateway for host access
 * 5. Proper exec with stdout/stderr capture and timeout
 * 6. Force-kill on cleanup (no graceful stop)
 */

import { spawn, exec as execCb, ChildProcess } from "child_process"
import { promisify } from "util"
import { log } from "./logger"

const execAsync = promisify(execCb)

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

const DEFAULT_IMAGE = "bloodhunter/sandbox:latest"

// Session cache — reuse containers across scans
const SESSION_CACHE = new Map<string, DockerSandbox>()

export class DockerSandbox {
  private containerId: string | null = null
  private containerName: string | null = null
  private runningProcesses = new Map<string, ChildProcess>()
  private config: SandboxConfig
  private image: string

  constructor(config: SandboxConfig) {
    this.config = config
    this.image = config.image || DEFAULT_IMAGE
  }

  getContainerId(): string | null {
    return this.containerId
  }

  getContainerName(): string | null {
    return this.containerName
  }

  isRunning(): boolean {
    return this.containerId !== null
  }

  /**
   * Create and start the sandbox container.
   * Follows Strix's approach:
   * - command: ["tail", "-f", "/dev/null"] for keep-alive
   * - cap_add: NET_ADMIN, NET_RAW
   * - extra_hosts: host.docker.internal → host-gateway
   * - environment: TARGET_URL, SCAN_ID, proxy vars
   */
  async start(): Promise<void> {
    log.info("SANDBOX", "Starting Docker sandbox", { scanId: this.config.scanId, image: this.image })
    this.logEvent("info", `Starting Docker sandbox with image: ${this.image}`)

    try {
      // Check if image exists, pull if needed
      const imageExists = await this.checkImageExists()
      if (!imageExists) {
        log.info("SANDBOX", "Image not found, pulling...", { image: this.image })
        this.logEvent("info", `Pulling sandbox image: ${this.image} (this may take a few minutes)`)
        await this.pullImage()
        log.success("SANDBOX", "Image pulled successfully")
        this.logEvent("success", "Sandbox image pulled successfully")
      }

      // Generate container name
      this.containerName = `bloodhunter-${this.config.scanId}-${Date.now()}`

      // Build docker run command
      // Key: use `command` not `entrypoint` so the image's ENTRYPOINT runs
      const args = [
        "run",
        "-d",                              // detached
        "--name", this.containerName,
        "--network", "host",               // host networking
        "--cap-add=NET_ADMIN",             // raw sockets for nmap
        "--cap-add=NET_RAW",               // raw sockets for nmap
        "--add-host=host.docker.internal:host-gateway",  // host access
        "-e", `TARGET_URL=${this.config.targetUrl}`,
        "-e", `SCAN_ID=${this.config.scanId}`,
        "-e", "PYTHONUNBUFFERED=1",
        "-e", "HOST_GATEWAY=host.docker.internal",
        this.image,
        "tail", "-f", "/dev/null",         // keep-alive command
      ]

      log.debug("SANDBOX", "Creating container", { args: `docker ${args.join(" ")}` })

      const result = await this.execDocker(args)

      if (result.exitCode !== 0) {
        log.error("SANDBOX", "Container creation failed", undefined, { stderr: result.stderr })
        throw new Error(`Failed to start container: ${result.stderr}`)
      }

      this.containerId = result.stdout.trim()
      log.success("SANDBOX", "Container created", { 
        containerId: this.containerId.substring(0, 12), 
        name: this.containerName 
      })
      this.logEvent("success", `Sandbox container started: ${this.containerName} (${this.containerId.substring(0, 12)})`)

      // Verify container is running
      const checkResult = await this.execDocker([
        "inspect", "--format", "{{.State.Running}}", this.containerName
      ])
      
      if (checkResult.stdout.trim() !== "true") {
        log.error("SANDBOX", "Container not running after start", undefined, { state: checkResult.stdout.trim() })
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

  /**
   * Execute a command inside the container.
   * Returns stdout, stderr, exit code, and duration.
   */
  async exec(command: string, timeout = 300000): Promise<ExecResult> {
    if (!this.containerId) {
      throw new Error("Sandbox not started")
    }

    const startTime = Date.now()
    const truncatedCmd = command.length > 120 ? command.substring(0, 120) + "..." : command
    log.info("SHELL", `Executing in container`, { 
      containerId: this.containerId.substring(0, 12), 
      command: truncatedCmd 
    })
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
        log.success("SHELL", `Command completed`, { 
          exitCode: result.exitCode, 
          duration: `${duration}ms`, 
          stdoutLen: result.stdout.length, 
          stderrLen: result.stderr.length 
        })
        if (stdoutPreview) log.debug("SHELL", "stdout preview", undefined, { stdout: stdoutPreview })
      } else {
        log.warn("SHELL", `Command exited with non-zero code`, { 
          exitCode: result.exitCode, 
          duration: `${duration}ms` 
        })
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

  /**
   * Execute a security tool with arguments.
   */
  async execTool(tool: string, args: string[], timeout = 300000): Promise<ExecResult> {
    const command = `${tool} ${args.join(" ")}`
    log.info("TOOL", `Running security tool`, { tool, args: args.join(" ") })
    return this.exec(command, timeout)
  }

  /**
   * Convenience methods for common tools.
   */
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

  async runNuclei(target: string, options: string[] = []): Promise<ExecResult> {
    const args = ["-u", target, "-severity", "low,medium,high,critical", ...options]
    log.info("TOOL", "Running nuclei", { target })
    return this.execTool("nuclei", args, 600000)
  }

  async runSubfinder(domain: string, options: string[] = []): Promise<ExecResult> {
    const args = ["-d", domain, "-silent", ...options]
    log.info("TOOL", "Running subfinder", { domain })
    return this.execTool("subfinder", args, 300000)
  }

  async runHttpx(targets: string, options: string[] = []): Promise<ExecResult> {
    const args = ["-u", targets, "-silent", "-status-code", "-title", "-tech-detect", ...options]
    log.info("TOOL", "Running httpx", { targets })
    return this.execTool("httpx", args, 300000)
  }

  async runKatana(target: string, options: string[] = []): Promise<ExecResult> {
    const args = ["-u", target, "-silent", "-depth", "3", ...options]
    log.info("TOOL", "Running katana", { target })
    return this.execTool("katana", args, 300000)
  }

  async runFfuf(url: string, wordlist?: string, options: string[] = []): Promise<ExecResult> {
    const wl = wordlist || "/usr/share/wordlists/dirb/common.txt"
    const args = ["-u", `${url}/FUZZ`, "-w", wl, "-silent", ...options]
    log.info("TOOL", "Running ffuf", { url, wordlist: wl })
    return this.execTool("ffuf", args, 300000)
  }

  async runSemgrep(path: string, options: string[] = []): Promise<ExecResult> {
    const args = ["scan", "--config=auto", path, ...options]
    log.info("TOOL", "Running semgrep", { path })
    return this.execTool("semgrep", args, 600000)
  }

  /**
   * Stop and remove the container.
   * Force-kills (no graceful stop) — matches Strix's cleanup behavior.
   */
  async stop(): Promise<void> {
    if (!this.containerId) {
      log.debug("SANDBOX", "stop() called but no container to stop")
      return
    }

    log.info("SANDBOX", "Stopping sandbox container", { 
      containerId: this.containerId.substring(0, 12), 
      name: this.containerName 
    })
    this.logEvent("info", "Stopping sandbox container...")

    try {
      // Kill any running processes
      const runningProcs = this.runningProcesses.size
      if (runningProcs > 0) {
        log.debug("SANDBOX", `Killing ${runningProcs} running processes`)
        for (const [id, proc] of this.runningProcesses) {
          log.debug("SANDBOX", `Killing process`, { processId: id })
          proc.kill("SIGKILL")
          this.runningProcesses.delete(id)
        }
      }

      // Force-kill the container (matches Strix's behavior)
      log.debug("SANDBOX", "Force-killing container...")
      await this.execDocker(["kill", this.containerId]).catch(() => {})
      
      // Remove the container
      log.debug("SANDBOX", "Removing container...")
      await this.execDocker(["rm", "-f", this.containerId]).catch(() => {})

      log.success("SANDBOX", "Container stopped and removed", { 
        containerId: this.containerId.substring(0, 12) 
      })
      this.logEvent("success", "Sandbox container stopped and removed")
      
      this.containerId = null
      this.containerName = null

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      log.error("SANDBOX", "Failed to stop/remove container", undefined, { error: errMsg })
      this.logEvent("error", `Failed to stop sandbox: ${errMsg}`)
    }
  }

  // ─── Private helpers ─────────────────────────────────────────

  private async checkImageExists(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `docker images --format "{{.Repository}}:{{.Tag}}" | grep -c "^${this.image}$" || true`
      )
      return parseInt(stdout.trim(), 10) > 0
    } catch {
      return false
    }
  }

  private async pullImage(): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", ["pull", this.image])
      let lastProgress = ""
      let lineCount = 0

      child.stdout?.on("data", (data) => {
        const lines = data.toString().split("\n").filter(Boolean)
        for (const line of lines) {
          if (line !== lastProgress) {
            lastProgress = line
            lineCount++
            if (lineCount % 5 === 0) {
              log.debug("SANDBOX", "Pull progress", { line: line.substring(0, 100) })
              this.logEvent("info", `Pulling: ${line.substring(0, 100)}`)
            }
          }
        }
      })

      child.stderr?.on("data", (data) => {
        const lines = data.toString().split("\n").filter(Boolean)
        for (const line of lines) {
          if (line !== lastProgress) {
            lastProgress = line
            log.warn("SANDBOX", "Pull stderr", { line: line.substring(0, 100) })
          }
        }
      })

      child.on("close", (code) => {
        if (code === 0) {
          log.success("SANDBOX", "Image pulled successfully", { image: this.image })
          resolve()
        } else {
          log.error("SANDBOX", "Image pull failed", { image: this.image, exitCode: code })
          reject(new Error(`Docker pull failed with exit code ${code}`))
        }
      })

      child.on("error", (error) => {
        log.error("SANDBOX", "Image pull process error", { image: this.image, error: error.message })
        reject(error)
      })
    })
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
    // Import dynamically to avoid circular dependency
    import("../(db)/scan-events-repository").then(({ createScanEvent }) => {
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
    }).catch(() => {})
  }
}

// ─── Session Manager ───────────────────────────────────────────

/**
 * Get or create a sandbox for a scan.
 * Caches containers so repeated scans reuse the same container.
 */
export async function getOrCreateSandbox(config: SandboxConfig): Promise<DockerSandbox> {
  const cached = SESSION_CACHE.get(config.scanId)
  if (cached && cached.isRunning()) {
    log.info("SANDBOX", "Reusing cached sandbox", { scanId: config.scanId })
    return cached
  }

  const sandbox = new DockerSandbox(config)
  await sandbox.start()
  SESSION_CACHE.set(config.scanId, sandbox)
  log.info("SANDBOX", "Sandbox cached for reuse", { scanId: config.scanId })
  return sandbox
}

/**
 * Clean up a scan's sandbox container.
 * Best-effort: errors are logged and swallowed.
 */
export async function cleanupSandbox(scanId: string): Promise<void> {
  const sandbox = SESSION_CACHE.get(scanId)
  if (!sandbox) {
    log.debug("SANDBOX", "cleanup: no cached sandbox", { scanId })
    return
  }

  SESSION_CACHE.delete(scanId)
  
  try {
    await sandbox.stop()
    log.info("SANDBOX", "Sandbox cleaned up", { scanId })
  } catch (error) {
    log.error("SANDBOX", "Cleanup failed", { scanId }, { 
      error: error instanceof Error ? error.message : String(error) 
    })
  }
}

/**
 * Clean up all cached sandboxes.
 */
export async function cleanupAllSandboxes(): Promise<void> {
  const scanIds = Array.from(SESSION_CACHE.keys())
  log.info("SANDBOX", "Cleaning up all sandboxes", { count: scanIds.length })
  
  for (const scanId of scanIds) {
    await cleanupSandbox(scanId)
  }
}
