"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/app/(ui)/components/button"
import { Wrench, Trash2, Eye, FileText, Plus } from "lucide-react"

interface Skill {
  id: string
  name: string
  description: string | null
  content: string
  isBuiltin: boolean
  tags: string | null
  enabled?: boolean
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [previewSkill, setPreviewSkill] = useState<Skill | null>(null)
  const [uploadContent, setUploadContent] = useState("")
  const [uploadName, setUploadName] = useState("")
  const [uploadDesc, setUploadDesc] = useState("")
  const [uploadTags, setUploadTags] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [filter, setFilter] = useState<"all" | "builtin" | "custom">("all")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchSkills = async () => {
    const res = await fetch("/api/skills")
    const data = await res.json()
    setSkills(data.skills || [])
  }

  useEffect(() => {
    const load = async () => {
      await fetchSkills()
    }
    void load()
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setUploadContent(content)

      // Try to parse name from frontmatter
      const nameMatch = content.match(/^name:\s*(.+)/m)
      if (nameMatch) setUploadName(nameMatch[1].trim())

      const descMatch = content.match(/^description:\s*(.+)/m)
      if (descMatch) setUploadDesc(descMatch[1].trim())

      const tagsMatch = content.match(/^tags:\s*(.+)/m)
      if (tagsMatch) setUploadTags(tagsMatch[1].trim())
    }
    reader.readAsText(file)
  }

  const handleUpload = async () => {
    if (!uploadContent.trim()) return

    setIsUploading(true)
    try {
      await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: uploadContent,
          name: uploadName || undefined,
          description: uploadDesc || undefined,
          tags: uploadTags || undefined,
        }),
      })

      setUploadContent("")
      setUploadName("")
      setUploadDesc("")
      setUploadTags("")
      setShowUpload(false)
      fetchSkills()
    } catch (error) {
      console.error("Failed to upload skill:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this skill?")) return
    await fetch(`/api/skills/${id}`, { method: "DELETE" })
    fetchSkills()
  }

  const filteredSkills = skills.filter((s) => {
    if (filter === "builtin") return s.isBuiltin
    if (filter === "custom") return !s.isBuiltin
    return true
  })

  const builtinCount = skills.filter((s) => s.isBuiltin).length
  const customCount = skills.filter((s) => !s.isBuiltin).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-on-surface">Skills</h1>
          <p className="mt-2 text-base text-on-surface-variant">
            {builtinCount} built-in · {customCount} custom · {skills.length} total
          </p>
        </div>
        <Button variant="filled" onClick={() => setShowUpload(!showUpload)} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Add Skill
        </Button>
      </div>

      {showUpload && (
        <section className="rounded-2xl bg-surface-container p-6 space-y-4">
          <h2 className="text-xl font-normal text-on-surface">Add Custom Skill</h2>
          <p className="text-sm text-on-surface-variant">
            Upload a SKILL.md file or paste content directly. Skills use YAML frontmatter for metadata.
          </p>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-2">Upload .md file</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 w-full rounded-xl border border-dashed border-outline/40 bg-surface-container-high px-4 py-4 text-sm text-on-surface-variant hover:bg-surface-container-highest cursor-pointer transition-colors"
            >
              <FileText className="h-5 w-5" />
              {uploadContent ? "File loaded — click Save below" : "Choose a .md or .txt file"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Name</label>
              <input
                type="text"
                placeholder="Skill name (parsed from content if empty)"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="w-full rounded-xl border border-outline/20 bg-surface-container-high px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Tags</label>
              <input
                type="text"
                placeholder="e.g. xss, injection, auth"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                className="w-full rounded-xl border border-outline/20 bg-surface-container-high px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Description</label>
            <input
              type="text"
              placeholder="Brief description (parsed from content if empty)"
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              className="w-full rounded-xl border border-outline/20 bg-surface-container-high px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Content</label>
            <textarea
              placeholder={"---\nname: my-skill\ndescription: My custom skill\ntags: xss, injection\n---\n\n# My Skill\n\nSkill content here..."}
              value={uploadContent}
              onChange={(e) => setUploadContent(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-outline/20 bg-surface-container-high px-4 py-3 text-sm text-on-surface font-mono placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="filled" onClick={handleUpload} disabled={isUploading || !uploadContent.trim()} className="cursor-pointer">
              {isUploading ? "Saving..." : "Save Skill"}
            </Button>
            <Button variant="outlined" onClick={() => setShowUpload(false)} className="cursor-pointer">Cancel</Button>
          </div>
        </section>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "builtin", "custom"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${
              filter === f
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {f === "all" ? "All" : f === "builtin" ? "Built-in" : "Custom"}
          </button>
        ))}
      </div>

      {filteredSkills.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-container py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary-container">
            <Wrench className="h-8 w-8 text-on-secondary-container" />
          </div>
          <h2 className="mt-4 text-xl font-normal text-on-surface">
            {filter === "custom" ? "No Custom Skills" : "No Skills"}
          </h2>
          <p className="mt-2 max-w-sm text-center text-sm text-on-surface-variant">
            {filter === "custom"
              ? "Upload a SKILL.md file to add custom guidance for your security agents."
              : "Skills will appear here once loaded."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSkills.map((skill) => (
            <div key={skill.id} className="flex items-start justify-between rounded-2xl bg-surface-container p-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-medium text-on-surface">{skill.name}</h3>
                  {skill.isBuiltin ? (
                    <span className="inline-flex items-center rounded-md bg-secondary-container px-2 py-0.5 text-xs text-on-secondary-container">
                      Built-in
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-tertiary-container px-2 py-0.5 text-xs text-on-tertiary-container">
                      Custom
                    </span>
                  )}
                </div>
                {skill.description && (
                  <p className="mt-1 text-sm text-on-surface-variant">{skill.description}</p>
                )}
                {skill.tags && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {skill.tags.split(",").map((tag) => (
                      <span key={tag} className="inline-flex items-center rounded-md bg-surface-variant px-2 py-0.5 text-xs text-on-surface-variant">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Button variant="text" size="sm" onClick={() => setPreviewSkill(skill)} className="cursor-pointer">
                  <Eye className="h-4 w-4" />
                </Button>
                {!skill.isBuiltin && (
                  <Button variant="text" size="sm" onClick={() => handleDelete(skill.id)} className="cursor-pointer">
                    <Trash2 className="h-4 w-4 text-error" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewSkill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewSkill(null)}
        >
          <div
            className="w-[85%] max-w-3xl max-h-[85vh] rounded-2xl bg-surface-container p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-normal text-on-surface">{previewSkill.name}</h2>
                {previewSkill.description && (
                  <p className="text-sm text-on-surface-variant mt-1">{previewSkill.description}</p>
                )}
              </div>
              <Button variant="outlined" size="sm" onClick={() => setPreviewSkill(null)} className="cursor-pointer">Close</Button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-on-surface font-mono bg-black rounded-xl p-4 overflow-x-auto">
              {previewSkill.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
