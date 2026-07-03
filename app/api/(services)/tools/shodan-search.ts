import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
  fetchFn?: typeof fetch
}

export function createShodanTool(ctx: ToolContext) {
  const fetchFn = ctx.fetchFn || fetch
  const apiKey = process.env.SHODAN_API_KEY

  return tool(
    async (input) => {
      if (!apiKey) {
        return { success: false, error: "SHODAN_API_KEY not configured" }
      }

      ctx.emitEvent({
        type: "tool.called",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        toolName: "shodan",
        summary: `Shodan ${input.action}: ${input.query || input.ip || input.hostname}`,
        timestamp: new Date().toISOString(),
      })

      try {
        let url = ""
        
        if (input.action === "search") {
          url = `https://api.shodan.io/shodan/host/search?key=${apiKey}&query=${encodeURIComponent(input.query)}`
        } else if (input.action === "host") {
          if (!input.ip) {
            return { success: false, error: "IP address required for host lookup" }
          }
          url = `https://api.shodan.io/shodan/host/${input.ip}?key=${apiKey}`
        } else if (input.action === "dns_resolve") {
          if (!input.hostname) {
            return { success: false, error: "Hostname required for DNS resolve" }
          }
          url = `https://api.shodan.io/dns/resolve?hostnames=${input.hostname}&key=${apiKey}`
        } else if (input.action === "dns_reverse") {
          if (!input.ip) {
            return { success: false, error: "IP address required for reverse DNS" }
          }
          url = `https://api.shodan.io/dns/reverse?ips=${input.ip}&key=${apiKey}`
        }

        const response = await fetchFn(url, {
          signal: AbortSignal.timeout(30000),
        })

        if (!response.ok) {
          const error = await response.text()
          return { success: false, error: `Shodan API error: ${response.status} - ${error}` }
        }

        const data = await response.json()

        if (input.action === "search") {
          return {
            success: true,
            action: "search",
            query: input.query,
            total: data.total,
            matches: data.matches.slice(0, 10).map((m: { ip_str: string; port: number; transport: string; product?: string; version?: string; vulns?: string[]; hostnames?: string[]; data?: string; timestamp: string }) => ({
              ip: m.ip_str,
              port: m.port,
              protocol: m.transport,
              product: m.product || null,
              version: m.version || null,
              vulns: m.vulns || [],
              hostnames: m.hostnames || [],
              data: m.data?.substring(0, 500) || "",
              timestamp: m.timestamp,
            })),
          }
        } else if (input.action === "host") {
          return {
            success: true,
            action: "host",
            ip: input.ip,
            os: data.os || null,
            ports: data.ports || [],
            vulns: data.vulns || [],
            hostnames: data.hostnames || [],
            data: data.data?.slice(0, 10).map((d: { port: number; product?: string; version?: string; vulns?: string[]; data?: string }) => ({
              port: d.port,
              product: d.product || null,
              version: d.version || null,
              vulns: d.vulns || [],
              data: d.data?.substring(0, 500) || "",
            })) || [],
          }
        } else {
          return {
            success: true,
            action: input.action,
            data: data,
          }
        }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Shodan request failed" }
      }
    },
    {
      name: "shodan",
      description: "Search Shodan for exposed services, open ports, and vulnerabilities on target hosts. Use for reconnaissance to discover attack surface, exposed databases, admin panels, and known vulnerabilities.",
      schema: z.object({
        query: z.string().describe("Shodan search query (e.g., 'hostname:example.com', 'port:3306', 'product:MySQL')"),
        action: z.enum(["search", "host", "dns_resolve", "dns_reverse"]).describe("Action to perform"),
        ip: z.string().optional().describe("IP address for host lookup (required for 'host' action)"),
        hostname: z.string().optional().describe("Hostname for DNS lookup (required for 'dns_resolve' action)"),
      }),
    }
  )
}
