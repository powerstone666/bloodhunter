import { NextResponse } from "next/server"
import { z } from "zod"
import { nanoid } from "nanoid"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { createScan, getAllScans } from "@/app/api/(db)/scans-repository"
import { createScanEvent } from "@/app/api/(db)/scan-events-repository"

const createScanSchema = z.object({
  target: z.string().min(1, "Target is required"),
  instruction: z.string().optional(),
  scanMode: z.enum(["quick", "standard", "deep"]),
  scopeMode: z.enum(["auto", "diff", "full"]),
  providerId: z.string().optional(),
  model: z.string().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const scans = getAllScans(session.user.id)
  return NextResponse.json({ scans })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createScanSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid scan configuration", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const scanId = `scan-${nanoid()}`
  const now = new Date().toISOString()

  const scan = createScan({
    id: scanId,
    userId: session.user.id,
    targetUrl: parsed.data.target,
    scopeMode: parsed.data.scopeMode,
    aggressiveness: "moderate",
    status: "queued",
    instruction: parsed.data.instruction,
    scanMode: parsed.data.scanMode,
    providerId: parsed.data.providerId,
    modelId: parsed.data.model,
  })

  createScanEvent({
    scanId,
    eventType: "scan.created",
    eventData: {
      providerId: parsed.data.providerId,
      model: parsed.data.model,
    },
    timestamp: now,
  })

  return NextResponse.json(
    {
      scanId: scan.id,
      status: scan.status,
      createdAt: scan.createdAt,
    },
    { status: 201 }
  )
}
