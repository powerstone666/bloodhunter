import type { Scan, Provider } from "@/app/(common-lib)/schemas"

interface ScansResponse {
  scans: Scan[]
}

interface CreateScanResponse {
  scanId: string
  status: string
  createdAt: string
}

interface ProvidersResponse {
  providers: Provider[]
}

interface ProviderResponse {
  provider: Provider
}

interface TestConnectionResponse {
  success: boolean
  message: string
}

interface ModelsResponse {
  models: { id: string; name: string; contextWindow: number }[]
}

export interface CreateScanRequest {
  target: string
  instruction?: string
  scanMode: "quick" | "standard" | "deep"
  scopeMode: "auto" | "diff" | "full"
  providerId?: string
  model?: string
}

export interface CreateProviderRequest {
  name: string
  provider: string
  apiKey: string
  baseUrl?: string
  defaultModel: string
  enabled?: boolean
}

export interface UpdateProviderRequest {
  name?: string
  provider?: string
  apiKey?: string
  baseUrl?: string
  defaultModel?: string
  enabled?: boolean
}

export interface TestProviderRequest {
  action: "test"
  provider: string
  apiKey: string
  baseUrl?: string
  defaultModel: string
}

export async function fetchScans(): Promise<Scan[]> {
  const response = await fetch("/api/scans")

  if (!response.ok) {
    throw new Error("Failed to fetch scans")
  }

  const data: ScansResponse = await response.json()
  return data.scans
}

export async function createScan(request: CreateScanRequest): Promise<string> {
  const response = await fetch("/api/scans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to create scan")
  }

  const data: CreateScanResponse = await response.json()
  return data.scanId
}

export async function deleteScan(id: string): Promise<boolean> {
  const response = await fetch(`/api/scans/${id}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || "Failed to delete scan")
  }

  const data = await response.json()
  return data.success
}

export async function startScan(id: string, options?: { instruction?: string; timeoutMs?: number }): Promise<{ agentId: string; success: boolean; output: string }> {
  const response = await fetch(`/api/scans/${id}/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options || {}),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to start scan")
  }

  return response.json()
}

export async function fetchProviders(): Promise<Provider[]> {
  const response = await fetch("/api/providers")

  if (!response.ok) {
    throw new Error("Failed to fetch providers")
  }

  const data: ProvidersResponse = await response.json()
  return data.providers
}

export async function createProvider(request: CreateProviderRequest): Promise<Provider> {
  const response = await fetch("/api/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to create provider")
  }

  const data: ProviderResponse = await response.json()
  return data.provider
}

export async function updateProvider(id: string, request: UpdateProviderRequest): Promise<Provider> {
  const response = await fetch(`/api/providers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to update provider")
  }

  const data: ProviderResponse = await response.json()
  return data.provider
}

export async function deleteProvider(id: string): Promise<boolean> {
  const response = await fetch(`/api/providers/${id}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || "Failed to delete provider")
  }

  const data = await response.json()
  return data.success
}

export async function testProviderConnection(request: TestProviderRequest): Promise<TestConnectionResponse> {
  const response = await fetch("/api/providers", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to test connection")
  }

  return response.json()
}

export async function fetchProviderModels(id: string): Promise<{ id: string; name: string; contextWindow: number }[]> {
  const response = await fetch(`/api/providers/${id}/models`)

  if (!response.ok) {
    throw new Error("Failed to fetch models")
  }

  const data: ModelsResponse = await response.json()
  return data.models
}

interface CatalogEntry {
  name: string
  baseUrl: string
  models: { id: string; name: string }[]
}

interface CatalogResponse {
  catalog: Record<string, CatalogEntry>
}

export async function fetchModelsCatalog(): Promise<Record<string, CatalogEntry>> {
  const response = await fetch("/api/models")

  if (!response.ok) {
    throw new Error("Failed to fetch models catalog")
  }

  const data: CatalogResponse = await response.json()
  return data.catalog
}

