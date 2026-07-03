import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { getMainDb } from "@/app/api/(db)/database"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const db = getMainDb()

  const server = db.prepare("SELECT * FROM mcp_servers WHERE id = ? AND user_id = ?").get(id, session.user.id)
  if (!server) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 })
  }

  db.prepare("DELETE FROM mcp_servers WHERE id = ?").run(id)
  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const db = getMainDb()

  const server = db.prepare("SELECT * FROM mcp_servers WHERE id = ? AND user_id = ?").get(id, session.user.id)
  if (!server) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 })
  }

  const body = await request.json()
  const now = new Date().toISOString()

  const updates: string[] = []
  const values: unknown[] = []

  if (body.name !== undefined) { updates.push("name = ?"); values.push(body.name) }
  if (body.url !== undefined) { updates.push("url = ?"); values.push(body.url) }
  if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description) }
  if (body.enabled !== undefined) { updates.push("enabled = ?"); values.push(body.enabled ? 1 : 0) }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 })
  }

  updates.push("updated_at = ?")
  values.push(now)
  values.push(id)

  db.prepare(`UPDATE mcp_servers SET ${updates.join(", ")} WHERE id = ?`).run(...values)

  const updated = db.prepare("SELECT * FROM mcp_servers WHERE id = ?").get(id)
  return NextResponse.json({ server: updated })
}
