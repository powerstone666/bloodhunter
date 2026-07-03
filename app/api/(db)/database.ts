import Database from "better-sqlite3"
import path from "path"
import fs from "fs"

const DB_DIR = path.join(process.cwd(), "data")
const MAIN_DB_PATH = path.join(DB_DIR, "app.db")

let mainDb: Database.Database | null = null

export function getMainDb(): Database.Database {
  if (mainDb) {
    return mainDb
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }

  mainDb = new Database(MAIN_DB_PATH)
  mainDb.pragma("journal_mode = WAL")
  mainDb.pragma("foreign_keys = ON")

  initializeMainDb(mainDb)

  return mainDb
}

function initializeMainDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_url TEXT NOT NULL,
      scope_mode TEXT NOT NULL,
      aggressiveness TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      instruction TEXT,
      scan_mode TEXT,
      provider_id TEXT,
      model_id TEXT,
      max_depth INTEGER,
      max_agents INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS scan_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_data TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      parent_id TEXT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES agents(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS vulnerabilities (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      title TEXT NOT NULL,
      severity TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT,
      description TEXT NOT NULL,
      evidence TEXT NOT NULL,
      remediation TEXT,
      confidence TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS endpoints (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      url TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'GET',
      status_code INTEGER,
      content_type TEXT,
      title TEXT,
      technologies TEXT,
      headers TEXT,
      discovered_at TEXT NOT NULL,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      agent_id TEXT,
      step_number INTEGER NOT NULL DEFAULT 0,
      data TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS graph_nodes (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      label TEXT NOT NULL,
      data TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS graph_edges (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      edge_type TEXT NOT NULL,
      data TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      scan_id TEXT,
      vulnerability_id TEXT,
      action TEXT NOT NULL,
      category TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      ignored_categories TEXT,
      preferred_scope TEXT,
      preferred_aggressiveness TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_configs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      api_key TEXT NOT NULL,
      base_url TEXT,
      default_model TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
    CREATE INDEX IF NOT EXISTS idx_scan_events_scan_id ON scan_events(scan_id);
    CREATE INDEX IF NOT EXISTS idx_agents_scan_id ON agents(scan_id);
    CREATE INDEX IF NOT EXISTS idx_vulnerabilities_scan_id ON vulnerabilities(scan_id);
    CREATE INDEX IF NOT EXISTS idx_endpoints_scan_id ON endpoints(scan_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_scan_id ON checkpoints(scan_id);
    CREATE INDEX IF NOT EXISTS idx_graph_nodes_scan_id ON graph_nodes(scan_id);
    CREATE INDEX IF NOT EXISTS idx_graph_edges_scan_id ON graph_edges(scan_id);
    CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_scan_id ON feedback(scan_id);
    CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON mcp_servers(user_id);
    CREATE INDEX IF NOT EXISTS idx_provider_configs_user_id ON provider_configs(user_id);
  `)

  // Migration: Add user_id column to existing scans table if it doesn't exist
  const columns = db.prepare("PRAGMA table_info(scans)").all() as Array<{ name: string }>
  const hasUserId = columns.some(col => col.name === 'user_id')
  if (!hasUserId) {
    db.exec("ALTER TABLE scans ADD COLUMN user_id TEXT NOT NULL DEFAULT 'user-1'")
    db.exec("CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id)")
  }

  const hasProviderId = columns.some(col => col.name === 'provider_id')
  if (!hasProviderId) {
    db.exec("ALTER TABLE scans ADD COLUMN provider_id TEXT")
  }

  const hasModelId = columns.some(col => col.name === 'model_id')
  if (!hasModelId) {
    db.exec("ALTER TABLE scans ADD COLUMN model_id TEXT")
  }

  // Migration: Add user_id column to existing provider_configs table if it doesn't exist
  const providerColumns = db.prepare("PRAGMA table_info(provider_configs)").all() as Array<{ name: string }>
  const hasProviderUserId = providerColumns.some(col => col.name === 'user_id')
  if (!hasProviderUserId) {
    db.exec("ALTER TABLE provider_configs ADD COLUMN user_id TEXT NOT NULL DEFAULT 'user-1'")
    db.exec("CREATE INDEX IF NOT EXISTS idx_provider_configs_user_id ON provider_configs(user_id)")
  }
}

export function closeMainDb() {
  if (mainDb) {
    mainDb.close()
    mainDb = null
  }
}
