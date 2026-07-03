import { z } from "zod"

export const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  apiKey: z.string(),
  baseUrl: z.string().url().optional(),
  defaultModel: z.string(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Provider = z.infer<typeof providerSchema>

export const providerConfigInputSchema = providerSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type ProviderConfigInput = z.infer<typeof providerConfigInputSchema>
