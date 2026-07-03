import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { redirect } from "next/navigation"
import { getAllScans } from "@/app/api/(db)/scans-repository"
import { getVulnerabilitiesByScanId } from "@/app/api/(db)/vulnerabilities-repository"
import { getFeedbackByUser } from "@/app/api/(db)/feedback-repository"
import { getUserPreferences } from "@/app/api/(db)/feedback-repository"
import { Activity, Shield, AlertTriangle, CheckCircle, Target } from "lucide-react"
import Link from "next/link"

export default async function MemoryPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const scans = getAllScans(session.user.id)
  const feedback = getFeedbackByUser(session.user.id)
  const preferences = getUserPreferences(session.user.id)

  // Aggregate stats
  const completedScans = scans.filter(s => s.status === "completed")
  const failedScans = scans.filter(s => s.status === "failed")
  const runningScans = scans.filter(s => s.status === "running")

  let totalVulns = 0
  let criticalVulns = 0
  let highVulns = 0
  let mediumVulns = 0
  let lowVulns = 0

  const vulnCategories: Record<string, number> = {}

  for (const scan of completedScans) {
    const vulns = getVulnerabilitiesByScanId(scan.id)
    totalVulns += vulns.length
    for (const v of vulns) {
      if (v.severity === "critical") criticalVulns++
      if (v.severity === "high") highVulns++
      if (v.severity === "medium") mediumVulns++
      if (v.severity === "low") lowVulns++
      vulnCategories[v.title] = (vulnCategories[v.title] || 0) + 1
    }
  }

  // Top vulnerability patterns
  const topPatterns = Object.entries(vulnCategories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  // Feedback stats
  const falsePositives = feedback.filter(f => f.action === "mark_false_positive").length
  const accepted = feedback.filter(f => f.action === "accept_vulnerability").length
  const deeperScans = feedback.filter(f => f.action === "request_deeper_scan").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-normal tracking-tight text-on-surface">Memory</h1>
        <p className="mt-2 text-base text-on-surface-variant">
          Scan history, feedback learning, and behavioral adaptation
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-surface-container p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container">
              <Activity className="h-5 w-5 text-on-primary-container" />
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Total Scans</p>
              <p className="text-2xl font-semibold text-on-surface">{scans.length}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 text-xs">
            <span className="text-success">{completedScans.length} completed</span>
            <span className="text-error">{failedScans.length} failed</span>
            {runningScans.length > 0 && <span className="text-primary">{runningScans.length} running</span>}
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-error-container">
              <AlertTriangle className="h-5 w-5 text-on-error-container" />
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Vulnerabilities Found</p>
              <p className="text-2xl font-semibold text-on-surface">{totalVulns}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 text-xs flex-wrap">
            {criticalVulns > 0 && <span className="text-red-500">{criticalVulns} critical</span>}
            {highVulns > 0 && <span className="text-orange-500">{highVulns} high</span>}
            {mediumVulns > 0 && <span className="text-yellow-500">{mediumVulns} medium</span>}
            {lowVulns > 0 && <span className="text-green-500">{lowVulns} low</span>}
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-container">
              <CheckCircle className="h-5 w-5 text-on-secondary-container" />
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Feedback Given</p>
              <p className="text-2xl font-semibold text-on-surface">{feedback.length}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 text-xs">
            <span>{falsePositives} false positives</span>
            <span>{accepted} accepted</span>
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tertiary-container">
              <Target className="h-5 w-5 text-on-tertiary-container" />
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Targets Scanned</p>
              <p className="text-2xl font-semibold text-on-surface">{new Set(scans.map(s => s.config.targetUrl)).size}</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-on-surface-variant">
            {deeperScans > 0 && <span>{deeperScans} deeper scan requests</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scan History */}
        <section className="rounded-2xl bg-surface-container p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-normal text-on-surface">Scan History</h2>
            <Link href="/scans" className="text-sm text-primary hover:underline cursor-pointer">View all</Link>
          </div>
          {scans.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No scans yet. Create your first scan to start building memory.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {scans.slice(0, 10).map((scan) => (
                <Link key={scan.id} href={`/scans/${scan.id}`} className="block rounded-xl bg-surface-container-high p-4 hover:bg-surface-container-highest transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-on-surface truncate">{scan.config.targetUrl}</p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {scan.config.scopeMode} · {scan.config.aggressiveness} · {new Date(scan.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`ml-3 shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      scan.status === "completed" ? "bg-success/10 text-success" :
                      scan.status === "failed" ? "bg-error/10 text-error" :
                      scan.status === "running" ? "bg-primary/10 text-primary" :
                      "bg-surface-variant text-on-surface-variant"
                    }`}>
                      {scan.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Vulnerability Patterns */}
        <section className="rounded-2xl bg-surface-container p-6">
          <h2 className="text-xl font-normal text-on-surface mb-4">Common Vulnerability Patterns</h2>
          {topPatterns.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No vulnerability patterns yet. Complete scans to see recurring issues.</p>
          ) : (
            <div className="space-y-3">
              {topPatterns.map(([title, count]) => (
                <div key={title} className="flex items-center justify-between rounded-xl bg-surface-container-high p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-error-container shrink-0">
                      <Shield className="h-4 w-4 text-on-error-container" />
                    </div>
                    <p className="text-sm text-on-surface truncate">{title}</p>
                  </div>
                  <span className="ml-3 shrink-0 text-sm font-medium text-on-surface-variant">{count}x</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* User Preferences */}
      {preferences && (
        <section className="rounded-2xl bg-surface-container p-6">
          <h2 className="text-xl font-normal text-on-surface mb-4">Learned Preferences</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {preferences.preferredScope && (
              <div className="rounded-xl bg-surface-container-high p-4">
                <p className="text-xs text-on-surface-variant">Preferred Scope</p>
                <p className="text-sm font-medium text-on-surface mt-1">{preferences.preferredScope}</p>
              </div>
            )}
            {preferences.preferredAggressiveness && (
              <div className="rounded-xl bg-surface-container-high p-4">
                <p className="text-xs text-on-surface-variant">Preferred Aggressiveness</p>
                <p className="text-sm font-medium text-on-surface mt-1">{preferences.preferredAggressiveness}</p>
              </div>
            )}
            {preferences.ignoredCategories && preferences.ignoredCategories.length > 0 && (
              <div className="rounded-xl bg-surface-container-high p-4">
                <p className="text-xs text-on-surface-variant">Ignored Categories</p>
                <div className="mt-1 flex gap-1 flex-wrap">
                  {preferences.ignoredCategories.map((cat) => (
                    <span key={cat} className="inline-flex items-center rounded-md bg-surface-variant px-2 py-0.5 text-xs text-on-surface-variant">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Feedback History */}
      {feedback.length > 0 && (
        <section className="rounded-2xl bg-surface-container p-6">
          <h2 className="text-xl font-normal text-on-surface mb-4">Feedback History</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {feedback.slice(0, 20).map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-xl bg-surface-container-high p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    f.action === "mark_false_positive" ? "bg-surface-variant text-on-surface-variant" :
                    f.action === "accept_vulnerability" ? "bg-success/10 text-success" :
                    f.action === "request_deeper_scan" ? "bg-primary/10 text-primary" :
                    "bg-tertiary-container text-on-tertiary-container"
                  }`}>
                    {f.action.replace(/_/g, " ")}
                  </span>
                  {f.category && <span className="text-xs text-on-surface-variant truncate">{f.category}</span>}
                </div>
                <span className="text-xs text-on-surface-variant shrink-0 ml-3">
                  {new Date(f.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
