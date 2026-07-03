import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getScanById, deleteScan, updateScanStatus } from "@/app/api/(db)/scans-repository"
import { getScanEvents } from "@/app/api/(db)/scan-events-repository"
import { getVulnerabilitiesByScanId } from "@/app/api/(db)/vulnerabilities-repository"
import { getAgentsByScanId, updateAgentStatus } from "@/app/api/(db)/agents-repository"
import { createCheckpoint, getLatestCheckpoint } from "@/app/api/(db)/checkpoints-repository"
import { createScanEvent } from "@/app/api/(db)/scan-events-repository"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const scan = getScanById(id)

  if (!scan) {
    return NextResponse.json(
      { error: "Scan not found" },
      { status: 404 }
    )
  }

  if (scan.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const events = getScanEvents(id)
  const vulnerabilities = getVulnerabilitiesByScanId(id)
  const agents = getAgentsByScanId(id)

  return NextResponse.json({
    scan,
    events,
    vulnerabilities,
    agents,
  })
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const scan = getScanById(id)

  if (!scan) {
    return NextResponse.json(
      { error: "Scan not found" },
      { status: 404 }
    )
  }

  if (scan.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const success = deleteScan(id)
  if (!success) {
    return NextResponse.json(
      { error: "Failed to delete scan" },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

const patchSchema = z.object({
  action: z.enum(["pause", "resume", "retry"]),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const scan = getScanById(id)

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 })
  }

  if (scan.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { action } = parsed.data

  if (action === "pause") {
    if (scan.status !== "running") {
      return NextResponse.json({ error: "Can only pause running scans" }, { status: 400 })
    }

    const checkpoint = createCheckpoint({
      scanId: id,
      phase: "paused",
      stepNumber: getLatestCheckpoint(id)?.stepNumber ? getLatestCheckpoint(id)!.stepNumber + 1 : 0,
      data: JSON.stringify({ pausedAt: new Date().toISOString() }),
    })

    const runningAgents = getAgentsByScanId(id).filter(a => a.status === "running")
    for (const agent of runningAgents) {
      updateAgentStatus(agent.id, "paused", undefined)
    }

    updateScanStatus(id, "paused")

    createScanEvent({
      scanId: id,
      eventType: "scan.failed",
      eventData: { error: "Scan paused by user", checkpointId: checkpoint.id },
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, status: "paused", checkpointId: checkpoint.id })
  }

  if (action === "resume") {
    if (scan.status !== "paused") {
      return NextResponse.json({ error: "Can only resume paused scans" }, { status: 400 })
    }

    updateScanStatus(id, "running")

    createScanEvent({
      scanId: id,
      eventType: "scan.started",
      eventData: {},
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, status: "running" })
  }

  if (action === "retry") {
    if (!["failed", "completed"].includes(scan.status)) {
      return NextResponse.json({ error: "Can only retry failed or completed scans" }, { status: 400 })
    }

    updateScanStatus(id, "queued")

    createScanEvent({
      scanId: id,
      eventType: "scan.created",
      eventData: {},
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, status: "queued" })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

