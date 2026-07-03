"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/(ui)/components/tabs"
import { Activity, CheckCircle2, XCircle, Pause } from "lucide-react"
import { ScansClient } from "./scans-client"
import { ScanList } from "./scan-list"
import type { Scan } from "@/app/(common-lib)/schemas"
import { fetchScans as fetchScansApi } from "@/app/(ui)/lib/api-client"

export default function ScansPage() {
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchScansApi()
        setScans(data)
      } catch (error) {
        console.error("Failed to fetch scans:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const activeScans = scans.filter((s) => s.status === "running" || s.status === "queued")
  const pausedScans = scans.filter((s) => s.status === "paused")
  const completedScans = scans.filter((s) => s.status === "completed")
  const failedScans = scans.filter((s) => s.status === "failed" || s.status === "cancelled")

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-base text-on-surface-variant">Loading scans...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-on-surface">Scans</h1>
          <p className="mt-2 text-base text-on-surface-variant">
            Manage and monitor security scans
          </p>
        </div>
        <ScansClient />
      </header>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active
            {activeScans.length > 0 && (
              <span className="ml-2 rounded-full bg-primary-container px-2 py-0.5 text-xs font-medium text-on-primary-container">
                {activeScans.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="paused">
            Paused
            {pausedScans.length > 0 && (
              <span className="ml-2 rounded-full bg-surface-variant px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                {pausedScans.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            {completedScans.length > 0 && (
              <span className="ml-2 rounded-full bg-surface-variant px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                {completedScans.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed
            {failedScans.length > 0 && (
              <span className="ml-2 rounded-full bg-surface-variant px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                {failedScans.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <ScanList scans={activeScans} emptyIcon={Activity} emptyMessage="No active scans" />
        </TabsContent>

        <TabsContent value="paused">
          <ScanList scans={pausedScans} emptyIcon={Pause} emptyMessage="No paused scans" />
        </TabsContent>

        <TabsContent value="completed">
          <ScanList scans={completedScans} emptyIcon={CheckCircle2} emptyMessage="No completed scans" />
        </TabsContent>

        <TabsContent value="failed">
          <ScanList scans={failedScans} emptyIcon={XCircle} emptyMessage="No failed scans" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

