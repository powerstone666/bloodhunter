import { log } from "./logger"

export interface LiveViewEvent {
  id: string
  type: "chat" | "tool"
  agentId: string
  timestamp: string
  version: number
  data: Record<string, unknown>
}

export interface AgentInfo {
  id: string
  name: string
  parentId: string | null
  status: string
  createdAt: string
  updatedAt: string
  errorMessage?: string
}

export class LiveView {
  private agents = new Map<string, AgentInfo>()
  private events: LiveViewEvent[] = []
  private nextEventId = 1
  private openAssistantEventByAgent = new Map<string, LiveViewEvent>()
  private toolEventByCallId = new Map<string, LiveViewEvent>()

  hydrateFromSnapshot(
    statuses: Record<string, string>,
    names: Record<string, string>,
    parentOf: Record<string, string | null>
  ): void {
    for (const [agentId, status] of Object.entries(statuses)) {
      this.upsertAgent(agentId, {
        name: names[agentId] || agentId,
        parentId: parentOf[agentId] || null,
        status,
      })
    }
  }

  upsertAgent(
    agentId: string,
    options: {
      name?: string
      parentId?: string | null
      status?: string
      errorMessage?: string
    }
  ): void {
    const now = new Date().toISOString()
    const current = this.agents.get(agentId) || {
      id: agentId,
      name: options.name || agentId,
      parentId: options.parentId || null,
      status: options.status || "running",
      createdAt: now,
      updatedAt: now,
    }

    if (options.name !== undefined) current.name = options.name
    if (options.parentId !== undefined) current.parentId = options.parentId
    if (options.status !== undefined) current.status = options.status
    if (options.errorMessage) current.errorMessage = options.errorMessage
    current.updatedAt = now

    this.agents.set(agentId, current)
  }

  recordUserMessage(agentId: string, content: string): void {
    this.appendEvent(agentId, "chat", {
      role: "user",
      content,
      metadata: { source: "user" },
    })
  }

  ingestSdkEvent(agentId: string, event: unknown): void {
    const eventType = (event as { type?: string })?.type || ""
    
    if (eventType === "raw_response_event") {
      this.ingestRawResponseEvent(agentId, (event as { data?: unknown })?.data)
      return
    }

    if (eventType !== "run_item_stream_event") return

    const item = (event as { item?: unknown })?.item
    const itemType = (item as { type?: string })?.type || ""

    if (itemType === "message_output_item") {
      this.recordAssistantMessage(agentId, this.sdkMessageText(item), true)
    } else if (itemType === "tool_call_item") {
      this.recordToolCall(agentId, item)
    } else if (itemType === "tool_call_output_item") {
      this.recordToolOutput(agentId, item)
    }
  }

  eventsForAgent(agentId: string): LiveViewEvent[] {
    return this.events.filter(e => e.agentId === agentId)
  }

  hasEventsForAgent(agentId: string): boolean {
    return this.events.some(e => e.agentId === agentId)
  }

  getAllEvents(): LiveViewEvent[] {
    return [...this.events]
  }

