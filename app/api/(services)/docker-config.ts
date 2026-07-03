export const DEFAULT_DOCKER_IMAGE = "ghcr.io/usestrix/strix-sandbox:1.0.0"

export function getSandboxImage(): string {
  return process.env.DOCKER_IMAGE?.trim() || DEFAULT_DOCKER_IMAGE
}
