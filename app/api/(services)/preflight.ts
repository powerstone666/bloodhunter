import { log } from "./logger"
import { checkDockerRunning, checkImagePresent, pullDockerImage } from "./docker-manager"
import { getSandboxImage } from "./docker-config"
import type { BaseChatModel } from "@langchain/core/language_models/chat_models"

export interface PreflightResult {
  success: boolean
  errors: PreflightError[]
  warnings: PreflightWarning[]
  dockerReady: boolean
  imageReady: boolean
  apiValid: boolean
}

export interface PreflightError {
  code: string
  message: string
  details?: string
  action?: string
}

export interface PreflightWarning {
  code: string
  message: string
  details?: string
}

export interface PreflightCallbacks {
  onProgress?: (stage: string, message: string) => void
  onDockerPull?: (progress: string) => void
}

const DOCKER_IMAGE = getSandboxImage()

export async function runPreflightChecks(
  model: BaseChatModel,
  providerName: string,
  callbacks?: PreflightCallbacks
): Promise<PreflightResult> {
  const errors: PreflightError[] = []
  const warnings: PreflightWarning[] = []
  let dockerReady = false
  let imageReady = false
  let apiValid = false

  // ─── API KEY VALIDATION ─────────────────────────────────────
  log.info("PREFLIGHT", "Validating API key...")
  callbacks?.onProgress?.("api", "Validating API key...")

  try {
    // Make a minimal test call to validate the API key
    const testResult = await model.invoke([
      { role: "user", content: "Hi" }
    ])
    
    if (testResult) {
      apiValid = true
      log.success("PREFLIGHT", "API key validated", { provider: providerName })
      callbacks?.onProgress?.("api", "API key validated")
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    log.error("PREFLIGHT", "API key validation failed", undefined, { error: errMsg })
    
    // Parse common API errors and provide helpful messages
    if (errMsg.includes("401") || errMsg.includes("Incorrect API key")) {
      errors.push({
        code: "API_KEY_INVALID",
        message: "Invalid API key",
        details: `The API key for ${providerName} is incorrect or expired.`,
        action: "Go to Settings → Providers and update your API key.",
      })
    } else if (errMsg.includes("403") || errMsg.includes("Forbidden")) {
      errors.push({
        code: "API_KEY_FORBIDDEN",
        message: "API key lacks permissions",
        details: `The API key for ${providerName} doesn't have permission to use this model.`,
        action: "Check your API key permissions in the provider dashboard.",
      })
    } else if (errMsg.includes("429") || errMsg.includes("Rate limit")) {
      errors.push({
        code: "API_RATE_LIMITED",
        message: "API rate limit exceeded",
        details: `You've hit the rate limit for ${providerName}.`,
        action: "Wait a few minutes and try again, or upgrade your plan.",
      })
    } else if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT")) {
      errors.push({
        code: "API_TIMEOUT",
        message: "API connection timeout",
        details: `Could not connect to ${providerName} API.`,
        action: "Check your internet connection and try again.",
      })
    } else {
      errors.push({
        code: "API_ERROR",
        message: "API connection failed",
        details: errMsg,
        action: "Check your provider configuration and try again.",
      })
    }
    
    return { success: false, errors, warnings, dockerReady, imageReady, apiValid }
  }

  // ─── DOCKER VALIDATION ──────────────────────────────────────
  log.info("PREFLIGHT", "Checking Docker status...")
  callbacks?.onProgress?.("docker", "Checking Docker daemon...")

  const dockerRunning = await checkDockerRunning()
  
  if (!dockerRunning) {
    errors.push({
      code: "DOCKER_NOT_RUNNING",
      message: "Docker daemon is not running",
      details: "Docker sandbox is required before security tools can execute.",
      action: "Start Docker Desktop or the Docker daemon, then retry the scan.",
    })
    log.error("PREFLIGHT", "Docker not running — blocking scan")
    callbacks?.onProgress?.("docker", "Docker not available — scan blocked")
  } else {
    dockerReady = true
    log.success("PREFLIGHT", "Docker daemon is running")
    callbacks?.onProgress?.("docker", "Docker daemon is running")

    // ─── DOCKER IMAGE CHECK ─────────────────────────────────────
    log.info("PREFLIGHT", "Checking Docker image...", { image: DOCKER_IMAGE })
    callbacks?.onProgress?.("image", "Checking sandbox image...")

    try {
      const imagePresent = await checkImagePresent(DOCKER_IMAGE)

      if (imagePresent) {
        imageReady = true
        log.success("PREFLIGHT", "Docker image found", { image: DOCKER_IMAGE })
        callbacks?.onProgress?.("image", "Sandbox image ready")
      } else {
        log.info("PREFLIGHT", "Docker image not found — pulling...", { image: DOCKER_IMAGE })
        callbacks?.onProgress?.("image", "Pulling sandbox image (this may take a few minutes)...")

        const pullResult = await pullDockerImage(DOCKER_IMAGE, (progress) => {
          callbacks?.onDockerPull?.(progress)
          log.debug("PREFLIGHT", "Docker pull progress", { progress: progress.substring(0, 100) })
        })

        if (pullResult.success) {
          imageReady = true
          log.success("PREFLIGHT", "Docker image pulled successfully", { image: DOCKER_IMAGE })
          callbacks?.onProgress?.("image", "Sandbox image pulled successfully")
        } else {
          errors.push({
            code: "DOCKER_IMAGE_PULL_FAILED",
            message: "Failed to pull Docker image",
            details: pullResult.error || "Unknown error",
            action: "Pull the sandbox image manually or check Docker registry/network access, then retry.",
          })
          log.error("PREFLIGHT", "Docker image pull failed — blocking scan", undefined, { error: pullResult.error })
          callbacks?.onProgress?.("image", "Image pull failed — scan blocked")
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      errors.push({
        code: "DOCKER_IMAGE_ERROR",
        message: "Docker image check failed",
        details: errMsg,
        action: "Fix Docker image access and retry the scan.",
      })
      log.error("PREFLIGHT", "Docker image check failed — blocking scan", undefined, { error: errMsg })
      callbacks?.onProgress?.("image", "Image check failed — scan blocked")
    }
  }

  const success = errors.length === 0 && apiValid && dockerReady && imageReady
  return { success, errors, warnings, dockerReady, imageReady, apiValid }
}

export function formatPreflightErrors(errors: PreflightError[]): string {
  if (errors.length === 0) return ""
  
  const lines = errors.map(err => {
    let line = `❌ ${err.message}`
    if (err.details) line += `\n   ${err.details}`
    if (err.action) line += `\n   → ${err.action}`
    return line
  })
  
  return lines.join("\n\n")
}

export function formatPreflightWarnings(warnings: PreflightWarning[]): string {
  if (warnings.length === 0) return ""
  
  const lines = warnings.map(warn => {
    let line = `⚠️  ${warn.message}`
    if (warn.details) line += `\n   ${warn.details}`
    return line
  })
  
  return lines.join("\n\n")
}
