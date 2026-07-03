import { z } from "zod"

export const scanStatusSchema = z.enum([
  "draft",
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
])

export type ScanStatus = z.infer<typeof scanStatusSchema>

export const scanPhaseSchema = z.enum([
  "setup",
  "recon",
  "fingerprint",
  "analysis",
  "verification",
  "report",
])

export type ScanPhase = z.infer<typeof scanPhaseSchema>

export const severitySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
])

export type Severity = z.infer<typeof severitySchema>

export const confidenceSchema = z.enum([
  "confirmed",
  "likely",
  "possible",
])

export type Confidence = z.infer<typeof confidenceSchema>

export const vulnerabilityStatusSchema = z.enum([
  "new",
  "reviewed",
  "accepted",
  "false_positive",
  "fixed",
])

export type VulnerabilityStatus = z.infer<typeof vulnerabilityStatusSchema>
