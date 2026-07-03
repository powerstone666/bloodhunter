import { NextResponse } from "next/server"
import { z } from "zod"
import {
  getProviderById,
  updateProvider,
  deleteProvider,
} from "@/app/api/(db)/providers-repository"

const updateProviderSchema = z.object({
  name: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const provider = getProviderById(id)

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 })
  }

  return NextResponse.json({ provider })
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const body = await request.json()
  const parsed = updateProviderSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider configuration", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const provider = updateProvider(id, parsed.data)

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 })
  }

  return NextResponse.json({ provider })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const success = deleteProvider(id)

  if (!success) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
