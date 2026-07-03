import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { deleteSkill, getSkill } from "@/app/api/(db)/skills-repository"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const skill = getSkill(id)
  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 })
  }

  if (skill.isBuiltin) {
    return NextResponse.json({ error: "Cannot delete built-in skills" }, { status: 403 })
  }

  if (skill.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const success = deleteSkill(id)
  if (!success) {
    return NextResponse.json({ error: "Failed to delete skill" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