  getAgent(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId)
  }

  getAllAgents(): AgentInfo[] {
    return Array.from(this.agents.values())
  }

  private ingestRawResponseEvent(agentId: string, data: unknown): void {
    const dataType = (data as { type?: string })?.type || ""
    
    if (dataType === "response.output_text.delta") {
      const delta = (data as { delta?: string })?.delta || ""
      if (delta) {
        this.recordAssistantMessage(agentId, delta, false)
      }
    }
  }

  private recordAssistantMessage(agentId: string, content: string, final: boolean): void {
    if (!content) return

    const existing = this.openAssistantEventByAgent.get(agentId)
    
    if (!existing) {
      const event = this.appendEvent(agentId, "chat", {
        role: "assistant",
        content,
        metadata: { source: "sdk_stream", streaming: !final },
      })
      
      if (!final) {
        this.openAssistantEventByAgent.set(agentId, event)
      }
      return
    }

    const data = existing.data as { content?: string; metadata?: { streaming?: boolean } }
    
    if (final) {
      data.content = content
      if (data.metadata) data.metadata.streaming = false
      this.openAssistantEventByAgent.delete(agentId)
    } else {
      data.content = (data.content || "") + content
    }
    
    this.bumpEvent(existing)
  }

  private recordToolCall(agentId: string, item: unknown): void {
    this.recordToolCallData(agentId, this.sdkToolCallData(item))
  }

  private recordToolCallData(agentId: string, call: Record<string, unknown>): void {
    const callId = call.call_id as string
    const existing = this.toolEventByCallId.get(callId)
    
    const toolData = {
      tool_name: call.tool_name,
      args: call.args,
      status: "running",
      agent_id: agentId,
      call_id: callId,
    }

    if (!existing) {
      const event = this.appendEvent(agentId, "tool", toolData)
      this.toolEventByCallId.set(callId, event)
    } else {
      Object.assign(existing.data, toolData)
      this.bumpEvent(existing)
    }
  }

  private recordToolOutput(agentId: string, item: unknown): void {
    this.recordToolOutputData(agentId, this.sdkToolOutputData(item))
  }

  private recordToolOutputData(agentId: string, output: Record<string, unknown>): void {
    const callId = output.call_id as string
    let event = this.toolEventByCallId.get(callId)

    if (!event) {
      event = this.appendEvent(agentId, "tool", {
        tool_name: output.tool_name,
        args: {},
        status: "completed",
        agent_id: agentId,
        call_id: callId,
      })
      this.toolEventByCallId.set(callId, event)
    }

    const result = this.parseJsonValue(output.output)
    event.data.result = result
    event.data.status = this.toolStatusFromResult(result)
    this.bumpEvent(event)
  }

  private appendEvent(
    agentId: string,
    eventType: "chat" | "tool",
    data: Record<string, unknown>,
    timestamp?: string
  ): LiveViewEvent {
    const event: LiveViewEvent = {
      id: `${eventType}_${this.nextEventId}`,
      type: eventType,
      agentId,
      timestamp: timestamp || new Date().toISOString(),
      version: 0,
      data,
    }
    
    this.nextEventId++
    this.events.push(event)
    
    log.debug("LIVE_VIEW", "Event appended", {
      eventId: event.id,
      type: eventType,
      agentId,
    })
    
    return event
  }

  private bumpEvent(event: LiveViewEvent, timestamp?: string): void {
    event.version++
    event.timestamp = timestamp || new Date().toISOString()
  }

  private sdkToolCallData(item: unknown): Record<string, unknown> {
    const raw = (item as { raw_item?: unknown })?.raw_item || item
    const callId = String(this.rawField(raw, "call_id") || this.rawField(raw, "id") || "")
    const toolName = String(
      this.rawField(raw, "name") || 
      this.rawField(raw, "type") || 
      (item as { title?: string })?.title || 
      "tool"
    )

    return {
      call_id: callId,
      tool_name: toolName,
      args: this.parseJsonObject(this.rawField(raw, "arguments")),
    }
  }

  private sdkToolOutputData(item: unknown): Record<string, unknown> {
    const raw = (item as { raw_item?: unknown })?.raw_item || item
    const callId = String(this.rawField(raw, "call_id") || this.rawField(raw, "id") || "")

    return {
      call_id: callId,
      tool_name: String(this.rawField(raw, "name") || this.rawField(raw, "type") || "tool"),
      output: (item as { output?: unknown })?.output || this.rawField(raw, "output"),
    }
  }

  private sdkMessageText(item: unknown): string {
    const raw = (item as { raw_item?: unknown })?.raw_item || item
    return this.messageContentText(this.rawField(raw, "content", []))
  }

  private messageContentText(content: unknown): string {
    const parts: string[] = []
    const contentItems = Array.isArray(content) ? content : [content]
    
    for (const part of contentItems) {
      if (typeof part === "string") {
        parts.push(part)
        continue
      }
      
      const text = this.rawField(part, "text")
      if (typeof text === "string") {
        parts.push(text)
      }
    }
    
    return parts.join("")
  }

  private rawField(raw: unknown, key: string, defaultValue: unknown = null): unknown {
    if (typeof raw === "object" && raw !== null) {
      return (raw as Record<string, unknown>)[key] ?? defaultValue
    }
    return defaultValue
  }

  private parseJsonObject(value: unknown): Record<string, unknown> {
    const parsed = this.parseJsonValue(value)
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {}
  }

  private parseJsonValue(value: unknown): unknown {
    if (typeof value !== "string") return value
    
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  private toolStatusFromResult(result: unknown): string {
    if (typeof result === "object" && result !== null && (result as { success?: boolean }).success === false) {
      return "failed"
    }
    return "completed"
  }
}
