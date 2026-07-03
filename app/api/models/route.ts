import { NextResponse } from "next/server"
import { getDefaultBaseUrl } from "@/app/api/(services)/provider-registry"

interface ProviderEntry {
  name: string
  baseUrl: string
  models: { id: string; name: string }[]
}

const fallbackCatalog: Record<string, ProviderEntry> = {
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    ],
  },
  anthropic: {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    models: [
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    ],
  },
  google: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    ],
  },
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    models: [
      { id: "llama3-70b-8192", name: "Llama 3 70B (Groq)" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B (Groq)" },
    ],
  },
  mistral: {
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    models: [
      { id: "mistral-large-latest", name: "Mistral Large" },
      { id: "open-mixtral-8x22b", name: "Mixtral 8x22B" },
    ],
  },
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", name: "DeepSeek Chat" },
      { id: "deepseek-reasoner", name: "DeepSeek Reasoner" },
    ],
  },
  ollama: {
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434/v1",
    models: [
      { id: "llama3", name: "Llama 3 (Local)" },
      { id: "mistral", name: "Mistral (Local)" },
    ],
  },
}

interface ExternalModelEntry {
  id?: string
  name?: string
  [key: string]: unknown
}

interface ExternalProviderData {
  name?: string
  api?: string
  models?: ExternalModelEntry[] | Record<string, ExternalModelEntry>
  [key: string]: unknown
}

export async function GET() {
  try {
    const res = await fetch("https://models.dev/api.json", {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data === "object") {
        const catalog: Record<string, ProviderEntry> = {}
        for (const [providerId, providerData] of Object.entries(data)) {
          if (providerData && typeof providerData === "object") {
            const providerInfo = providerData as ExternalProviderData
            const modelsArray: { id: string; name: string }[] = []
            const models = providerInfo.models
            
            if (models && typeof models === "object") {
              if (Array.isArray(models)) {
                models.forEach((m) => {
                  if (m && typeof m === "object" && m.id) {
                    modelsArray.push({ id: m.id, name: m.name || m.id })
                  }
                })
              } else {
                for (const [modelId, modelVal] of Object.entries(models)) {
                  if (modelVal && typeof modelVal === "object") {
                    modelsArray.push({ id: modelId, name: modelVal.name || modelId })
                  }
                }
              }
            }

            if (modelsArray.length > 0) {
              const friendlyName = providerInfo.name || providerId.toUpperCase()
              const baseUrl = providerInfo.api || getDefaultBaseUrl(providerId) || ""
              catalog[providerId] = {
                name: friendlyName,
                baseUrl,
                models: modelsArray,
              }
            }
          }
        }
        if (Object.keys(catalog).length > 0) {
          return NextResponse.json({ catalog })
        }
      }
    }
  } catch (error) {
    console.warn("Failed to fetch models from models.dev, using fallback:", error)
  }

  return NextResponse.json({ catalog: fallbackCatalog })
}
