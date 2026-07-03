"use client"

import { Check, Edit, Trash2, Plus } from "lucide-react"
import { Button } from "@/app/(ui)/components/button"

export interface Provider {
  id: string
  name: string
  provider: string
  apiKey: string
  baseUrl?: string
  defaultModel: string
  enabled: boolean
}

interface InlineProviderListProps {
  providersList: Provider[]
  isSearchGroup: boolean
  onAdd: () => void
  onSetPrimary: (id: string, isSearch: boolean) => void
  onOpenEdit: (prov: Provider) => void
  onDelete: (id: string, enabled: boolean, isSearch: boolean) => void
}

export function InlineProviderList({
  providersList,
  isSearchGroup,
  onAdd,
  onSetPrimary,
  onOpenEdit,
  onDelete,
}: InlineProviderListProps) {
  return (
    <div className="mt-4 ml-14 p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20 space-y-4">
      <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
        <h4 className="text-sm font-semibold text-on-surface">Configured Profiles</h4>
        <Button variant="outlined" size="sm" onClick={onAdd} className="h-7 text-xs flex items-center gap-1">
          <Plus className="h-3 w-3" /> Add Profile
        </Button>
      </div>
      {providersList.length === 0 ? (
        <p className="text-xs text-on-surface-variant text-center py-2">No configurations.</p>
      ) : (
        <div className="space-y-3">
          {providersList.map((prov) => (
            <div key={prov.id} className="flex items-center justify-between py-2 border-b border-outline-variant/10 last:border-b-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-variant text-on-surface-variant font-mono text-[10px] font-bold">
                  {prov.provider.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h5 className="text-sm font-semibold text-on-surface truncate">{prov.name}</h5>
                  <p className="text-xs text-on-surface-variant font-mono mt-0.5">{prov.provider} · {prov.defaultModel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {prov.enabled ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success"><Check className="h-3 w-3" /> Primary</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetPrimary(prov.id, isSearchGroup)}
                    className="h-7 px-2.5 rounded-lg border border-outline hover:bg-surface-variant text-xs font-semibold text-on-surface-variant"
                  >
                    Set Primary
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenEdit(prov)}
                  className="h-7 w-7 rounded-lg border border-outline hover:bg-surface-variant flex items-center justify-center text-on-surface-variant"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(prov.id, prov.enabled, isSearchGroup)}
                  className="h-7 w-7 rounded-lg border border-outline hover:bg-surface-variant flex items-center justify-center text-error hover:bg-error/5 border-outline-variant/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
