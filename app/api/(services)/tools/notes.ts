import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
}

interface Note {
  id: string
  title: string
  content: string
  category: string
  createdAt: string
  updatedAt: string
}

const noteStore = new Map<string, Note[]>()

function getNotes(scanId: string): Note[] {
  if (!noteStore.has(scanId)) noteStore.set(scanId, [])
  return noteStore.get(scanId)!
}

export function createNoteTools(ctx: ToolContext) {
  const createNote = tool(
    async (input) => {
      const notes = getNotes(ctx.scanId)
      const now = new Date().toISOString()
      const note: Note = {
        id: `note-${Date.now()}`,
        title: input.title,
        content: input.content,
        category: input.category,
        createdAt: now,
        updatedAt: now,
      }
      notes.push(note)

      ctx.emitEvent({
        type: "tool.called",
        scanId: ctx.scanId,
        agentId: ctx.agentId,
        toolName: "create_note",
        summary: `Note created: ${input.title}`,
        timestamp: now,
      })

      return { success: true, note }
    },
    {
      name: "create_note",
      description: "Create a persistent note visible to all agents in this scan. Use for documenting findings, observations, credentials, or important information.",
      schema: z.object({
        title: z.string().describe("Short title for the note"),
        content: z.string().describe("Detailed content of the note"),
        category: z.enum(["finding", "observation", "endpoint", "technology", "credential", "architecture", "other"]).describe("Category"),
      }),
    }
  )

  const listNotes = tool(
    async (input) => {
      let notes = getNotes(ctx.scanId)
      if (input.category) {
        notes = notes.filter(n => n.category === input.category)
      }
      return { notes }
    },
    {
      name: "list_notes",
      description: "List all notes for this scan.",
      schema: z.object({
        category: z.string().optional().describe("Filter by category"),
      }),
    }
  )

  const getNote = tool(
    async (input) => {
      const notes = getNotes(ctx.scanId)
      const note = notes.find(n => n.id === input.id)
      return note ? { success: true, note } : { success: false, error: "Note not found" }
    },
    {
      name: "get_note",
      description: "Get a specific note by ID.",
      schema: z.object({
        id: z.string().describe("Note ID"),
      }),
    }
  )

  const updateNote = tool(
    async (input) => {
      const notes = getNotes(ctx.scanId)
      const note = notes.find(n => n.id === input.id)
      if (!note) return { success: false, error: "Note not found" }

      if (input.title) note.title = input.title
      if (input.content) note.content = input.content
      note.updatedAt = new Date().toISOString()

      return { success: true, note }
    },
    {
      name: "update_note",
      description: "Update an existing note.",
      schema: z.object({
        id: z.string().describe("Note ID"),
        title: z.string().optional().describe("New title"),
        content: z.string().optional().describe("New content"),
      }),
    }
  )

  const deleteNote = tool(
    async (input) => {
      const notes = getNotes(ctx.scanId)
      const index = notes.findIndex(n => n.id === input.id)
      if (index >= 0) {
        notes.splice(index, 1)
        return { success: true }
      }
      return { success: false, error: "Note not found" }
    },
    {
      name: "delete_note",
      description: "Delete a note.",
      schema: z.object({
        id: z.string().describe("Note ID to delete"),
      }),
    }
  )

  return { create_note: createNote, list_notes: listNotes, get_note: getNote, update_note: updateNote, delete_note: deleteNote }
}
