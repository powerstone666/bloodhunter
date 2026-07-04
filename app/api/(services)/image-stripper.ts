import { log } from "./logger"

export interface SessionItem {
  role?: string
  content?: unknown
  type?: string
  [key: string]: unknown
}

export interface ContentPart {
  type?: string
  text?: string
  image_url?: unknown
  [key: string]: unknown
}

export interface ImageStripResult {
  stripped: boolean
  itemCount: number
  imageCount: number
}

export class ImageStripper {
  private maxAttempts = 3
  private attempts = 0

  hasAttempts(): boolean {
    return this.attempts < this.maxAttempts
  }

  getAttempts(): number {
    return this.attempts
  }

  reset(): void {
    this.attempts = 0
  }

  shouldStripImages(error: unknown): boolean {
    if (!this.hasAttempts()) return false
    
    const statusCode = this.extractStatusCode(error)
    return statusCode !== null && [400, 404, 422].includes(statusCode)
  }

  stripImagesFromSession(session: SessionItem[]): ImageStripResult {
    let itemCount = 0
    let imageCount = 0

    for (const item of session) {
      if (!item.content) continue
      
      itemCount++
      
      if (Array.isArray(item.content)) {
        const stripped = this.stripImagesFromContentArray(item.content)
        imageCount += stripped.imageCount
        item.content = stripped.content
      } else if (typeof item.content === "object" && item.content !== null) {
        const stripped = this.stripImagesFromContentObject(item.content as Record<string, unknown>)
        imageCount += stripped.imageCount
        item.content = stripped.content
      }
    }

    if (imageCount > 0) {
      this.attempts++
      log.info("IMAGE_STRIP", "Stripped images from session", {
        itemCount,
        imageCount,
        attempt: this.attempts,
        maxAttempts: this.maxAttempts,
      })
    }

    return {
      stripped: imageCount > 0,
      itemCount,
      imageCount,
    }
  }

  private stripImagesFromContentArray(content: unknown[]): { content: unknown[]; imageCount: number } {
    let imageCount = 0
    const stripped: unknown[] = []

    for (const part of content) {
      if (this.isImagePart(part)) {
        imageCount++
        stripped.push({
          type: "text",
          text: "[image removed due to API rejection]",
        })
      } else {
        stripped.push(part)
      }
    }

    return { content: stripped, imageCount }
  }

  private stripImagesFromContentObject(content: Record<string, unknown>): { content: Record<string, unknown>; imageCount: number } {
    let imageCount = 0
    const stripped = { ...content }

    if (this.isImagePart(content)) {
      imageCount++
      return {
        content: {
          type: "text",
          text: "[image removed due to API rejection]",
        },
        imageCount,
      }
    }

    if (Array.isArray(content.content)) {
      const result = this.stripImagesFromContentArray(content.content)
      stripped.content = result.content
      imageCount = result.imageCount
    }

    return { content: stripped, imageCount }
  }

  private isImagePart(part: unknown): boolean {
    if (typeof part !== "object" || part === null) return false
    
    const obj = part as Record<string, unknown>
    const type = obj.type as string | undefined

    if (type === "image" || type === "image_url") return true
    if (obj.image_url !== undefined) return true
    if (obj.image !== undefined) return true

    return false
  }

  private extractStatusCode(error: unknown): number | null {
    if (typeof error !== "object" || error === null) return null
    
    const err = error as Record<string, unknown>
    
    if (typeof err.status === "number") return err.status
    if (typeof err.statusCode === "number") return err.statusCode
    
    if (typeof err.response === "object" && err.response !== null) {
      const response = err.response as Record<string, unknown>
      if (typeof response.status === "number") return response.status
      if (typeof response.statusCode === "number") return response.statusCode
    }

    const message = String(err.message || "")
    const match = message.match(/\b(400|404|422)\b/)
    if (match) {
      return parseInt(match[1], 10)
    }

    return null
  }
}

export function createImageStripper(): ImageStripper {
  return new ImageStripper()
}
