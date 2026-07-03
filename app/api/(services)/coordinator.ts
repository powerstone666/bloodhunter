import { createAgent, updateAgentStatus, getAgentsByScanId } from "../(db)/agents-repository"
import { createScanEvent } from "../(db)/scan-events-repository"
import { createCheckpoint } from "../(db)/checkpoints-repository"

export interface CoordinatorConfig {
  scanId: string
  maxAgents: number
}

export interface AgentTask {
  agentId: string
  targetGroup: string
  endpoints: string[]
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
}

export function createCoordinator(config: CoordinatorConfig) {
  const { scanId, maxAgents } = config

  function createChildAgent(name: string, parentAgentId?: string) {
    const agentId = `agent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    createAgent({
      id: agentId,
      scanId,
      parentId: parentAgentId,
      name,
    })

    createScanEvent({
      scanId,
      eventType: "agent.spawned",
      eventData: {
        agentId,
        parentId: parentAgentId,
        name,
      },
      timestamp: new Date().toISOString(),
    })

    return agentId
  }

  function assignEndpointsToAgents(endpoints: string[]): AgentTask[] {
    const tasks: AgentTask[] = []
    const endpointsPerAgent = Math.ceil(endpoints.length / maxAgents)

    for (let i = 0; i < maxAgents && i * endpointsPerAgent < endpoints.length; i++) {
      const group = endpoints.slice(i * endpointsPerAgent, (i + 1) * endpointsPerAgent)
      const agentId = createChildAgent(`Hunter ${i + 1}`)

      tasks.push({
        agentId,
        targetGroup: `Group ${i + 1}`,
        endpoints: group,
        status: "queued",
      })
    }

    return tasks
  }

  function completeAgent(agentId: string) {
    updateAgentStatus(agentId, "completed", new Date().toISOString())

    createCheckpoint({
      scanId,
      phase: "agent_completed",
      agentId,
      data: JSON.stringify({ completedAt: new Date().toISOString() }),
    })
  }

  function failAgent(agentId: string, error: string) {
    updateAgentStatus(agentId, "failed", new Date().toISOString())

    createScanEvent({
      scanId,
      eventType: "agent.log",
      eventData: {
        agentId,
        level: "error",
        message: `Agent failed: ${error}`,
      },
      timestamp: new Date().toISOString(),
    })
  }

  function cancelAgent(agentId: string) {
    updateAgentStatus(agentId, "cancelled", new Date().toISOString())

    createScanEvent({
      scanId,
      eventType: "agent.log",
      eventData: {
        agentId,
        level: "warn",
        message: "Agent cancelled",
      },
      timestamp: new Date().toISOString(),
    })
  }

  function getAgentTree() {
    const agents = getAgentsByScanId(scanId)
    const agentMap = new Map(agents.map(a => [a.id, { ...a, children: [] as typeof agents }]))
    const roots: typeof agents = []

    for (const agent of agents) {
      if (agent.parentId && agentMap.has(agent.parentId)) {
        agentMap.get(agent.parentId)!.children.push(agent)
      } else {
        roots.push(agent)
      }
    }

    return roots
  }

  function getRunningAgents() {
    return getAgentsByScanId(scanId).filter(a => a.status === "running")
  }

  function canSpawnMore() {
    return getRunningAgents().length < maxAgents
  }

  return {
    createChildAgent,
    assignEndpointsToAgents,
    completeAgent,
    failAgent,
    cancelAgent,
    getAgentTree,
    getRunningAgents,
    canSpawnMore,
  }
}
