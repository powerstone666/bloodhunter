import { getMainDb } from "./database"

export interface Skill {
  id: string
  userId: string | null
  name: string
  description: string | null
  content: string
  isBuiltin: boolean
  tags: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateSkillInput {
  userId?: string
  name: string
  description?: string
  content: string
  isBuiltin?: boolean
  tags?: string
}

export function createSkill(input: CreateSkillInput): Skill {
  const db = getMainDb()
  const id = `skill-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO skills (id, user_id, name, description, content, is_builtin, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.userId || null, input.name, input.description || null, input.content, input.isBuiltin ? 1 : 0, input.tags || null, now, now)

  return getSkill(id)!
}

export function getSkill(id: string): Skill | null {
  const db = getMainDb()
  const row = db.prepare("SELECT * FROM skills WHERE id = ?").get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return mapRow(row)
}

export function getSkillsByUser(userId: string): Skill[] {
  const db = getMainDb()
  const rows = db.prepare("SELECT * FROM skills WHERE user_id = ? OR is_builtin = 1 ORDER BY name ASC").all(userId) as Array<Record<string, unknown>>
  return rows.map(mapRow)
}

export function getBuiltinSkills(): Skill[] {
  const db = getMainDb()
  const rows = db.prepare("SELECT * FROM skills WHERE is_builtin = 1 ORDER BY name ASC").all() as Array<Record<string, unknown>>
  return rows.map(mapRow)
}

export function updateSkill(id: string, input: Partial<CreateSkillInput>): Skill | null {
  const db = getMainDb()
  const now = new Date().toISOString()

  const updates: string[] = []
  const values: unknown[] = []

  if (input.name !== undefined) { updates.push("name = ?"); values.push(input.name) }
  if (input.description !== undefined) { updates.push("description = ?"); values.push(input.description) }
  if (input.content !== undefined) { updates.push("content = ?"); values.push(input.content) }
  if (input.tags !== undefined) { updates.push("tags = ?"); values.push(input.tags) }

  if (updates.length === 0) return getSkill(id)

  updates.push("updated_at = ?")
  values.push(now)
  values.push(id)

  db.prepare(`UPDATE skills SET ${updates.join(", ")} WHERE id = ?`).run(...values)
  return getSkill(id)
}

export function deleteSkill(id: string): boolean {
  const db = getMainDb()
  const result = db.prepare("DELETE FROM skills WHERE id = ? AND is_builtin = 0").run(id)
  return result.changes > 0
}

export function parseSkillMetadata(content: string): { name: string; description: string; tags: string[] } {
  const nameMatch = content.match(/^#\s+(.+)/m)
  const descMatch = content.match(/^>\s+(.+)/m)
  const tagsMatch = content.match(/tags:\s*(.+)/i)

  return {
    name: nameMatch?.[1]?.trim() || "Untitled Skill",
    description: descMatch?.[1]?.trim() || "",
    tags: tagsMatch?.[1]?.split(",").map(t => t.trim()) || [],
  }
}

function mapRow(row: Record<string, unknown>): Skill {
  return {
    id: row.id as string,
    userId: row.user_id as string | null,
    name: row.name as string,
    description: row.description as string | null,
    content: row.content as string,
    isBuiltin: (row.is_builtin as number) === 1,
    tags: row.tags as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
