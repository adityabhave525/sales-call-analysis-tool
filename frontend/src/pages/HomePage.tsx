import { RecentJobs } from "@/components/jobs/RecentJobs"
import { UploadCard } from "@/components/upload/UploadCard"

export function HomePage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analyse a sales call</h1>
        <p className="text-muted-foreground">
          Upload a recording to get a transcript, a tone check on your sales rep, and the action items that came out of the call.
        </p>
      </div>
      <UploadCard />
      <RecentJobs />
    </div>
  )
}
