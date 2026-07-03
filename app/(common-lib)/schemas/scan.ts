import { z } from "zod"

export const scopeModeSchema = z.enum([
  "same-host",
  "subdomains",
  "custom",
])

export type ScopeMode = z.infer<typeof scopeModeSchema>

export const aggressivenessSchema = z.enum([
  "passive",
  "light",
  "moderate",
  "aggressive",
])

export type Aggressiveness = z.infer<typeof aggressivenessSchema>

export const scanConfigSchema = z.object({
  targetUrl: z.string().url(),
  scopeMode: scopeModeSchema,
  aggressiveness: aggressivenessSchema,
  instruction: z.string().optional(),
  scanMode: z.enum(["quick", "standard", "deep"]).optional(),
  allowedHostnames: z.array(z.string()).optional(),
  excludedPaths: z.array(z.string()).optional(),
  authHeaders: z.record(z.string(), z.string()).optional(),
  authCookies: z.record(z.string(), z.string()).optional(),
  maxDepth: z.number().int().positive().optional(),
  maxAgents: z.number().int().positive().optional(),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
  skillIds: z.array(z.string()).optional(),
})

export type ScanConfig = z.infer<typeof scanConfigSchema>

export const scanSchema = z.object({
  id: z.string(),
  userId: z.string(),
  config: scanConfigSchema,
  status: z.enum([
    "draft",
    "queued",
    "running",
    "paused",
    "completed",
    "failed",
    "cancelled",
  ]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
})

export type Scan = z.infer<typeof scanSchema>
