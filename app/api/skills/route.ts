import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { createSkill, getSkillsByUser, parseSkillMetadata } from "@/app/api/(db)/skills-repository"

const createSkillSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  content: z.string().min(1),
  tags: z.string().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const skills = getSkillsByUser(session.user.id)
  return NextResponse.json({ skills })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createSkillSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
  }

  const metadata = parseSkillMetadata(parsed.data.content)

  const skill = createSkill({
    userId: session.user.id,
    name: parsed.data.name || metadata.name,
    description: parsed.data.description || metadata.description,
    content: parsed.data.content,
    tags: parsed.data.tags || metadata.tags.join(", "),
  })

  return NextResponse.json({ skill }, { status: 201 })
}
