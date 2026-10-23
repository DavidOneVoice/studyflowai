# StudyFlow AI

StudyFlow AI is a React study planner with AI summaries and multiple-choice practice. The frontend is hosted at [studyflo-ai.netlify.app](https://studyflo-ai.netlify.app/).

## Features

- Build a reading schedule from subjects, exam dates, priorities, and available study hours.
- Upload PDF, DOCX, or TXT notes, or paste text, and save them in a practice library.
- Generate summaries that process the complete supplied document.
- Take timed quizzes, avoid recently generated questions, and review saved attempts.
- Export schedules as TXT/CSV and practice questions as PDFs with Greek, accented, and mathematical characters.

The app stores study data in the browser's `localStorage`, under the existing `cramless_v1` key. It is not account-synced storage. Saving errors are shown without clearing unsaved forms or generated results, and open tabs receive storage changes. Clearing browser site data also clears saved study data.

## Local setup

Use Node.js 24 LTS (`nvm use`); the supported minimum is Node.js 22.12.

```sh
npm ci
npm --prefix server ci
cp .env.example .env
cp server/.env.example server/.env
```

Set `OPENAI_API_KEY` in `server/.env`. This is a server-only secret; never add it to a `VITE_` variable or commit it.

Run the backend and frontend in separate terminals:

```sh
npm run dev:server
```

```sh
npm run dev
```

The frontend runs at `http://localhost:5173`. Its development `/api` proxy connects to the backend at `http://127.0.0.1:5050` by default. If the backend port changes, update the proxy or set `VITE_API_BASE` to its origin.

### Configuration

| Variable | Location | Purpose |
| --- | --- | --- |
| `VITE_API_BASE` | Root `.env` / frontend build environment | Backend origin. Blank uses same-origin `/api`; development proxies this locally. If omitted from a production build, the existing `https://cramless.onrender.com` backend remains the fallback. |
| `OPENAI_API_KEY` | `server/.env` / backend environment | API key used only by the backend. |
| `OPENAI_MODEL` | Backend | Optional model override; defaults to `gpt-4.1-mini`. |
| `PORT` | Backend | Listening port, default `5050`. |
| `FRONTEND_ORIGIN` | Backend | Optional comma-separated frontend origins for CORS. |

There are no added user usage quotas, payment flows, or sign-in requirements. Generation uses the backend owner's API account. The existing 4 MB JSON request transport size and existing quiz-size choices remain unchanged; provider service limits still apply.

## Verification

```sh
npm run lint
npm test
npm run build
npm audit
npm --prefix server audit
```

Tests use mocked AI responses and do not need an API key or make billable generation requests. They cover scheduling, persistence failures, full-document processing, provider errors, quiz validation/history, countdown timing, document extraction helpers, and Unicode PDF output. GitHub Actions runs install, lint, tests, and the production build on pushes and pull requests.

The frontend and backend retain separate lockfiles so the backend can also be deployed with `server/` as its root directory. Install each with `npm ci` for reproducible builds. The frontend deploy command is `npm run build`, with `dist/` as the publish directory; the backend starts with `npm start` inside `server/`. Set production frontend and backend environment variables before deploying.

## Behavior notes

- Scheduling excludes elapsed time slots today and stops assigning a subject after its own exam date. The exam date itself is eligible because the planner does not collect exam times.
- AI calls begin when the user starts a quiz or selects Generate Summary. Opening quiz setup does not generate unused questions.
- Long summaries process every source chunk, then combine them hierarchically. A very long document can require multiple provider requests.
- Quiz input needs at least 80 text characters. Administrative lines are excluded contextually; academic terms such as platform, department, and assignment are retained when they belong to the subject matter.
- The timer uses a deadline, so background-tab throttling does not grant extra practice time.
- PDF export bundles Noto Sans and Noto Sans Math under their included SIL Open Font Licenses. If a character is unsupported, export reports it rather than silently deleting text.

## Project structure

- `src/pages/` — planner, schedule, library, summary, and practice screens.
- `src/components/` — shared forms, navigation, and accessible modal UI.
- `src/lib/` — scheduling, shared persistence, document processing, practice helpers, and PDF export.
- `server/index.js` — Express endpoints and injectable application factory.
- `server/lib/generation.js` — injectable AI generation service and response validation.
- `tests/`, `src/lib/*.test.js`, and `server/test/` — offline regression tests.
