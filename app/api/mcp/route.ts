import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getMainDb } from "@/app/api/(db)/database"

const createMcpSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = getMainDb()
  const servers = db.prepare("SELECT * FROM mcp_servers WHERE user_id = ? ORDER BY created_at DESC").all(session.user.id)

  return NextResponse.json({ servers })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createMcpSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
  }

  const db = getMainDb()
  const id = `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO mcp_servers (id, user_id, name, url, description, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, session.user.id, parsed.data.name, parsed.data.url, parsed.data.description || null, parsed.data.enabled ? 1 : 0, now, now)

  const server = db.prepare("SELECT * FROM mcp_servers WHERE id = ?").get(id)
  return NextResponse.json({ server }, { status: 201 })
}
