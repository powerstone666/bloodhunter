import { getMainDb } from "./database"

export interface GraphNode {
  id: string
  scanId: string
  nodeType: string
  label: string
  data: string | null
  createdAt: string
}

export interface GraphEdge {
  id: string
  scanId: string
  sourceId: string
  targetId: string
  edgeType: string
  data: string | null
  createdAt: string
}

export interface CreateNodeInput {
  scanId: string
  nodeType: "endpoint" | "parameter" | "technology" | "finding" | "agent_action"
  label: string
  data?: string
}

export interface CreateEdgeInput {
  scanId: string
  sourceId: string
  targetId: string
  edgeType: "has_parameter" | "uses_technology" | "found_on" | "tested_by"
  data?: string
}

export function createNode(input: CreateNodeInput): GraphNode {
  const db = getMainDb()
  const id = `node-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO graph_nodes (id, scan_id, node_type, label, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.scanId, input.nodeType, input.label, input.data || null, now)

  return getNode(id)!
}

export function getNode(id: string): GraphNode | null {
  const db = getMainDb()
  const row = db.prepare("SELECT * FROM graph_nodes WHERE id = ?").get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return mapNode(row)
}

export function findNodeByLabel(scanId: string, nodeType: string, label: string): GraphNode | null {
  const db = getMainDb()
  const row = db.prepare("SELECT * FROM graph_nodes WHERE scan_id = ? AND node_type = ? AND label = ? LIMIT 1")
    .get(scanId, nodeType, label) as Record<string, unknown> | undefined
  if (!row) return null
  return mapNode(row)
}

export function getNodesByScanId(scanId: string): GraphNode[] {
  const db = getMainDb()
  const rows = db.prepare("SELECT * FROM graph_nodes WHERE scan_id = ? ORDER BY created_at ASC").all(scanId) as Array<Record<string, unknown>>
  return rows.map(mapNode)
}

export function getNodesByType(scanId: string, nodeType: string): GraphNode[] {
  const db = getMainDb()
  const rows = db.prepare("SELECT * FROM graph_nodes WHERE scan_id = ? AND node_type = ? ORDER BY created_at ASC")
    .all(scanId, nodeType) as Array<Record<string, unknown>>
  return rows.map(mapNode)
}

export function createEdge(input: CreateEdgeInput): GraphEdge {
  const db = getMainDb()
  const id = `edge-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO graph_edges (id, scan_id, source_id, target_id, edge_type, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.scanId, input.sourceId, input.targetId, input.edgeType, input.data || null, now)

  return getEdge(id)!
}

export function getEdge(id: string): GraphEdge | null {
  const db = getMainDb()
  const row = db.prepare("SELECT * FROM graph_edges WHERE id = ?").get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return mapEdge(row)
}

export function getEdgesByScanId(scanId: string): GraphEdge[] {
  const db = getMainDb()
  const rows = db.prepare("SELECT * FROM graph_edges WHERE scan_id = ? ORDER BY created_at ASC").all(scanId) as Array<Record<string, unknown>>
  return rows.map(mapEdge)
}

export function getEdgesFromNode(nodeId: string): GraphEdge[] {
  const db = getMainDb()
  const rows = db.prepare("SELECT * FROM graph_edges WHERE source_id = ? ORDER BY created_at ASC").all(nodeId) as Array<Record<string, unknown>>
  return rows.map(mapEdge)
}

export function getEdgesToNode(nodeId: string): GraphEdge[] {
  const db = getMainDb()
  const rows = db.prepare("SELECT * FROM graph_edges WHERE target_id = ? ORDER BY created_at ASC").all(nodeId) as Array<Record<string, unknown>>
  return rows.map(mapEdge)
}

export function getUntestedEndpoints(scanId: string): GraphNode[] {
  const db = getMainDb()
  const rows = db.prepare(`
    SELECT n.* FROM graph_nodes n
    WHERE n.scan_id = ? AND n.node_type = 'endpoint'
    AND NOT EXISTS (
      SELECT 1 FROM graph_edges e
      WHERE e.source_id = n.id AND e.edge_type = 'tested_by'
    )
    ORDER BY n.created_at ASC
  `).all(scanId) as Array<Record<string, unknown>>
  return rows.map(mapNode)
}

export function getFindingsForEndpoint(endpointId: string): GraphNode[] {
  const db = getMainDb()
  const rows = db.prepare(`
    SELECT n.* FROM graph_nodes n
    INNER JOIN graph_edges e ON e.target_id = n.id
    WHERE e.source_id = ? AND e.edge_type = 'found_on' AND n.node_type = 'finding'
    ORDER BY n.created_at ASC
  `).all(endpointId) as Array<Record<string, unknown>>
  return rows.map(mapNode)
}

export function deleteGraphByScanId(scanId: string): void {
  const db = getMainDb()
  db.prepare("DELETE FROM graph_edges WHERE scan_id = ?").run(scanId)
  db.prepare("DELETE FROM graph_nodes WHERE scan_id = ?").run(scanId)
}

function mapNode(row: Record<string, unknown>): GraphNode {
  return {
    id: row.id as string,
    scanId: row.scan_id as string,
    nodeType: row.node_type as string,
    label: row.label as string,
    data: row.data as string | null,
    createdAt: row.created_at as string,
  }
}

function mapEdge(row: Record<string, unknown>): GraphEdge {
  return {
    id: row.id as string,
    scanId: row.scan_id as string,
    sourceId: row.source_id as string,
    targetId: row.target_id as string,
    edgeType: row.edge_type as string,
    data: row.data as string | null,
    createdAt: row.created_at as string,
  }
}
