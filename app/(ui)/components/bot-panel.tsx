"use client"

import { useState } from "react"
import { Button } from "@/app/(ui)/components/button"
import { Bot, X, Copy, Send, Loader2 } from "lucide-react"

interface BotPanelProps {
  scanId: string
  vulnerability?: {
    id: string
    title: string
    severity: string
    endpoint: string
    description: string
    evidence: string
    remediation?: string
  }
  onClose: () => void
}

type BotAction = "explain" | "remediation" | "summarize" | "simplify"

export function BotPanel({ scanId, vulnerability, onClose }: BotPanelProps) {
  const [input, setInput] = useState("")
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAction = async (selectedAction: BotAction) => {
    setLoading(true)
    setResponse("")

    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanId,
          vulnerabilityId: vulnerability?.id,
          action: selectedAction,
          customInput: input || undefined,
        }),
      })

      const data = await res.json()
      setResponse(data.response || data.error || "No response")
    } catch {
      setResponse("Failed to get response")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(response)
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col border-l border-outline/20 bg-surface-container shadow-xl">
      <div className="flex items-center justify-between border-b border-outline/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-medium text-on-surface">Security Assistant</h2>
        </div>
        <button onClick={onClose} className="cursor-pointer text-on-surface-variant hover:text-on-surface">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {vulnerability && (
          <div className="rounded-xl bg-surface-container-high p-3">
            <p className="text-xs text-on-surface-variant">Current Context</p>
            <p className="text-sm font-medium text-on-surface">{vulnerability.title}</p>
            <p className="text-xs text-on-surface-variant">{vulnerability.endpoint}</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-on-surface-variant">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {vulnerability && (
              <>
                <button
                  onClick={() => handleAction("explain")}
                  disabled={loading}
                  className="cursor-pointer rounded-xl border border-outline/20 px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container-high"
                >
                  Explain Finding
                </button>
                <button
                  onClick={() => handleAction("remediation")}
                  disabled={loading}
                  className="cursor-pointer rounded-xl border border-outline/20 px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container-high"
                >
                  Rewrite Remediation
                </button>
                <button
                  onClick={() => handleAction("simplify")}
                  disabled={loading}
                  className="cursor-pointer rounded-xl border border-outline/20 px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container-high"
                >
                  Simplify for Client
                </button>
              </>
            )}
            <button
              onClick={() => handleAction("summarize")}
              disabled={loading}
              className="cursor-pointer rounded-xl border border-outline/20 px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container-high"
            >
              Summarize Scan
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-on-surface-variant mb-2">Custom Question</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about this scan..."
            rows={3}
            className="w-full rounded-xl border border-outline/20 bg-surface-container-high px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button
            variant="filled"
            size="sm"
            onClick={() => handleAction("explain")}
            disabled={loading || !input.trim()}
            className="mt-2 cursor-pointer w-full"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Ask
          </Button>
        </div>

        {response && (
          <div className="rounded-xl bg-surface-container-high p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-on-surface-variant">Response</p>
              <button onClick={handleCopy} className="cursor-pointer text-on-surface-variant hover:text-on-surface">
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-on-surface whitespace-pre-wrap">{response}</p>
          </div>
        )}
      </div>
    </div>
  )
}
