export function SummaryCard({ summary }: { summary: string | null }) {
  if (!summary) return null
  return (
    <section aria-labelledby="summary-heading" className="rounded-xl border bg-card p-5">
      <h2 id="summary-heading" className="mb-2 text-base font-semibold">
        Call summary
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
    </section>
  )
}
