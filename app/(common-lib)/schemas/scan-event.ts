import { z } from "zod"
import { scanPhaseSchema, severitySchema } from "./enums"

const baseEventSchema = z.object({
  scanId: z.string(),
  timestamp: z.string().datetime(),
})

export const scanEventSchema = z.discriminatedUnion("type", [
  baseEventSchema.extend({
    type: z.literal("scan.created"),
  }),
  baseEventSchema.extend({
    type: z.literal("scan.started"),
  }),
  baseEventSchema.extend({
    type: z.literal("phase.started"),
    phase: scanPhaseSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("phase.completed"),
    phase: scanPhaseSchema,
  }),
  baseEventSchema.extend({
    type: z.literal("agent.spawned"),
    agentId: z.string(),
    parentId: z.string().optional(),
    name: z.string(),
  }),
  baseEventSchema.extend({
    type: z.literal("agent.log"),
    agentId: z.string(),
    level: z.enum(["info", "warn", "error", "success"]),
    message: z.string(),
  }),
  baseEventSchema.extend({
    type: z.literal("tool.called"),
    agentId: z.string(),
    toolName: z.string(),
    summary: z.string(),
    input: z.record(z.string(), z.unknown()).optional(),
  }),
  baseEventSchema.extend({
    type: z.literal("tool.result"),
    agentId: z.string(),
    toolName: z.string(),
    result: z.record(z.string(), z.unknown()),
    duration: z.number().optional(),
  }),
  baseEventSchema.extend({
    type: z.literal("agent.thinking"),
    agentId: z.string(),
    thought: z.string(),
  }),
  baseEventSchema.extend({
    type: z.literal("agent.question"),
    agentId: z.string(),
    question: z.string(),
    context: z.string().optional(),
  }),
  baseEventSchema.extend({
    type: z.literal("methodology.step"),
    agentId: z.string(),
    step: z.string(),
    phase: z.string().optional(),
  }),
  baseEventSchema.extend({
    type: z.literal("finding.created"),
    agentId: z.string().optional(),
    findingId: z.string(),
    title: z.string(),
    severity: severitySchema,
    summary: z.string().optional(),
  }),
  baseEventSchema.extend({
    type: z.literal("scan.completed"),
  }),
  baseEventSchema.extend({
    type: z.literal("scan.failed"),
    error: z.string(),
  }),
])

export type ScanEvent = z.infer<typeof scanEventSchema>
