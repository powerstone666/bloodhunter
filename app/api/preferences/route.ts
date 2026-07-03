import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getUserPreferences, upsertUserPreferences } from "@/app/api/(db)/feedback-repository"

const updatePreferencesSchema = z.object({
  ignoredCategories: z.array(z.string()).optional(),
  preferredScope: z.string().optional(),
  preferredAggressiveness: z.string().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const prefs = getUserPreferences(session.user.id)
  return NextResponse.json({ preferences: prefs })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = updatePreferencesSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
  }

  const prefs = upsertUserPreferences(session.user.id, parsed.data)
  return NextResponse.json({ preferences: prefs })
}
