export interface ProviderConfig {
  id: string
  name: string
  provider: string
  apiKey: string
  baseUrl?: string
  defaultModel: string
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow: number
}

import { getDefaultBaseUrl } from "./model-registry"
export { getDefaultBaseUrl }

export async function testProviderConnection(config: ProviderConfig): Promise<{ success: boolean; message: string }> {
  try {
    const baseUrl = config.baseUrl || getDefaultBaseUrl(config.provider)
    const providerName = config.provider.toLowerCase()

    if (providerName === "google") {
      const response = await fetch(`${baseUrl || "https://generativelanguage.googleapis.com"}/v1beta/models?key=${config.apiKey}`, {
        signal: AbortSignal.timeout(10000),
      })
      if (response.ok) {
        return { success: true, message: "Connection successful" }
      }
      return { success: false, message: `HTTP ${response.status}: ${response.statusText}` }
    }

    if (providerName === "anthropic") {
      const response = await fetch(`${baseUrl || "https://api.anthropic.com"}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.defaultModel || "claude-3-5-sonnet-20241022",
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }],
        }),
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok || response.status === 400) {
        return { success: true, message: "Connection successful" }
      }
      return { success: false, message: `HTTP ${response.status}: ${response.statusText}` }
    }

    // Default: treating any other provider as OpenAI-compatible
    const resolvedBaseUrl = baseUrl || "https://api.openai.com/v1"
    const response = await fetch(`${resolvedBaseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    })

    if (response.ok) {
      return { success: true, message: "Connection successful" }
    }
    return { success: false, message: `HTTP ${response.status}: ${response.statusText}` }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TimeoutError") {
        return { success: false, message: "Connection timed out" }
      }
      return { success: false, message: error.message }
    }
    return { success: false, message: "Unknown error" }
  }
}
