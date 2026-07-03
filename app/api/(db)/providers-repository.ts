import { getMainDb } from "./database"
import type { Provider } from "@/app/(common-lib)/schemas"
import crypto from "crypto"

const ENCRYPTION_KEY = process.env.PROVIDER_ENCRYPTION_KEY || "bloodhunter-dev-key-32chars!!"
const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")
  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}

interface ProviderRow {
  id: string
  user_id: string
  name: string
  provider: string
  api_key: string
  base_url: string | null
  default_model: string
  enabled: number
  created_at: string
  updated_at: string
}

export interface CreateProviderInput {
  userId: string
  name: string
  provider: string
  apiKey: string
  baseUrl?: string
  defaultModel: string
  enabled?: boolean
}

export interface UpdateProviderInput {
  name?: string
  provider?: string
  apiKey?: string
  baseUrl?: string
  defaultModel?: string
  enabled?: boolean
}

export function createProvider(input: CreateProviderInput): Provider {
  const db = getMainDb()
  const now = new Date().toISOString()
  const id = `prov-${crypto.randomBytes(8).toString("hex")}`

  const stmt = db.prepare(`
    INSERT INTO provider_configs (id, user_id, name, provider, api_key, base_url, default_model, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    input.userId,
    input.name,
    input.provider,
    encrypt(input.apiKey),
    input.baseUrl || null,
    input.defaultModel,
    input.enabled !== false ? 1 : 0,
    now,
    now
  )

  return getProviderById(id)!
}

export function getProviderById(id: string): Provider | null {
  const db = getMainDb()
  const stmt = db.prepare(`
    SELECT id, user_id, name, provider, api_key, base_url, default_model, enabled, created_at, updated_at
    FROM provider_configs
    WHERE id = ?
  `)

  const row = stmt.get(id) as ProviderRow | undefined
  if (!row) return null

  return rowToProvider(row)
}

export function getAllProviders(userId: string): Provider[] {
  const db = getMainDb()
  const stmt = db.prepare(`
    SELECT id, user_id, name, provider, api_key, base_url, default_model, enabled, created_at, updated_at
    FROM provider_configs
    WHERE user_id = ?
    ORDER BY created_at DESC
  `)

  const rows = stmt.all(userId) as ProviderRow[]
  return rows.map(rowToProvider)
}

export function getEnabledProviders(userId: string): Provider[] {
  const db = getMainDb()
  const stmt = db.prepare(`
    SELECT id, user_id, name, provider, api_key, base_url, default_model, enabled, created_at, updated_at
    FROM provider_configs
    WHERE user_id = ? AND enabled = 1
    ORDER BY created_at DESC
  `)

  const rows = stmt.all(userId) as ProviderRow[]
  return rows.map(rowToProvider)
}

export function updateProvider(id: string, input: UpdateProviderInput): Provider | null {
  const db = getMainDb()
  const now = new Date().toISOString()

  const existing = getProviderById(id)
  if (!existing) return null

  const name = input.name ?? existing.name
  const provider = input.provider ?? existing.provider
  const apiKey = input.apiKey ? encrypt(input.apiKey) : existing.apiKey
  const baseUrl = input.baseUrl ?? existing.baseUrl
  const defaultModel = input.defaultModel ?? existing.defaultModel
  const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : (existing.enabled ? 1 : 0)

  const stmt = db.prepare(`
    UPDATE provider_configs
    SET name = ?, provider = ?, api_key = ?, base_url = ?, default_model = ?, enabled = ?, updated_at = ?
    WHERE id = ?
  `)

  stmt.run(name, provider, apiKey, baseUrl, defaultModel, enabled, now, id)

  return getProviderById(id)
}

export function deleteProvider(id: string): boolean {
  const db = getMainDb()
  const stmt = db.prepare("DELETE FROM provider_configs WHERE id = ?")
  const result = stmt.run(id)
  return result.changes > 0
}

export function getProviderApiKey(id: string): string | null {
  const db = getMainDb()
  const stmt = db.prepare("SELECT api_key FROM provider_configs WHERE id = ?")
  const row = stmt.get(id) as { api_key: string } | undefined
  if (!row) return null
  return decrypt(row.api_key)
}

function rowToProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    apiKey: "[ENCRYPTED]",
    baseUrl: row.base_url || undefined,
    defaultModel: row.default_model,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
