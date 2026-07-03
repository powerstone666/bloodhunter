import { z } from "zod"

export const agentSchema = z.object({
  id: z.string(),
  scanId: z.string(),
  parentId: z.string().optional(),
  name: z.string(),
  status: z.enum(["running", "completed", "failed", "cancelled"]),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
})

export type Agent = z.infer<typeof agentSchema>
