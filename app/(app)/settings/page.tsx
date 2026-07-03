"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/(ui)/components/button"
import { Input } from "@/app/(ui)/components/input"
import { Dialog } from "@/app/(ui)/components/dialog"
import { Select } from "@/app/(ui)/components/select"
import { InlineProviderList, Provider } from "./settings-components"
import { Shield, Search, Cpu, BarChart, Edit, Check, X, Eye, EyeOff } from "lucide-react"
import {
  fetchProviders as fetchProvidersApi,
  updateProvider as updateProviderApi,
  deleteProvider as deleteProviderApi,
  testProviderConnection,
  createProvider as createProviderApi,
  fetchModelsCatalog,
} from "@/app/(ui)/lib/api-client"

interface CatalogEntry {
  name: string
  baseUrl: string
  models: { id: string; name: string }[]
}

type SettingsCategory = "agent" | "search" | "telemetry" | "runtime" | "custom"

export default function SettingsPage() {
  const [catalog, setCatalog] = useState<Record<string, CatalogEntry>>({})
  const [isAgentsExpanded, setIsAgentsExpanded] = useState(false)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("agent")
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  
  const [agentProviders, setAgentProviders] = useState<Provider[]>([])
  const [searchProviders, setSearchProviders] = useState<Provider[]>([])
  const [customTools, setCustomTools] = useState<Provider[]>([])
  const [telemetryConfig, setTelemetryConfig] = useState<Provider | null>(null)
  const [runtimeConfig, setRuntimeConfig] = useState<Provider | null>(null)

  const [formName, setFormName] = useState("")
  const [providerType, setProviderType] = useState("openai")
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [defaultModel, setDefaultModel] = useState("")
  const [customDescription, setCustomDescription] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)

  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const list = await fetchProvidersApi()
        setAgentProviders(list.filter((p) => !["perplexity", "tavily", "duckduckgo", "shodan", "traceloop", "runtime", "custom"].includes(p.provider)))
        setSearchProviders(list.filter((p) => ["perplexity", "tavily", "duckduckgo", "shodan"].includes(p.provider)))
        setCustomTools(list.filter((p) => p.provider === "custom"))
        setTelemetryConfig(list.find((p) => p.provider === "traceloop") || null)
        setRuntimeConfig(list.find((p) => p.provider === "runtime") || null)
      } catch (e) {
        console.error(e)
      }
      try {
        const catalog = await fetchModelsCatalog()
        setCatalog(catalog)
      } catch (e) {
        console.error(e)
      }
    }
    load()
  }, [])

  const refreshProviders = async () => {
    try {
      const list = await fetchProvidersApi()
      setAgentProviders(list.filter((p) => !["perplexity", "tavily", "duckduckgo", "shodan", "traceloop", "runtime", "custom"].includes(p.provider)))
      setSearchProviders(list.filter((p) => ["perplexity", "tavily", "duckduckgo", "shodan"].includes(p.provider)))
      setCustomTools(list.filter((p) => p.provider === "custom"))
      setTelemetryConfig(list.find((p) => p.provider === "traceloop") || null)
      setRuntimeConfig(list.find((p) => p.provider === "runtime") || null)
    } catch (e) {
      console.error(e)
    }
  }

  const handleOpenAddAgent = () => {
    setActiveCategory("agent")
    setSelectedProvider(null)
    setFormName("")
    const firstType = Object.keys(catalog).filter(k => !["perplexity", "tavily", "duckduckgo", "traceloop", "runtime"].includes(k))[0] || "openai"
    setProviderType(firstType)
    setApiKey("")
    setBaseUrl(catalog[firstType]?.baseUrl || "")
    setDefaultModel(catalog[firstType]?.models?.[0]?.id || "")
    setTestResult(null)
    setIsDialogOpen(true)
  }

  const handleOpenAddSearch = () => {
    setActiveCategory("search")
    setSelectedProvider(null)
    setFormName("")
    setProviderType("perplexity")
    setApiKey("")
    setBaseUrl("")
    setDefaultModel("sonar")
    setTestResult(null)
    setIsDialogOpen(true)
  }

  const handleOpenAddCustom = () => {
    setActiveCategory("custom")
    setSelectedProvider(null)
    setFormName("")
    setProviderType("custom")
    setApiKey("")
    setBaseUrl("")
    setDefaultModel("custom-tool")
    setCustomDescription("")
    setTestResult(null)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (cat: SettingsCategory, prov?: Provider) => {
    setActiveCategory(cat)
    setSelectedProvider(prov || null)
    setTestResult(null)
    setShowApiKey(false)

    if (cat === "agent" && prov) {
      setFormName(prov.name)
      setProviderType(prov.provider)
      setApiKey("")
      setBaseUrl(prov.baseUrl || "")
      setDefaultModel(prov.defaultModel)
    } else if (cat === "search") {
      setFormName(prov?.name || "Search Integration")
      setProviderType(prov?.provider || "perplexity")
      setApiKey("")
      setBaseUrl(prov?.baseUrl || "")
      setDefaultModel(prov?.defaultModel || "sonar")
    } else if (cat === "custom") {
      setFormName(prov?.name || "Custom Tool")
      setProviderType("custom")
      setApiKey("")
      setBaseUrl(prov?.baseUrl || "")
      setDefaultModel(prov?.defaultModel || "custom-tool")
      setCustomDescription(prov?.defaultModel === "custom-tool" ? "" : (prov?.baseUrl || ""))
    } else if (cat === "telemetry") {
      setFormName("Traceloop Trace Export")
      setProviderType("traceloop")
      setApiKey("")
      setBaseUrl("")
      setDefaultModel("traceloop")
    } else if (cat === "runtime") {
      setFormName("Sandbox Runtime Settings")
      setProviderType("runtime")
      setApiKey("none")
      setBaseUrl(runtimeConfig?.baseUrl || "docker")
      setDefaultModel(runtimeConfig?.defaultModel || "ghcr.io/usestrix/strix-sandbox:1.0.0")
    }

    setIsDialogOpen(true)
  }

  const handleProviderChange = (type: string) => {
    setProviderType(type)
    setTestResult(null)
    const entry = catalog[type]
    if (entry) {
      setBaseUrl(entry.baseUrl)
      setDefaultModel(entry.models[0]?.id || "")
    } else {
      setBaseUrl("")
      setDefaultModel("")
    }
  }

  const handleSetPrimary = async (provId: string, isSearch: boolean) => {
    try {
      await updateProviderApi(provId, { enabled: true })
      const group = isSearch ? searchProviders : agentProviders
      const others = group.filter((p) => p.id !== provId)
      for (const p of others) {
        await updateProviderApi(p.id, { enabled: false })
      }
      refreshProviders()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id: string, isPrimary: boolean, isSearch: boolean) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return
    try {
      await deleteProviderApi(id)
      const group = isSearch ? searchProviders : agentProviders
      if (isPrimary && group.length > 1) {
        const nextPrimary = group.find(p => p.id !== id)
        if (nextPrimary) {
          await updateProviderApi(nextPrimary.id, { enabled: true })
        }
      }
      refreshProviders()
    } catch (e) {
      console.error(e)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const activeConfig = activeCategory === "agent" ? selectedProvider : (activeCategory === "search" ? selectedProvider : telemetryConfig)
      const result = await testProviderConnection({
        action: "test",
        provider: providerType,
        apiKey: apiKey || (activeConfig ? "existing" : ""),
        baseUrl: baseUrl || undefined,
        defaultModel,
      })
      setTestResult({ success: result.success, message: result.message })
    } catch {
      setTestResult({ success: false, message: "Network connection failed" })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const activeObj = activeCategory === "agent" ? selectedProvider : (activeCategory === "search" ? selectedProvider : (activeCategory === "custom" ? selectedProvider : (activeCategory === "telemetry" ? telemetryConfig : runtimeConfig)))

      const group = activeCategory === "search" ? searchProviders : (activeCategory === "custom" ? customTools : agentProviders)
      const isFirst = group.length === 0
      
      const payload: {
        name: string
        provider: string
        baseUrl?: string
        defaultModel: string
        enabled: boolean
        apiKey?: string
      } = {
        name: activeCategory === "agent" ? formName : (activeCategory === "search" ? formName : (activeCategory === "telemetry" ? "Traceloop Telemetry" : (activeCategory === "custom" ? formName : "Sandbox Runtime"))),
        provider: activeCategory === "custom" ? "custom" : providerType,
        baseUrl: activeCategory === "custom" ? customDescription : (baseUrl || undefined),
        defaultModel: activeCategory === "custom" ? "custom-tool" : defaultModel,
        enabled: ["agent", "search", "custom"].includes(activeCategory) ? (isFirst ? true : (selectedProvider ? selectedProvider.enabled : false)) : true,
      }
      if (apiKey && apiKey !== "none") payload.apiKey = apiKey

      if (activeObj) {
        await updateProviderApi(activeObj.id, payload)
      } else {
        await createProviderApi({ ...payload, apiKey: payload.apiKey || "" })
      }
      
      setIsDialogOpen(false)
      refreshProviders()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  const activeAgent = agentProviders.find(p => p.enabled)
  const activeSearch = searchProviders.find(p => p.enabled)

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-normal tracking-tight text-on-surface">Settings</h1>
        <p className="mt-2 text-base text-on-surface-variant">Configure integrations, keys, and sandbox runtime environments</p>
      </div>

      <div className="space-y-4 rounded-2xl bg-surface-container/20 border border-outline-variant/20 p-6">
        <h2 className="text-xl font-normal text-on-surface mb-2">Strix Integrations & Keys</h2>

        <div className="divide-y divide-outline-variant/10">
          {/* Agent LLM Settings Row */}
          <div className="py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container"><Cpu className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-semibold text-on-surface">Agent LLM Settings</h3>
                  <p className="text-sm text-on-surface-variant mt-0.5">Primary model execution keys for security agents</p>
                  {activeAgent && <p className="text-xs font-mono text-primary mt-1.5 font-semibold">active: {activeAgent.name} ({activeAgent.provider} · {activeAgent.defaultModel})</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 self-end sm:self-center">
                {agentProviders.length > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"><Check className="h-3 w-3" /> Configured</span> : <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-2.5 py-0.5 text-xs font-medium text-on-surface-variant/80"><X className="h-3 w-3" /> Not Configured</span>}
                <Button variant="outlined" size="sm" onClick={() => setIsAgentsExpanded(!isAgentsExpanded)} className="flex items-center gap-1"><Edit className="h-4 w-4" /> {isAgentsExpanded ? "Collapse" : "Configure"}</Button>
              </div>
            </div>
            {isAgentsExpanded && (
              <InlineProviderList providersList={agentProviders} isSearchGroup={false} onAdd={handleOpenAddAgent} onSetPrimary={handleSetPrimary} onOpenEdit={(prov) => handleOpenEdit("agent", prov)} onDelete={(id, enabled, search) => handleDelete(id, enabled, search)} />
            )}
          </div>

          {/* Search Integration Row */}
          <div className="py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container"><Search className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-semibold text-on-surface">Search Integration</h3>
                  <p className="text-sm text-on-surface-variant mt-0.5">Configure web search integrations (Perplexity, Tavily, DuckDuckGo) for vulnerability research</p>
                  {activeSearch && <p className="text-xs font-mono text-primary mt-1.5 font-semibold font-mono">active: {activeSearch.name} ({activeSearch.provider})</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 self-end sm:self-center">
                {searchProviders.length > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"><Check className="h-3 w-3" /> Configured</span> : <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-2.5 py-0.5 text-xs font-medium text-on-surface-variant/80"><X className="h-3 w-3" /> Not Configured</span>}
                <Button variant="outlined" size="sm" onClick={() => setIsSearchExpanded(!isSearchExpanded)} className="flex items-center gap-1"><Edit className="h-4 w-4" /> {isSearchExpanded ? "Collapse" : "Configure"}</Button>
              </div>
            </div>
            {isSearchExpanded && (
              <InlineProviderList providersList={searchProviders} isSearchGroup={true} onAdd={handleOpenAddSearch} onSetPrimary={handleSetPrimary} onOpenEdit={(prov) => handleOpenEdit("search", prov)} onDelete={(id, enabled, search) => handleDelete(id, enabled, search)} />
            )}
          </div>

          {/* Telemetry Row */}
          <div className="py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tertiary-container text-on-tertiary-container"><BarChart className="h-5 w-5" /></div>
              <div>
                <h3 className="text-base font-semibold text-on-surface">Telemetry & Tracing (Traceloop)</h3>
                <p className="text-sm text-on-surface-variant mt-0.5">Used for remote trace export and agent execution flow monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-4 self-end sm:self-center">
              {telemetryConfig ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"><Check className="h-3 w-3" /> Configured</span> : <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-2.5 py-0.5 text-xs font-medium text-on-surface-variant/80"><X className="h-3 w-3" /> Not Configured</span>}
              <Button variant="outlined" size="sm" onClick={() => handleOpenEdit("telemetry")} className="flex items-center gap-1"><Edit className="h-4 w-4" /> Configure</Button>
            </div>
          </div>

          {/* Runtime Sandbox Row */}
          <div className="py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-variant text-on-surface-variant"><Shield className="h-5 w-5" /></div>
              <div>
                <h3 className="text-base font-semibold text-on-surface">Sandbox Runtime Settings</h3>
                <p className="text-sm text-on-surface-variant mt-0.5">Docker image and execution backend configuration for security scanning</p>
                {runtimeConfig && <p className="text-xs font-mono text-on-surface-variant/80 mt-1">backend: {runtimeConfig.baseUrl} · image: {runtimeConfig.defaultModel}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4 self-end sm:self-center">
              {runtimeConfig ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"><Check className="h-3 w-3" /> Configured</span> : <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-2.5 py-0.5 text-xs font-medium text-on-surface-variant/80"><X className="h-3 w-3" /> Not Configured</span>}
              <Button variant="outlined" size="sm" onClick={() => handleOpenEdit("runtime")} className="flex items-center gap-1"><Edit className="h-4 w-4" /> Configure</Button>
            </div>
          </div>

          {/* Custom Tools Row */}
          <div className="py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error-container text-on-error-container"><Search className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-semibold text-on-surface">Custom API Tools</h3>
                  <p className="text-sm text-on-surface-variant mt-0.5">Add custom API integrations with name, key, and description. The agent will use these when needed based on your description.</p>
                  {customTools.length > 0 && <p className="text-xs font-mono text-primary mt-1.5 font-semibold">{customTools.length} custom tool{customTools.length !== 1 ? "s" : ""} configured</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 self-end sm:self-center">
                {customTools.length > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"><Check className="h-3 w-3" /> Configured</span> : <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-2.5 py-0.5 text-xs font-medium text-on-surface-variant/80"><X className="h-3 w-3" /> Not Configured</span>}
                <Button variant="outlined" size="sm" onClick={() => setIsSearchExpanded(!isSearchExpanded)} className="flex items-center gap-1"><Edit className="h-4 w-4" /> {isSearchExpanded ? "Collapse" : "Configure"}</Button>
              </div>
            </div>
            {isSearchExpanded && (
              <InlineProviderList providersList={customTools} isSearchGroup={false} onAdd={handleOpenAddCustom} onSetPrimary={handleSetPrimary} onOpenEdit={(prov) => handleOpenEdit("custom", prov)} onDelete={(id, enabled) => handleDelete(id, enabled, false)} />
            )}
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onClose={() => !isSaving && setIsDialogOpen(false)} title={selectedProvider ? `Edit ${selectedProvider.name}` : (activeCategory === "agent" ? "Add Agent LLM Provider" : "Add Search Provider")}>
        <form onSubmit={handleSave} className="space-y-4">
          {["agent", "search"].includes(activeCategory) && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant">Name</label>
                <Input required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={activeCategory === "agent" ? "e.g. Production OpenAI" : "e.g. Tavily Search"} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Provider Type</label>
                  {activeCategory === "agent" ? (
                    <Select value={providerType} onChange={(value) => handleProviderChange(value)} options={[
                      ...Object.entries(catalog).filter(([k]) => !["perplexity", "tavily", "duckduckgo", "traceloop", "runtime"].includes(k)).map(([key, entry]) => ({ value: key, label: entry.name })),
                      { value: "openai-compatible", label: "OpenAI Compatible" }
                    ]} />
                  ) : (
                    <Select value={providerType} onChange={(value) => { setProviderType(value); setDefaultModel(value === "perplexity" ? "sonar" : value === "shodan" ? "shodan-host" : value); }} options={[{ value: "perplexity", label: "Perplexity AI" }, { value: "tavily", label: "Tavily Search" }, { value: "shodan", label: "Shodan" }, { value: "duckduckgo", label: "DuckDuckGo" }]} />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Default Model / ID</label>
                  {activeCategory === "agent" && catalog[providerType]?.models?.length ? (
                    <Select value={defaultModel} onChange={(value) => setDefaultModel(value)} options={catalog[providerType].models.map((m) => ({ value: m.id, label: m.name }))} />
                  ) : (
                    <Input required value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} placeholder="e.g. gpt-4o" />
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant">API Key</label>
                <div className="relative">
                  <Input type={showApiKey ? "text" : "password"} required={!selectedProvider} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={selectedProvider ? "••••••••••••••••" : "Paste your API key here"} />
                  <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">{showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant">Base URL (Optional)</label>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Default URL will be used if empty" />
              </div>
            </>
          )}

          {activeCategory === "telemetry" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">API Key</label>
              <div className="relative">
                <Input type={showApiKey ? "text" : "password"} required={!telemetryConfig} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your API key here" />
                <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">{showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
              </div>
            </div>
          )}

          {activeCategory === "custom" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant">Tool Name</label>
                <Input required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. VirusTotal, SecurityTrails, Censys" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant">API Key</label>
                <div className="relative">
                  <Input type={showApiKey ? "text" : "password"} required={!selectedProvider} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={selectedProvider ? "••••••••••••••••" : "Paste your API key here"} />
                  <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">{showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant">API Base URL (Optional)</label>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="e.g. https://api.virustotal.com/v3" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant">Description (How should the agent use this tool?)</label>
                <textarea
                  required
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="e.g. Use this API to scan files and URLs for malware. Call GET /files/{hash} to check file hashes, or POST /urls to submit URLs for scanning. Returns detection results and threat analysis."
                  className="w-full h-24 px-3 py-2 rounded-xl border border-outline bg-surface-container text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </>
          )}

          {activeCategory === "runtime" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant">Sandbox Backend</label>
                <Select value={baseUrl} onChange={(value) => setBaseUrl(value)} options={[{ value: "docker", label: "Docker container" }, { value: "local", label: "Local process" }, { value: "vercel", label: "Vercel Sandbox" }]} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant">Docker Sandbox Image</label>
                <Input required value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} placeholder="ghcr.io/usestrix/strix-sandbox:1.0.0" />
              </div>
            </>
          )}

          {activeCategory !== "runtime" && (
            <div className="flex items-center gap-3 pt-2">
              <button type="button" onClick={handleTestConnection} disabled={isTesting || (!apiKey && !(activeCategory === "agent" ? selectedProvider : activeCategory === "search" ? selectedProvider : telemetryConfig))} className="h-10 px-4 rounded-xl border border-outline hover:bg-surface-variant text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50">
                {isTesting ? "Testing..." : "Test Connection"}
              </button>
              {testResult && (
                <div className={`flex items-center gap-1 text-sm font-medium ${testResult.success ? "text-success" : "text-error"}`}>
                  {testResult.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  {testResult.message}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
            <Button variant="outlined" type="button" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button variant="filled" type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
