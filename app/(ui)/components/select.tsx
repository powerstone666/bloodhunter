"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Search as SearchIcon } from "lucide-react"

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  id?: string
}

export function Select({ value, onChange, options, placeholder = "Select...", id }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const selectRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])



  const selectedOption = options.find(opt => opt.value === value)

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.value.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div ref={selectRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-full items-center justify-between rounded-xl bg-surface-variant px-4 text-base text-on-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 active:scale-[0.98]"
      >
        <span className={selectedOption ? "text-on-surface" : "text-on-surface-variant"}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={`h-5 w-5 text-on-surface-variant transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full rounded-xl bg-surface-container shadow-lg ring-1 ring-outline-variant animate-scale-in origin-top overflow-hidden flex flex-col max-h-72">
          {/* Search Input */}
          <div className="relative border-b border-outline-variant/30 flex items-center bg-surface shrink-0">
            <SearchIcon className="absolute left-3 h-4 w-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-9 pr-4 text-sm bg-transparent text-on-surface outline-none placeholder:text-on-surface-variant/60"
              autoFocus
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-on-surface-variant text-center">
                No results found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                    setSearchTerm("")
                  }}
                  className={`w-full px-4 py-3 text-left text-base cursor-pointer hover:bg-surface-variant transition-colors duration-150 ${
                    option.value === value ? "bg-primary-container text-on-primary-container" : "text-on-surface"
                  }`}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
