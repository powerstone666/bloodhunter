import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import {
  getAllProviders,
  createProvider,
} from "@/app/api/(db)/providers-repository"
import {
  testProviderConnection,
  type ProviderConfig,
} from "@/app/api/(services)/provider-registry"

const createProviderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  provider: z.string().min(1, "Provider is required"),
  apiKey: z.string().min(1, "API key is required"),
  baseUrl: z.string().optional(),
  defaultModel: z.string().min(1, "Default model is required"),
  enabled: z.boolean().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const providers = getAllProviders(session.user.id)
  return NextResponse.json({ providers })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createProviderSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider configuration", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const provider = createProvider({
    userId: session.user.id,
    ...parsed.data,
  })

  return NextResponse.json({ provider }, { status: 201 })
}

export async function PATCH(request: Request) {
  const body = await request.json()

  if (body.action === "test") {
    const testSchema = z.object({
      provider: z.string().min(1),
      apiKey: z.string().min(1),
      baseUrl: z.string().optional(),
      defaultModel: z.string().min(1),
    })

    const parsed = testSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid test configuration", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const config: ProviderConfig = {
      id: "test",
      name: "test",
      ...parsed.data,
    }

    const result = await testProviderConnection(config)
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
