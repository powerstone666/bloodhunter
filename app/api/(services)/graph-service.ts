import { createNode, createEdge, findNodeByLabel } from "../(db)/graph-repository"
import { getEndpointsByScanId } from "../(db)/endpoints-repository"
import { getVulnerabilitiesByScanId } from "../(db)/vulnerabilities-repository"
import { getMainDb } from "../(db)/database"

export function buildGraphFromScanData(scanId: string): void {
  const endpoints = getEndpointsByScanId(scanId)
  const vulns = getVulnerabilitiesByScanId(scanId)

  for (const ep of endpoints) {
    const existing = findNodeByLabel(scanId, "endpoint", ep.url)
    if (existing) continue

    const node = createNode({
      scanId,
      nodeType: "endpoint",
      label: ep.url,
      data: JSON.stringify({
        method: ep.method,
        statusCode: ep.statusCode,
        contentType: ep.contentType,
        title: ep.title,
      }),
    })

    if (ep.technologies) {
      const techs = ep.technologies.split(",").map(t => t.trim()).filter(Boolean)
      for (const tech of techs) {
        let techNode = findNodeByLabel(scanId, "technology", tech)
        if (!techNode) {
          techNode = createNode({
            scanId,
            nodeType: "technology",
            label: tech,
          })
        }
        createEdge({
          scanId,
          sourceId: node.id,
          targetId: techNode.id,
          edgeType: "uses_technology",
        })
      }
    }
  }

  for (const vuln of vulns) {
    const existing = findNodeByLabel(scanId, "finding", vuln.title)
    if (existing) continue

    const findingNode = createNode({
      scanId,
      nodeType: "finding",
      label: vuln.title,
      data: JSON.stringify({
        severity: vuln.severity,
        confidence: vuln.confidence,
        status: vuln.status,
        endpoint: vuln.endpoint,
      }),
    })

    const endpointNode = findNodeByLabel(scanId, "endpoint", vuln.endpoint)
    if (endpointNode) {
      createEdge({
        scanId,
        sourceId: findingNode.id,
        targetId: endpointNode.id,
        edgeType: "found_on",
      })
    }
  }
}

export function getGraphStats(scanId: string): {
  nodeCount: number
  edgeCount: number
  nodesByType: Record<string, number>
  edgesByType: Record<string, number>
} {
  const db = getMainDb()

  const nodeCount = (db.prepare("SELECT COUNT(*) as count FROM graph_nodes WHERE scan_id = ?").get(scanId) as { count: number }).count
  const edgeCount = (db.prepare("SELECT COUNT(*) as count FROM graph_edges WHERE scan_id = ?").get(scanId) as { count: number }).count

  const nodeTypeRows = db.prepare("SELECT node_type, COUNT(*) as count FROM graph_nodes WHERE scan_id = ? GROUP BY node_type").all(scanId) as Array<{ node_type: string; count: number }>
  const nodesByType: Record<string, number> = {}
  for (const row of nodeTypeRows) {
    nodesByType[row.node_type] = row.count
  }

  const edgeTypeRows = db.prepare("SELECT edge_type, COUNT(*) as count FROM graph_edges WHERE scan_id = ? GROUP BY edge_type").all(scanId) as Array<{ edge_type: string; count: number }>
  const edgesByType: Record<string, number> = {}
  for (const row of edgeTypeRows) {
    edgesByType[row.edge_type] = row.count
  }

  return { nodeCount, edgeCount, nodesByType, edgesByType }
}
