import { getMainDb } from "./database"

export interface Feedback {
  id: string
  userId: string
  scanId: string | null
  vulnerabilityId: string | null
  action: string
  category: string | null
  note: string | null
  createdAt: string
}

export interface CreateFeedbackInput {
  userId: string
  scanId?: string
  vulnerabilityId?: string
  action: "mark_false_positive" | "accept_vulnerability" | "add_remediation" | "request_deeper_scan" | "ignore_category"
  category?: string
  note?: string
}

export function createFeedback(input: CreateFeedbackInput): Feedback {
  const db = getMainDb()
  const id = `fb-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO feedback (id, user_id, scan_id, vulnerability_id, action, category, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.userId, input.scanId || null, input.vulnerabilityId || null, input.action, input.category || null, input.note || null, now)

  return getFeedback(id)!
}

export function getFeedback(id: string): Feedback | null {
  const db = getMainDb()
  const row = db.prepare("SELECT * FROM feedback WHERE id = ?").get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return mapRow(row)
}

export function getFeedbackByUser(userId: string): Feedback[] {
  const db = getMainDb()
  const rows = db.prepare("SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC").all(userId) as Array<Record<string, unknown>>
  return rows.map(mapRow)
}

export function getFeedbackByScan(scanId: string): Feedback[] {
  const db = getMainDb()
  const rows = db.prepare("SELECT * FROM feedback WHERE scan_id = ? ORDER BY created_at DESC").all(scanId) as Array<Record<string, unknown>>
  return rows.map(mapRow)
}

export function getIgnoredCategories(userId: string): string[] {
  const db = getMainDb()
  const rows = db.prepare("SELECT category FROM feedback WHERE user_id = ? AND action = 'ignore_category' AND category IS NOT NULL")
    .all(userId) as Array<{ category: string }>
  return [...new Set(rows.map(r => r.category))]
}

export function deleteFeedback(id: string): boolean {
  const db = getMainDb()
  const result = db.prepare("DELETE FROM feedback WHERE id = ?").run(id)
  return result.changes > 0
}

interface UserPreferences {
  userId: string
  ignoredCategories: string[]
  preferredScope: string | null
  preferredAggressiveness: string | null
  updatedAt: string
}

export function getUserPreferences(userId: string): UserPreferences | null {
  const db = getMainDb()
  const row = db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(userId) as Record<string, unknown> | undefined
  if (!row) return null
  return {
    userId: row.user_id as string,
    ignoredCategories: row.ignored_categories ? JSON.parse(row.ignored_categories as string) : [],
    preferredScope: row.preferred_scope as string | null,
    preferredAggressiveness: row.preferred_aggressiveness as string | null,
    updatedAt: row.updated_at as string,
  }
}

export function upsertUserPreferences(userId: string, prefs: Partial<Omit<UserPreferences, "userId" | "updatedAt">>): UserPreferences {
  const db = getMainDb()
  const now = new Date().toISOString()
  const existing = getUserPreferences(userId)

  if (existing) {
    db.prepare(`
      UPDATE user_preferences
      SET ignored_categories = ?, preferred_scope = ?, preferred_aggressiveness = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      JSON.stringify(prefs.ignoredCategories || existing.ignoredCategories),
      prefs.preferredScope ?? existing.preferredScope,
      prefs.preferredAggressiveness ?? existing.preferredAggressiveness,
      now,
      userId
    )
  } else {
    db.prepare(`
      INSERT INTO user_preferences (user_id, ignored_categories, preferred_scope, preferred_aggressiveness, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId,
      JSON.stringify(prefs.ignoredCategories || []),
      prefs.preferredScope || null,
      prefs.preferredAggressiveness || null,
      now
    )
  }

  return getUserPreferences(userId)!
}

function mapRow(row: Record<string, unknown>): Feedback {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    scanId: row.scan_id as string | null,
    vulnerabilityId: row.vulnerability_id as string | null,
    action: row.action as string,
    category: row.category as string | null,
    note: row.note as string | null,
    createdAt: row.created_at as string,
  }
}
