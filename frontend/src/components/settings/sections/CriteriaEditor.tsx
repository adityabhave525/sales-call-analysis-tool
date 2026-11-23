import { useState } from "react"
import { ChevronDown, Plus, Trash2 } from "lucide-react"

import { Notice } from "@/components/common/Notice"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { hasEnabledCriteria, isBuiltInCriterion, LIMITS } from "@/lib/settings"
import { cn } from "@/lib/utils"
import { useSettingsStore } from "@/store/settingsStore"

const store = () => useSettingsStore.getState()

export function CriteriaEditor() {
  const settings = useSettingsStore((s) => s.settings)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [definition, setDefinition] = useState("")
  const [error, setError] = useState<string | null>(null)

  function add() {
    const problem = store().addCriterion(name, definition)
    if (problem) return setError(problem)
    setName("")
    setDefinition("")
    setError(null)
    setAdding(false)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">What counts as negative</p>
        <p className="text-xs text-muted-foreground">
          Switch behaviours on or off and edit what each one means. You can add your own.
        </p>
      </div>

      {!hasEnabledCriteria(settings) && (
        <Notice variant="info">No criteria are switched on, so every call will come back GREEN.</Notice>
      )}

      <ul className="space-y-2">
        {settings.tone_criteria.map((c) => {
          const open = expanded === c.key
          const custom = !isBuiltInCriterion(c.key)
          const empty = c.definition.trim() === ""
          return (
            <li key={c.key} className="rounded-lg border bg-background">
              <div className="flex items-center gap-3 p-3">
                <Switch
                  id={`crit-${c.key}`}
                  checked={c.enabled}
                  onCheckedChange={(on: boolean) => store().updateCriterion(c.key, { enabled: on })}
                />
                <label htmlFor={`crit-${c.key}`} className="flex flex-1 items-center gap-2 text-sm font-medium">
                  {c.label}
                  {custom && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                      Custom
                    </Badge>
                  )}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={open}
                  aria-controls={`crit-edit-${c.key}`}
                  onClick={() => setExpanded(open ? null : c.key)}
                >
                  Edit
                  <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
                </Button>
              </div>

              {!open && (
                <p className={cn("line-clamp-2 px-3 pb-3 text-xs", c.enabled && empty ? "text-amber-800" : "text-muted-foreground")}>
                  {empty ? "No definition yet. The model needs one." : c.definition}
                </p>
              )}

              {open && (
                <div id={`crit-edit-${c.key}`} className="space-y-3 border-t p-3">
                  {custom && (
                    <div className="space-y-1.5">
                      <label htmlFor={`crit-name-${c.key}`} className="text-xs font-medium">
                        Name
                      </label>
                      <Input
                        id={`crit-name-${c.key}`}
                        value={c.label}
                        maxLength={LIMITS.criterionLabelMax}
                        onChange={(e: { target: { value: string } }) => store().updateCriterion(c.key, { label: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label htmlFor={`crit-def-${c.key}`} className="text-xs font-medium">
                      What it means
                    </label>
                    <Textarea
                      id={`crit-def-${c.key}`}
                      rows={3}
                      value={c.definition}
                      maxLength={LIMITS.criterionDefinitionMax}
                      onChange={(e: { target: { value: string } }) => store().updateCriterion(c.key, { definition: e.target.value })}
                    />
                    <p className="text-right text-xs text-muted-foreground">
                      {c.definition.length}/{LIMITS.criterionDefinitionMax}
                    </p>
                  </div>
                  {custom && (
                    <Button type="button" variant="outline" size="sm" onClick={() => store().removeCriterion(c.key)}>
                      <Trash2 />
                      Remove criterion
                    </Button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {adding ? (
        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <div className="space-y-1.5">
            <label htmlFor="new-crit-name" className="text-xs font-medium">
              Name
            </label>
            <Input
              id="new-crit-name"
              placeholder="e.g. Talks over the customer"
              value={name}
              maxLength={LIMITS.criterionLabelMax}
              onChange={(e: { target: { value: string } }) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-crit-def" className="text-xs font-medium">
              What it means
            </label>
            <Textarea
              id="new-crit-def"
              rows={3}
              placeholder="e.g. Interrupts the customer before they finish a sentence."
              value={definition}
              maxLength={LIMITS.criterionDefinitionMax}
              onChange={(e: { target: { value: string } }) => setDefinition(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-amber-800">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={add}>
              Add criterion
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false)
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus />
          Add your own criterion
        </Button>
      )}
    </div>
  )
}
