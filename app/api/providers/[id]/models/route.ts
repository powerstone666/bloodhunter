import { NextResponse } from "next/server"
import { getProviderById } from "@/app/api/(db)/providers-repository"

interface ModelEntry {
  id: string
  name: string
}

interface ExternalModelEntry {
  id?: string
  name?: string
  [key: string]: unknown
}

interface ExternalProviderData {
  models?: ExternalModelEntry[] | Record<string, ExternalModelEntry>
  [key: string]: unknown
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const provider = getProviderById(id)

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 })
  }

  try {
    const res = await fetch("https://models.dev/api.json", {
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json()
      const providerData = data[provider.provider.toLowerCase()] as ExternalProviderData | undefined
      if (providerData && providerData.models) {
        const models: ModelEntry[] = []
        const modelsObj = providerData.models

        if (Array.isArray(modelsObj)) {
          modelsObj.forEach((m) => {
            if (m && m.id) {
              models.push({ id: m.id, name: m.name || m.id })
            }
          })
        } else if (typeof modelsObj === "object") {
          for (const [modelId, modelVal] of Object.entries(modelsObj)) {
            if (modelVal && typeof modelVal === "object") {
              models.push({ id: modelId, name: modelVal.name || modelId })
            }
          }
        }

        if (models.length > 0) {
          return NextResponse.json({ models })
        }
      }
    }
  } catch (error) {
    console.warn("Failed to fetch models from models.dev:", error)
  }

  return NextResponse.json({ models: [] })
}
