import { z } from "zod"

export interface HttpRequestOptions {
  url: string
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"
  headers?: Record<string, string>
  body?: string
  timeout?: number
}

export interface HttpRequestResult {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  elapsedMs: number
}

export interface CommandOptions {
  command: string
  cwd?: string
  env?: Record<string, string>
  timeout?: number
  maxOutputBytes?: number
}

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
  elapsedMs: number
}

export interface RuntimeBackend {
  name: string
  type: string
  fetchUrl(options: HttpRequestOptions): Promise<HttpRequestResult>
  runCommand(options: CommandOptions): Promise<CommandResult>
  cleanup(): Promise<void>
}

export const httpRequestOptionsSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
  timeout: z.number().int().positive().optional(),
})

export const commandOptionsSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeout: z.number().int().positive().optional(),
  maxOutputBytes: z.number().int().positive().optional(),
})

export const httpRequestResultSchema = z.object({
  status: z.number(),
  statusText: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string(),
  elapsedMs: z.number(),
})

export const commandResultSchema = z.object({
  exitCode: z.number(),
  stdout: z.string(),
  stderr: z.string(),
  elapsedMs: z.number(),
})
