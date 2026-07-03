import fs from "fs"
import path from "path"

export interface SkillMetadata {
  name: string
  description: string
}

export interface Skill {
  id: string
  category: string
  name: string
  description: string
  content: string
  isInternal: boolean
}

const SKILLS_DIR = path.join(process.cwd(), "app", "api", "(services)", "skills")

const INTERNAL_CATEGORIES = ["scan_modes", "coordination"]

const SKILL_CATEGORIES = [
  "vulnerabilities",
  "tooling",
  "frameworks",
  "scan_modes",
  "coordination",
  "technologies",
  "protocols",
  "cloud",
  "custom",
  "reconnaissance",
]

function parseFrontmatter(content: string): { metadata: SkillMetadata; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) {
    return { metadata: { name: "", description: "" }, body: content }
  }

  const yamlBlock = match[1]
  const body = match[2]

  const nameMatch = yamlBlock.match(/name:\s*(.+)/)
  const descMatch = yamlBlock.match(/description:\s*(.+)/)

  return {
    metadata: {
      name: nameMatch?.[1]?.trim() || "",
      description: descMatch?.[1]?.trim() || "",
    },
    body,
  }
}

function loadSkillFromFile(category: string, filename: string): Skill | null {
  const filePath = path.join(SKILLS_DIR, category, filename)

  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, "utf-8")
  const { metadata, body } = parseFrontmatter(raw)
  const stem = filename.replace(/\.md$/, "")

  return {
    id: `${category}/${stem}`,
    category,
    name: metadata.name || stem,
    description: metadata.description,
    content: body.trim(),
    isInternal: INTERNAL_CATEGORIES.includes(category),
  }
}

export function loadAllSkills(): Skill[] {
  const skills: Skill[] = []

  for (const category of SKILL_CATEGORIES) {
    const categoryDir = path.join(SKILLS_DIR, category)
    if (!fs.existsSync(categoryDir)) continue

    const files = fs.readdirSync(categoryDir).filter(f => f.endsWith(".md"))
    for (const file of files) {
      const skill = loadSkillFromFile(category, file)
      if (skill) skills.push(skill)
    }
  }

  return skills
}

export function loadSkill(id: string): Skill | null {
  if (id.includes("/")) {
    const [category, name] = id.split("/")
    return loadSkillFromFile(category, `${name}.md`)
  }

  for (const category of SKILL_CATEGORIES) {
    const skill = loadSkillFromFile(category, `${id}.md`)
    if (skill) return skill
  }

  return null
}

export function resolveSkills(requested: string[], maxSkills = 5): Skill[] {
  const resolved: Skill[] = []
  const seen = new Set<string>()

  for (const id of requested) {
    if (resolved.length >= maxSkills) break
    const skill = loadSkill(id)
    if (skill && !seen.has(skill.id)) {
      seen.add(skill.id)
      resolved.push(skill)
    }
  }

  return resolved
}

export function getAvailableSkills(): Record<string, string[]> {
  const all = loadAllSkills()
  const grouped: Record<string, string[]> = {}

  for (const skill of all) {
    if (skill.isInternal) continue
    if (!grouped[skill.category]) grouped[skill.category] = []
    grouped[skill.category].push(skill.name)
  }

  return grouped
}

export function getInternalSkills(scanMode: string, isWhitebox: boolean, isRoot: boolean): Skill[] {
  const skills: Skill[] = []

  const modeSkill = loadSkill(`scan_modes/${scanMode}`)
  if (modeSkill) skills.push(modeSkill)

  const browserSkill = loadSkill("tooling/agent_browser")
  if (browserSkill) skills.push(browserSkill)

  const pythonSkill = loadSkill("tooling/python")
  if (pythonSkill) skills.push(pythonSkill)

  const toolInstallSkill = loadSkill("tooling/tool_installation")
  if (toolInstallSkill) skills.push(toolInstallSkill)

  if (isRoot) {
    const rootSkill = loadSkill("coordination/root_agent")
    if (rootSkill) skills.push(rootSkill)
  }

  if (isWhitebox) {
    const whiteboxSkill = loadSkill("coordination/source_aware_whitebox")
    if (whiteboxSkill) skills.push(whiteboxSkill)

    const sastSkill = loadSkill("custom/source_aware_sast")
    if (sastSkill) skills.push(sastSkill)
  }

  return skills
}
