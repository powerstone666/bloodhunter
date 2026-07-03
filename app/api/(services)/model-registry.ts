import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { log } from "./logger"

export interface ProviderRecord {
  id: string
  name: string
  provider: string
  baseUrl?: string | null
  defaultModel: string
  enabled: boolean
}

const PROVIDER_CATALOG: Record<string, { langchainClass: string; defaultBaseUrl: string }> = {
  openai:      { langchainClass: "ChatOpenAI",            defaultBaseUrl: "https://api.openai.com/v1" },
  anthropic:   { langchainClass: "ChatAnthropic",          defaultBaseUrl: "https://api.anthropic.com" },
  google:      { langchainClass: "ChatGoogleGenerativeAI", defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  groq:        { langchainClass: "ChatOpenAI",             defaultBaseUrl: "https://api.groq.com/openai/v1" },
  mistral:     { langchainClass: "ChatOpenAI",             defaultBaseUrl: "https://api.mistral.ai/v1" },
  deepseek:    { langchainClass: "ChatOpenAI",             defaultBaseUrl: "https://api.deepseek.com/v1" },
  openrouter:  { langchainClass: "ChatOpenAI",             defaultBaseUrl: "https://openrouter.ai/api/v1" },
  requesty:    { langchainClass: "ChatOpenAI",             defaultBaseUrl: "https://router.requesty.ai/v1" },
  together:    { langchainClass: "ChatOpenAI",             defaultBaseUrl: "https://api.together.xyz/v1" },
  ollama:      { langchainClass: "ChatOpenAI",             defaultBaseUrl: "http://localhost:11434/v1" },
  xai:         { langchainClass: "ChatOpenAI",             defaultBaseUrl: "https://api.x.ai/v1" },
  perplexity:  { langchainClass: "ChatOpenAI",             defaultBaseUrl: "https://api.perplexity.ai" },
  alibaba:     { langchainClass: "ChatOpenAI",             defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  "openai-compatible": { langchainClass: "ChatOpenAI",     defaultBaseUrl: "https://api.openai.com/v1" },
}

const MODEL_ALIASES: Record<string, Record<string, string>> = {
  deepseek: {
    "deepseek chat": "deepseek-chat",
    "deepseek-chat": "deepseek-chat",
    "deepseek reasoner": "deepseek-reasoner",
    "deepseek-reasoner": "deepseek-reasoner",
  },
}

const SDK_FACTORIES: Record<string, () => Promise<new (config: Record<string, unknown>) => BaseChatModel>> = {
  "ChatOpenAI":            () => import("@langchain/openai").then(m => m.ChatOpenAI as unknown as new (config: Record<string, unknown>) => BaseChatModel),
  "ChatAnthropic":         () => import("@langchain/anthropic").then(m => m.ChatAnthropic as unknown as new (config: Record<string, unknown>) => BaseChatModel),
  "ChatGoogleGenerativeAI": () => import("@langchain/google-genai").then(m => m.ChatGoogleGenerativeAI as unknown as new (config: Record<string, unknown>) => BaseChatModel),
}

export async function loadModel(p: ProviderRecord, apiKey: string): Promise<BaseChatModel> {
  const providerType = p.provider.toLowerCase()
  const modelId = resolveModelId(providerType, p.defaultModel)

  log.info("MODEL", "Loading model", { provider: p.provider, model: modelId, name: p.name })

  const catalogEntry = PROVIDER_CATALOG[providerType]
  const langchainClass = catalogEntry?.langchainClass ?? "ChatOpenAI"
  const defaultBaseUrl = catalogEntry?.defaultBaseUrl ?? "https://api.openai.com/v1"
  const baseURL = (p.baseUrl?.trim() || defaultBaseUrl).replace(/\/+$/, "")

  log.debug("MODEL", "Resolved catalog entry", { langchainClass, baseURL })

  const loadFactory = SDK_FACTORIES[langchainClass] ?? SDK_FACTORIES["ChatOpenAI"]

  log.debug("MODEL", "Importing LangChain class", { className: langchainClass })
  const ModelClass = await loadFactory()
  log.debug("MODEL", "LangChain class imported", { className: langchainClass })

  const config: Record<string, unknown> = {
    apiKey,
    model: modelId,
    temperature: 0,
  }

  if (langchainClass === "ChatOpenAI") {
    config.configuration = { baseURL }
  }

  log.debug("MODEL", "Instantiating model", { config: { ...config, apiKey: "***" } })
  const model = new ModelClass(config)
  log.success("MODEL", "Model instantiated", { provider: p.provider, model: modelId, class: langchainClass })

  return model
}

function resolveModelId(providerType: string, model: string): string {
  const providerAliases = MODEL_ALIASES[providerType]
  const normalizedModel = model.trim()

  return providerAliases?.[normalizedModel.toLowerCase()] ?? normalizedModel
}

export async function resolveActiveModel(
  providers: ProviderRecord[],
  getApiKey: (id: string) => string | null,
  preferredProviderId?: string
): Promise<{ model: BaseChatModel; provider: ProviderRecord }> {
  log.info("MODEL", "Resolving active model", { providerCount: providers.length, preferredId: preferredProviderId })

  const ordered = [
    ...providers.filter(p => p.id === preferredProviderId),
    ...providers.filter(p => p.id !== preferredProviderId && p.enabled),
    ...providers.filter(p => p.id !== preferredProviderId && !p.enabled),
  ]

  log.debug("MODEL", "Provider order", { order: ordered.map(p => `${p.name} (${p.provider}, enabled=${p.enabled})`) })

  for (const p of ordered) {
    log.debug("MODEL", "Trying provider", { name: p.name, provider: p.provider })
    const apiKey = getApiKey(p.id)
    if (!apiKey) {
      log.debug("MODEL", "No API key for provider, skipping", { name: p.name })
      continue
    }

    try {
      const model = await loadModel(p, apiKey)
      log.success("MODEL", "Active model resolved", { name: p.name, provider: p.provider, model: p.defaultModel })
      return { model, provider: p }
    } catch (e) {
      log.warn("MODEL", "Failed to load model from provider, trying next", {
        name: p.name,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  log.error("MODEL", "No usable provider found")
  throw new Error("No usable provider found. Add a provider with a valid API key in Settings.")
}

export function getDefaultBaseUrl(providerType: string): string | undefined {
  return PROVIDER_CATALOG[providerType.toLowerCase()]?.defaultBaseUrl
}
