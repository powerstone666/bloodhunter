"use client"

import { useEffect, useState } from "react"
import { Card } from "@/app/(ui)/components/card"
import { Badge } from "@/app/(ui)/components/badge"
import { ArrowRight, Activity } from "lucide-react"
import Link from "next/link"
import type { Scan } from "@/app/(common-lib)/schemas"
import { DashboardClient } from "./dashboard-client"
import { fetchScans as fetchScansApi } from "@/app/(ui)/lib/api-client"

export default function DashboardPage() {
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

  const recentScans = scans.slice(0, 3)

  if (loading) {
    return (
      <div className="space-y-8">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-normal tracking-tight text-on-surface">Dashboard</h1>
            <p className="mt-2 text-base text-on-surface-variant">Monitor security scans and findings</p>
          </div>
        </header>
        <div className="flex items-center justify-center py-16">
          <p className="text-base text-on-surface-variant">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-on-surface">Dashboard</h1>
          <p className="mt-2 text-base text-on-surface-variant">Monitor security scans and findings</p>
        </div>
        <DashboardClient />
      </header>

      <section className="grid gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-normal text-on-surface">Recent scans</h2>
            <Link
              href="/scans"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:text-on-primary-container cursor-pointer"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {recentScans.length > 0 ? (
            <div className="space-y-2">
              {recentScans.map((scan) => (
                <Link
                  key={scan.id}
                  href={`/scans/${scan.id}`}
                  className="block rounded-2xl bg-surface-container p-4 transition-colors hover:bg-surface-variant cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-container">
                        <Activity className="h-6 w-6 text-on-secondary-container" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-on-surface">
                          {scan.config.targetUrl}
                        </p>
                        <p className="text-sm text-on-surface-variant">
                          {scan.config.scopeMode} · {scan.config.aggressiveness}
                        </p>
                      </div>
                    </div>
                    <Badge variant={getScanBadgeVariant(scan.status)}>
                      {scan.status}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-on-surface-variant">
                    {new Date(scan.createdAt).toISOString().split('T')[0]} at{" "}
                    {new Date(scan.createdAt).toISOString().split('T')[1].substring(0, 5)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-base text-on-surface-variant">No scans yet</p>
              <DashboardClient showCreateLink />
            </Card>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-surface-container p-6">
        <h2 className="text-xl font-normal text-on-surface">How it works</h2>
        <ol className="mt-6 space-y-6">
          <li className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-medium text-on-primary">
              1
            </span>
            <div>
              <p className="text-base font-medium text-on-surface">Configure a target</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Set the URL, scope, and aggressiveness level for your scan
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-medium text-on-primary">
              2
            </span>
            <div>
              <p className="text-base font-medium text-on-surface">Watch agents hunt</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Autonomous agents explore the target, discover endpoints, and test for vulnerabilities
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-medium text-on-primary">
              3
            </span>
            <div>
              <p className="text-base font-medium text-on-surface">Review and export</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Review findings, mark false positives, and export reports
              </p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  )
}

function getScanBadgeVariant(status: string): "default" | "primary" | "secondary" | "error" {
  switch (status) {
    case "running":
      return "primary"
    case "completed":
      return "secondary"
    case "failed":
      return "error"
    default:
      return "default"
  }
}
