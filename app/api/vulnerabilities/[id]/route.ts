import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { updateVulnerabilityStatus } from "@/app/api/(db)/vulnerabilities-repository"

const updateStatusSchema = z.object({
  status: z.enum(["new", "reviewed", "accepted", "false_positive", "fixed"]),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: vulnId } = await params
  const body = await request.json()
  const parsed = updateStatusSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const vuln = updateVulnerabilityStatus(vulnId, parsed.data.status)
  if (!vuln) {
    return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 })
  }

  return NextResponse.json({ vulnerability: vuln })
}
