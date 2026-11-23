import type { ReactNode } from "react"

/** A labelled settings group: title, optional help text, then the control(s). */
export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <div className="text-xs leading-relaxed text-muted-foreground">{hint}</div>}
    </div>
  )
}
