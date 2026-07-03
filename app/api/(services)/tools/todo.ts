import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { ScanEvent } from "@/app/(common-lib)/schemas"

interface ToolContext {
  scanId: string
  agentId: string
  emitEvent: (event: ScanEvent) => void
}

interface Todo {
  id: string
  title: string
  description: string
  status: "pending" | "in_progress" | "done"
  priority: "high" | "medium" | "low"
}

const todoStore = new Map<string, Todo[]>()

function getTodos(scanId: string, agentId: string): Todo[] {
  const key = `${scanId}:${agentId}`
  if (!todoStore.has(key)) todoStore.set(key, [])
  return todoStore.get(key)!
}

export function createTodoTools(ctx: ToolContext) {
  const createTodo = tool(
    async (input) => {
      const todos = getTodos(ctx.scanId, ctx.agentId)
      const todo: Todo = {
        id: `todo-${Date.now()}`,
        title: input.title,
        description: input.description,
        status: "pending",
        priority: input.priority,
      }
      todos.push(todo)
      return { success: true, todo }
    },
    {
      name: "create_todo",
      description: "Create a new task to track during the scan.",
      schema: z.object({
        title: z.string().describe("Short title for the task"),
        description: z.string().describe("Detailed description of what needs to be done"),
        priority: z.enum(["high", "medium", "low"]).describe("Priority level"),
      }),
    }
  )

  const listTodos = tool(
    async () => {
      const todos = getTodos(ctx.scanId, ctx.agentId)
      return { todos }
    },
    {
      name: "list_todos",
      description: "List all tasks for the current agent.",
      schema: z.object({}),
    }
  )

  const updateTodo = tool(
    async (input) => {
      const todos = getTodos(ctx.scanId, ctx.agentId)
      const todo = todos.find(t => t.id === input.id)
      if (todo) {
        todo.status = input.status
        return { success: true, todo }
      }
      return { success: false, error: "Todo not found" }
    },
    {
      name: "update_todo",
      description: "Update a task's status.",
      schema: z.object({
        id: z.string().describe("Task ID"),
        status: z.enum(["pending", "in_progress", "done"]).describe("New status"),
      }),
    }
  )

  const deleteTodo = tool(
    async (input) => {
      const todos = getTodos(ctx.scanId, ctx.agentId)
      const index = todos.findIndex(t => t.id === input.id)
      if (index >= 0) {
        todos.splice(index, 1)
        return { success: true }
      }
      return { success: false, error: "Todo not found" }
    },
    {
      name: "delete_todo",
      description: "Delete a task.",
      schema: z.object({
        id: z.string().describe("Task ID to delete"),
      }),
    }
  )

  return { create_todo: createTodo, list_todos: listTodos, update_todo: updateTodo, delete_todo: deleteTodo }
}
