"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog } from "@/app/(ui)/components/dialog"
import { Button } from "@/app/(ui)/components/button"
import { Input } from "@/app/(ui)/components/input"
import { Label } from "@/app/(ui)/components/label"
import { Textarea } from "@/app/(ui)/components/textarea"
import { Select } from "@/app/(ui)/components/select"
import { createScan, fetchProviders, fetchProviderModels } from "@/app/(ui)/lib/api-client"
import { useRouter } from "next/navigation"
import { Upload, AlertTriangle } from "lucide-react"

type InstructionSource = "custom" | "saved" | "upload"

interface NewScanDialogProps {
  open: boolean
  onClose: () => void
}

export function NewScanDialog({ open, onClose }: NewScanDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    target: "",
    instructionSource: "custom" as InstructionSource,
    instruction: "",
    scanMode: "deep" as "quick" | "standard" | "deep",
    scopeMode: "auto" as "auto" | "diff" | "full",
  })

  const [providers, setProviders] = useState<Array<{ id: string; name: string; provider: string; defaultModel: string; enabled: boolean }>>([])
  const [models, setModels] = useState<Array<{ id: string; name: string; contextWindow: number }>>([])
  const [selectedProviderId, setSelectedProviderId] = useState("")
  const [selectedModel, setSelectedModel] = useState("")

  const fetchModels = useCallback(async (provId: string) => {
    try {
      const data = await fetchProviderModels(provId)
      setModels(data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchProviders()
        .then((list) => {
          setProviders(list)
          if (list.length > 0) {
            const enabledProv = list.find((p) => p.enabled) || list[0]
            setSelectedProviderId(enabledProv.id)
            setSelectedModel(enabledProv.defaultModel)
            fetchModels(enabledProv.id)
          }
        })
        .catch(console.error)
    }
  }, [open, fetchModels])

  const handleProviderChange = (provId: string) => {
    setSelectedProviderId(provId)
    const prov = providers.find((p) => p.id === provId)
    if (prov) {
      setSelectedModel(prov.defaultModel)
      fetchModels(provId)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (providers.length === 0) {
      setError("Please configure an AI provider in Settings before starting a scan.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const scanId = await createScan({
        target: formData.target,
        instruction: formData.instructionSource === "custom" ? formData.instruction : undefined,
        scanMode: formData.scanMode,
        scopeMode: formData.scopeMode,
        providerId: selectedProviderId || undefined,
        model: selectedModel || undefined,
      })
      
      router.push(`/scans/${scanId}`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scan")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New scan">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="target">Target</Label>
          <Input
            id="target"
            type="text"
            placeholder="https://example.com or git@github.com:user/repo.git"
            value={formData.target}
            onChange={(e) => setFormData({ ...formData, target: e.target.value })}
            required
          />
          <p className="text-xs text-on-surface-variant">
            URL, git repository, local path, domain, or IP address
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="provider">AI Provider</Label>
            {providers.length > 0 ? (
              <Select
                id="provider"
                value={selectedProviderId}
                onChange={(value) => handleProviderChange(value)}
                options={providers.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.provider})`,
                }))}
              />
            ) : (
              <div className="text-xs text-error font-medium flex items-center gap-1 pt-2">
                <AlertTriangle className="h-4 w-4" /> No active AI providers
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            {models.length > 0 ? (
              <Select
                id="model"
                value={selectedModel}
                onChange={(value) => setSelectedModel(value)}
                options={models.map((m) => ({
                  value: m.id,
                  label: m.name,
                }))}
              />
            ) : (
              <Input
                id="model"
                type="text"
                placeholder="e.g. gpt-4o"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={providers.length === 0}
                required
              />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructionSource">Instructions</Label>
          <Select
            id="instructionSource"
            value={formData.instructionSource}
            onChange={(value) => setFormData({ ...formData, instructionSource: value as InstructionSource })}
            options={[
              { value: "custom", label: "Custom instructions" },
              { value: "saved", label: "Saved instructions" },
              { value: "upload", label: "Upload instructions file" },
            ]}
          />
        </div>

        {formData.instructionSource === "custom" && (
          <div className="space-y-2">
            <Label htmlFor="instruction">Custom instructions</Label>
            <Textarea
              id="instruction"
              placeholder="Focus on authentication endpoints, test for SQL injection..."
              value={formData.instruction}
              onChange={(e) => setFormData({ ...formData, instruction: e.target.value })}
              rows={4}
            />
            <p className="text-xs text-on-surface-variant">
              Custom instructions for the pentest (optional)
            </p>
          </div>
        )}

        {formData.instructionSource === "saved" && (
          <div className="space-y-2">
            <Label htmlFor="savedInstruction">Select saved instruction</Label>
            <Select
              id="savedInstruction"
              value=""
              onChange={() => {}}
              options={[
                { value: "", label: "No saved instructions available" },
              ]}
            />
            <p className="text-xs text-on-surface-variant">
              Select from previously saved instruction sets
            </p>
          </div>
        )}

        {formData.instructionSource === "upload" && (
          <div className="space-y-2">
            <Label>Upload instruction file</Label>
            <label className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-outline bg-surface-variant px-4 text-base text-on-surface transition-colors hover:bg-surface-variant/80">
              <input
                type="file"
                accept=".txt,.md"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setFormData({ ...formData, instruction: `Uploaded: ${file.name}` })
                  }
                }}
              />
              <Upload className="h-5 w-5 text-on-surface-variant" />
              <span>{formData.instruction || "Choose .txt or .md file"}</span>
            </label>
            <p className="text-xs text-on-surface-variant">
              Upload a .txt or .md file with instructions
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="scanMode">Scan mode</Label>
            <Select
              id="scanMode"
              value={formData.scanMode}
              onChange={(value) => setFormData({ ...formData, scanMode: value as "quick" | "standard" | "deep" })}
              options={[
                { value: "quick", label: "Quick" },
                { value: "standard", label: "Standard" },
                { value: "deep", label: "Deep" },
              ]}
            />
            <p className="text-xs text-on-surface-variant">
              Scan depth and thoroughness
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scopeMode">Scope mode</Label>
            <Select
              id="scopeMode"
              value={formData.scopeMode}
              onChange={(value) => setFormData({ ...formData, scopeMode: value as "auto" | "diff" | "full" })}
              options={[
                { value: "auto", label: "Auto" },
                { value: "diff", label: "Diff" },
                { value: "full", label: "Full" },
              ]}
            />
            <p className="text-xs text-on-surface-variant">
              Code analysis scope
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-error-container p-4">
            <p className="text-sm text-on-error-container">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="text"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || providers.length === 0}>
            {isSubmitting ? "Creating..." : "Start scan"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
