import { getAllProviders, getProviderApiKey } from "../(db)/providers-repository"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

export interface ProviderHealth {
  providerId: string
  name: string
  status: "healthy" | "degraded" | "failed"
  lastError?: string
  lastChecked: string
}

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
}

export function getHealthyModel(userId: string, preferredProviderId?: string): LanguageModel | null {
  const providers = getAllProviders(userId).filter(p => p.enabled)
  if (providers.length === 0) return null

  const orderedProviders = preferredProviderId
    ? [...providers.sort((a, b) => (a.id === preferredProviderId ? -1 : b.id === preferredProviderId ? 1 : 0))]
    : providers

  for (const provider of orderedProviders) {
    const apiKey = getProviderApiKey(provider.id)
    if (!apiKey) continue

    try {
      const config: Parameters<typeof createOpenAI>[0] = { apiKey }
      if (provider.baseUrl) config.baseURL = provider.baseUrl

      const openai = createOpenAI(config)
      return openai(provider.defaultModel)
    } catch {
      continue
    }
  }

  return null
}

export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
        const jitter = delay * 0.1 * Math.random()
        await new Promise(resolve => setTimeout(resolve, delay + jitter))
      }
    }
  }

  throw lastError
}

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes("rate limit") || message.includes("429") || message.includes("too many requests")
  }
  return false
}

export function isProviderError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes("provider") || message.includes("api key") || message.includes("unauthorized")
  }
  return false
}

export function getModelForAgentTurn(
  userId: string,
  currentProviderId?: string,
  error?: unknown
): LanguageModel | null {
  if (error && (isRateLimitError(error) || isProviderError(error))) {
    return getHealthyModel(userId, undefined)
  }

  return getHealthyModel(userId, currentProviderId)
}
