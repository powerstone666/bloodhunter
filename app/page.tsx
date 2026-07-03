import Link from "next/link"
import { Button } from "@/app/(ui)/components/button"
import { Badge } from "@/app/(ui)/components/badge"
import {
  Search,
  ArrowRight,
  Terminal,
  Network,
  Shield,
  Brain,
  Zap,
  FileText,
  Activity,
  Sparkles,
} from "lucide-react"
import { ScanPreview, EventLine, CapabilityBlock } from "./landing-components"

export default function LandingPage() {
  return (
    <div className="min-h-full bg-gradient-to-br from-primary-container/30 via-background to-secondary-container/30">
      <nav className="flex items-center justify-between px-6 py-6 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Search className="h-6 w-6 text-on-primary" />
          </div>
          <span className="text-xl font-bold text-on-surface">Bloodhunter</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-base font-medium text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
            Dashboard
          </Link>
          <Link href="/scans" className="cursor-pointer">
            <Button size="md">
              New scan
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </nav>

      <section className="px-6 py-16 lg:px-12 lg:py-24">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-20 items-center">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-container px-4 py-2">
                <Sparkles className="h-5 w-5 text-on-primary-container" />
                <span className="text-sm font-semibold text-on-primary-container">AI-Powered Security</span>
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-on-surface lg:text-6xl">
                Hunt vulnerabilities with autonomous agents
              </h1>
              <p className="text-xl text-on-surface-variant leading-relaxed">
                Bloodhunter deploys AI agents that explore targets, discover endpoints, and test for security flaws in real-time.
              </p>
            </div>

            <div className="flex gap-4">
              <Link href="/scans" className="cursor-pointer">
                <Button size="lg">
                  Start scanning
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/dashboard" className="cursor-pointer">
                <Button variant="outlined" size="lg">
                  View dashboard
                </Button>
              </Link>
            </div>
          </div>

          <ScanPreview />
        </div>
      </section>

      <section className="px-6 py-16 lg:px-12 lg:py-24">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-on-surface">
            What agents do
          </h2>
        </div>

        <div className="rounded-3xl bg-surface-container p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Terminal className="h-5 w-5 text-on-primary" />
            </div>
            <span className="text-lg font-semibold text-on-surface">Agent event stream</span>
          </div>

          <div className="space-y-4 font-mono text-sm">
            <EventLine
              agent="coordinator"
              agentColor="text-primary"
              message="spawned recon-agent for endpoint discovery"
              timestamp="14:02:15"
            />
            <EventLine
              agent="recon-agent"
              agentColor="text-secondary"
              message="GET https://target.com/api/v1/users → 200 OK"
              timestamp="14:02:18"
            />
            <EventLine
              agent="recon-agent"
              agentColor="text-secondary"
              message="discovered 23 endpoints in sitemap"
              timestamp="14:02:22"
            />
            <EventLine
              agent="coordinator"
              agentColor="text-primary"
              message="spawned vuln-hunter-1 for /api/login"
              timestamp="14:02:25"
            />
            <EventLine
              agent="vuln-hunter-1"
              agentColor="text-tertiary"
              message="testing parameter: username"
              timestamp="14:02:28"
            />
            <EventLine
              agent="vuln-hunter-1"
              agentColor="text-tertiary"
              message="POST /api/login {username: ' OR 1=1 --}"
              timestamp="14:02:31"
            />
            <div className="flex items-center gap-3 rounded-2xl bg-error-container p-4 shadow-md">
              <span className="text-sm text-on-error-container">14:02:32</span>
              <span className="text-base font-semibold text-on-error-container">
                finding: SQL injection in /api/login
              </span>
              <Badge variant="error" className="ml-auto">critical</Badge>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 lg:px-12 lg:py-24">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-on-surface">
            Capabilities
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <CapabilityBlock
            icon={Network}
            title="Attack surface mapping"
            description="Agents crawl targets, discover endpoints, map parameters, and identify technologies. Results build a persistent attack surface graph across scans."
            color="primary"
          />
          <CapabilityBlock
            icon={Shield}
            title="Vulnerability hunting"
            description="Autonomous agents test for injection flaws, authentication bypasses, misconfigurations, and logic errors. Findings include evidence and remediation guidance."
            color="secondary"
          />
          <CapabilityBlock
            icon={Brain}
            title="Memory and learning"
            description="Agents remember findings across scans. Mark false positives, accept vulnerabilities, and agents adapt their approach based on your feedback."
            color="tertiary"
          />
        </div>

        <div className="grid gap-8 md:grid-cols-3 mt-8">
          <CapabilityBlock
            icon={Zap}
            title="Custom skills"
            description="Upload SKILL.md files to guide agent behavior. Skills provide domain-specific knowledge, testing methodologies, and custom tool instructions."
            color="primary"
          />
          <CapabilityBlock
            icon={FileText}
            title="Report generation"
            description="Export findings as Markdown, JSON, or PDF. Reports include severity breakdown, evidence, remediation steps, and executive summaries."
            color="secondary"
          />
          <CapabilityBlock
            icon={Activity}
            title="Real-time monitoring"
            description="Watch agents work in real-time. See endpoint discovery, tool calls, and vulnerability testing as it happens. Pause, resume, or cancel scans."
            color="tertiary"
          />
        </div>
      </section>

      <section className="border-t border-outline-variant px-6 py-16 lg:px-12">
        <div className="rounded-2xl bg-surface-container p-8 lg:p-12">
          <div className="space-y-6">
            <h2 className="text-2xl font-normal text-on-surface">
              Ready to hunt?
            </h2>
            <p className="text-base text-on-surface-variant max-w-xl">
              Configure a target, set scope and aggressiveness, and let autonomous agents find vulnerabilities in your applications.
            </p>
            <div className="flex gap-3">
              <Link href="/scans" className="cursor-pointer">
                <Button size="lg">
                  Create scan
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/dashboard" className="cursor-pointer">
                <Button variant="outlined" size="lg">
                  Open dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-outline-variant px-6 py-8 lg:px-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Search className="h-4 w-4 text-on-primary" />
            </div>
            <span className="text-sm text-on-surface-variant">Bloodhunter v0.1.0</span>
          </div>
          <p className="text-xs text-on-surface-variant">
            AI-powered security scanner
          </p>
        </div>
      </footer>
    </div>
  )
}

