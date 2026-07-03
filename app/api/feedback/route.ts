import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { createFeedback, getFeedbackByUser } from "@/app/api/(db)/feedback-repository"

const createFeedbackSchema = z.object({
  scanId: z.string().optional(),
  vulnerabilityId: z.string().optional(),
  action: z.enum(["mark_false_positive", "accept_vulnerability", "add_remediation", "request_deeper_scan", "ignore_category"]),
  category: z.string().optional(),
  note: z.string().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const feedback = getFeedbackByUser(session.user.id)
  return NextResponse.json({ feedback })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createFeedbackSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
  }

  const feedback = createFeedback({
    userId: session.user.id,
    ...parsed.data,
  })

  return NextResponse.json({ feedback }, { status: 201 })
}
