import { Button } from "@/app/(ui)/components/button"
import { FileText, Download } from "lucide-react"
import Link from "next/link"
import { getAllScans } from "@/app/api/(db)/scans-repository"
import { getVulnerabilitiesByScanId } from "@/app/api/(db)/vulnerabilities-repository"
import { getEndpointsByScanId } from "@/app/api/(db)/endpoints-repository"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { redirect } from "next/navigation"

export default async function ReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const scans = getAllScans(session.user.id)
  const completedScans = scans.filter(s => s.status === "completed" || s.status === "failed")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-normal tracking-tight text-on-surface">Reports</h1>
        <p className="mt-2 text-base text-on-surface-variant">
          Scan reports and exports
        </p>
      </div>

      {completedScans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-container py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary-container">
            <FileText className="h-8 w-8 text-on-secondary-container" />
          </div>
          <h2 className="mt-4 text-xl font-normal text-on-surface">No Reports Yet</h2>
          <p className="mt-2 max-w-sm text-center text-sm text-on-surface-variant">
            Reports are generated after scans complete. Run a scan and review findings to create a report.
          </p>
          <Link href="/scans" className="mt-6 cursor-pointer">
            <Button variant="outlined">
              View Scans
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {completedScans.map((scan) => {
            const vulns = getVulnerabilitiesByScanId(scan.id)
            const endpoints = getEndpointsByScanId(scan.id)
            const critical = vulns.filter(v => v.severity === "critical").length
            const high = vulns.filter(v => v.severity === "high").length
            const medium = vulns.filter(v => v.severity === "medium").length
            const low = vulns.filter(v => v.severity === "low").length
            const info = vulns.filter(v => v.severity === "info").length

            return (
              <div key={scan.id} className="rounded-2xl bg-surface-container p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/scans/${scan.id}`} className="cursor-pointer">
                      <h3 className="text-lg font-medium text-on-surface hover:underline">
                        {scan.config.targetUrl}
                      </h3>
                    </Link>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {new Date(scan.createdAt).toLocaleDateString()} • {vulns.length} findings • {endpoints.length} endpoints
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/api/scans/${scan.id}/export?format=markdown`} className="cursor-pointer">
                      <Button variant="outlined" size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        Markdown
                      </Button>
                    </Link>
                    <Link href={`/api/scans/${scan.id}/export?format=json`} className="cursor-pointer">
                      <Button variant="outlined" size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        JSON
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="mt-4 flex gap-4">
                  {critical > 0 && (
                    <span className="inline-flex items-center rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400">
                      {critical} Critical
                    </span>
                  )}
                  {high > 0 && (
                    <span className="inline-flex items-center rounded-md bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-400">
                      {high} High
                    </span>
                  )}
                  {medium > 0 && (
                    <span className="inline-flex items-center rounded-md bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-400">
                      {medium} Medium
                    </span>
                  )}
                  {low > 0 && (
                    <span className="inline-flex items-center rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400">
                      {low} Low
                    </span>
                  )}
                  {info > 0 && (
                    <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400">
                      {info} Info
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
