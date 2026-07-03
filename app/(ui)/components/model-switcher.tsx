"use client"

import { useState, useEffect } from "react"
import { ChevronDown, RefreshCw } from "lucide-react"

interface Provider {
  id: string
  name: string
  provider: string
  defaultModel: string
  enabled: boolean
}

interface ModelSwitcherProps {
  currentProviderId?: string
  currentModel?: string
  onModelChange: (providerId: string, model: string) => void
}

export function ModelSwitcher({ currentProviderId, currentModel, onModelChange }: ModelSwitcherProps) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState(currentProviderId || "")
  const [selectedModel, setSelectedModel] = useState(currentModel || "")
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/providers")
      const data = await res.json()
      setProviders(data.providers?.filter((p: Provider) => p.enabled) || [])
    }
    void load()
  }, [])

  const handleProviderChange = (providerId: string) => {
    setSelectedProviderId(providerId)
    const provider = providers.find(p => p.id === providerId)
    if (provider) {
      setSelectedModel(provider.defaultModel)
      onModelChange(providerId, provider.defaultModel)
    }
    setIsOpen(false)
  }

  const handleRefresh = async () => {
    setLoading(true)
    const res = await fetch("/api/providers")
    const data = await res.json()
    setProviders(data.providers?.filter((p: Provider) => p.enabled) || [])
    setLoading(false)
  }

  const selectedProvider = providers.find(p => p.id === selectedProviderId)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-outline/20 bg-surface-container-high px-4 py-2 text-sm text-on-surface hover:bg-surface-container-highest cursor-pointer"
      >
        <span className="truncate max-w-[200px]">
          {selectedProvider ? `${selectedProvider.name} / ${selectedModel}` : "Select model"}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-80 rounded-xl border border-outline/20 bg-surface-container shadow-lg">
          <div className="flex items-center justify-between border-b border-outline/20 px-4 py-2">
            <span className="text-xs text-on-surface-variant">Providers</span>
            <button onClick={handleRefresh} className="cursor-pointer text-on-surface-variant hover:text-on-surface">
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {providers.length === 0 ? (
              <div className="px-4 py-3 text-sm text-on-surface-variant">No providers configured</div>
            ) : (
              providers.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderChange(provider.id)}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-surface-container-highest cursor-pointer ${
                    provider.id === selectedProviderId ? "bg-secondary-container text-on-secondary-container" : "text-on-surface"
                  }`}
                >
                  <div className="font-medium">{provider.name}</div>
                  <div className="text-xs text-on-surface-variant">{provider.provider} • {provider.defaultModel}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
