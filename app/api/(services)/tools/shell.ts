import { tool } from "@langchain/core/tools"
import { z } from "zod"
import fs from "fs"
import path from "path"
import type { ScanEvent } from "@/app/(common-lib)/schemas"
import { log } from "../logger"
import { DockerSandbox } from "../docker-sandbox"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
  sandbox?: DockerSandbox
}

const WORKSPACE_DIR = path.join(process.cwd(), "data", "workspace")

function ensureWorkspace(scanId: string): string {
  const dir = path.join(WORKSPACE_DIR, scanId)
  if (!fs.existsSync(dir)) {
    log.debug("SHELL", "Creating workspace directory", { path: dir })
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function createShellTools(ctx: ToolContext) {
  const execCommand = tool(
    async (input) => {
      const truncatedCmd = input.command.length > 120 ? input.command.substring(0, 120) + "..." : input.command
      log.debug("SHELL", `exec_command called`, { scanId: ctx.scanId, command: truncatedCmd, sandbox: ctx.sandbox ? "docker" : "none" })

      ctx.emitEvent({
        type: "tool.called",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        toolName: "exec_command",
        summary: `$ ${truncatedCmd}`,
        timestamp: new Date().toISOString(),
      })

      const timeout = input.timeoutMs || 30000

      if (ctx.sandbox) {
        log.debug("SHELL", "Executing in Docker sandbox")
        try {
          const result = await ctx.sandbox.exec(input.command, timeout)
          log.debug("SHELL", "Docker exec completed", { exitCode: result.exitCode, duration: `${result.duration}ms`, stdoutLen: result.stdout.length, stderrLen: result.stderr.length })
          return {
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          log.error("SHELL", "Docker exec failed", undefined, { error: errMsg })
          return {
            exitCode: 1,
            stdout: "",
            stderr: errMsg,
            error: errMsg,
          }
        }
      }

      const errorMessage = "Command blocked: Docker sandbox is required."
      log.error("SHELL", "Command blocked without Docker sandbox", { scanId: ctx.scanId, command: truncatedCmd })
      return {
        exitCode: 1,
        stdout: "",
        stderr: errorMessage,
        error: errorMessage,
      }
    },
    {
      name: "exec_command",
      description: "Execute a shell command in the sandbox environment. Use for running security tools, scripts, and system commands.",
      schema: z.object({
        command: z.string().describe("Shell command to execute"),
        timeoutMs: z.number().optional().describe("Timeout in milliseconds (default 30000)"),
      }),
    }
  )

  const readFile = tool(
    async (input) => {
      log.debug("SHELL", "scan_read_file called", { path: input.path, scanId: ctx.scanId })
      const workspace = ensureWorkspace(ctx.scanId)
      const fullPath = path.join(workspace, input.path)

      try {
        const content = fs.readFileSync(fullPath, "utf-8")
        log.success("SHELL", "File read", { path: input.path, size: content.length })
        return { success: true, content: content.substring(0, 100000), size: content.length }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        log.error("SHELL", "File read failed", { path: input.path }, { error: errMsg })
        return { success: false, error: errMsg }
      }
    },
    {
      name: "scan_read_file",
      description: "Read the contents of a file from the scan workspace.",
      schema: z.object({
        path: z.string().describe("File path relative to workspace"),
      }),
    }
  )

  const writeFile = tool(
    async (input) => {
      log.debug("SHELL", "scan_write_file called", { path: input.path, contentLength: input.content.length, scanId: ctx.scanId })
      const workspace = ensureWorkspace(ctx.scanId)
      const fullPath = path.join(workspace, input.path)

      try {
        const dir = path.dirname(fullPath)
        if (!fs.existsSync(dir)) {
          log.debug("SHELL", "Creating directory for file", { dir })
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(fullPath, input.content, "utf-8")
        log.success("SHELL", "File written", { path: input.path, size: input.content.length })
        return { success: true, path: input.path, size: input.content.length }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        log.error("SHELL", "File write failed", { path: input.path }, { error: errMsg })
        return { success: false, error: errMsg }
      }
    },
    {
      name: "scan_write_file",
      description: "Write content to a file in the scan workspace.",
      schema: z.object({
        path: z.string().describe("File path relative to workspace"),
        content: z.string().describe("File content to write"),
      }),
    }
  )

  const listFiles = tool(
    async (input) => {
      log.debug("SHELL", "scan_list_files called", { path: input.path || "/", scanId: ctx.scanId })
      const workspace = ensureWorkspace(ctx.scanId)
      const targetPath = input.path ? path.join(workspace, input.path) : workspace

      try {
        const entries = fs.readdirSync(targetPath, { withFileTypes: true })
        const items = entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? "directory" : "file",
          size: e.isFile() ? fs.statSync(path.join(targetPath, e.name)).size : undefined,
        }))
        log.success("SHELL", "Directory listed", { path: input.path || "/", itemCount: items.length })
        return { success: true, path: input.path || "/", items }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        log.error("SHELL", "Directory listing failed", { path: input.path || "/" }, { error: errMsg })
        return { success: false, error: errMsg }
      }
    },
    {
      name: "scan_list_files",
      description: "List files and directories in the scan workspace.",
      schema: z.object({
        path: z.string().optional().describe("Directory path relative to workspace (default: root)"),
      }),
    }
  )

  log.debug("SHELL", "Shell tools created", { sandbox: ctx.sandbox ? "docker" : "none" })
  return { exec_command: execCommand, scan_read_file: readFile, scan_write_file: writeFile, scan_list_files: listFiles }
}
