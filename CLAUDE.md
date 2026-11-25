# Call Analyzer

Web app for sales managers: upload a call (.m4a/.mp3) -> transcript with speakers -> rep tone RED/GREEN
(judged from words AND voice) -> action items -> everything shown in-app with user-configurable settings.
Interview assignment. Priorities: accuracy/reliability > UX > configurability.

## Layout
- `backend/`  FastAPI + SQLAlchemy 2 + SQLite. Python venv, run from `backend/`.
- `frontend/` React + TypeScript + Vite, Tailwind v4, shadcn/ui, Zustand (settings/UI), TanStack Query (server state).

## Commands
- Backend: `uvicorn app.main:app --reload --port 8000` | tests: `python -m pytest -q`
- Frontend: `npm run dev` | typecheck/build: `npm run build` | mock mode: `VITE_USE_MOCK=true` in `frontend/.env.local`
- Voice API check (uses credits): `python -m scripts.voice_probe <audio>` then `python -m scripts.voice_report <file>.voice_raw.json`

## Architecture rules (do not break)
- **Model proposes, code decides.** The LLM only suggests. `services/postprocess.py` makes the final call:
  RED needs model-negative AND confidence >= user threshold AND a verified quote from the REP.
  Unverifiable quotes/items are dropped. Owners/deadlines are never invented (null => "Not specified").
- Tone is about the **rep only**. Customer lines are never tone evidence.
- Pipeline (`services/pipeline.py`): AssemblyAI transcription and Behavioral Signals voice run in parallel;
  then `services/analysis.py` (roles -> Claude tool call -> postprocess -> save). Re-analysis never re-transcribes
  and never re-fetches voice if it already succeeded.
- Voice (`voice_client.py` = API only, `voice_features.py` = pure maths, `voice_store.py` = DB glue):
  `fetch_voice` never raises; voice failure => words-only tone + warning, job still completes.
  Raw probabilities are stored; flags are derived at read time from the user's sensitivity (THRESHOLDS are provisional).
  Evidence has `basis` (words | voice | words_and_voice); unmeasured voice claims are dropped/downgraded;
  voice-only evidence counts toward RED only when `voice_mode == "strong"`.
- Settings live in the UI (Zustand, persisted) and are sent with each analysis; the backend stores a
  `settings_snapshot` per analysis (plus `roles_used`). Defaults must match in `backend/app/schemas.py` and `frontend/src/lib/settings.ts`.
- API types are mirrored by hand: `backend/app/schemas.py` <-> `frontend/src/types/api.ts` (snake_case, no mapping layer).
- Colours: red/green are reserved for the tone verdict only. Warnings amber, processing sky, voice highlights orange/amber.
- DB: SQLite, no Alembic. New nullable columns go in `database._ADDED_COLUMNS`; new tables are created automatically.

## Conventions
- Pure logic stays pure and unit-tested (`postprocess`, `verification`, `voice_features`, `lib/settings.ts`).
- Pydantic validates everything the LLM returns. Error messages shown to users must be plain language.
- Keep files small and single-purpose. No new dependencies without asking (no PyTorch).
- Secrets only in `backend/.env` (never commit). Audio is sent to AssemblyAI and Behavioral Signals; mention in docs if that changes.

## Don't waste tokens on
`node_modules/`, `backend/data/`, `backend/.venv/`, `dist/`, `*.voice_raw.json`, lockfiles, `src/components/ui/` (generated shadcn).

## Roadmap (after tonality)
1. Regional language support (Hindi, Marathi, Kannada, ...) - transcription, prompts and UI. 2-6: to be specified by the user.