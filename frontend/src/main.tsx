import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router"

import "./index.css"
import App from "./App"
import { queryClient } from "./lib/queryClient"
import { USE_MOCK } from "./api"
import { mockControls } from "./mocks"

// Dev + mock mode only: tweak the mock backend from the browser console, e.g.
//   mockControls.latencyMs = 1500   mockControls.failNextAnalysis = true
if (import.meta.env.DEV && USE_MOCK) Object.assign(window, { mockControls })

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
