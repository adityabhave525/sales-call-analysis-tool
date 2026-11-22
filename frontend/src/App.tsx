import { Route, Routes } from "react-router"

import { AppShell } from "@/components/layout/AppShell"
import { HomePage } from "@/pages/HomePage"
import { JobPage } from "@/pages/JobPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="jobs/:id" element={<JobPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
