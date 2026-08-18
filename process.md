# Development Process

This document outlines the standard development workflow and guidelines for the MFU Longevity Passport project.

## Workflow

1. **Branching Strategy**: 
   - `main`: Production-ready code.
   - `dev`: Active development branch.
   - Feature branches should be created from `dev` and named descriptively (e.g., `feature/food-recognition`, `fix/sleep-tracker-bug`).

2. **Commit Guidelines**:
   - Write clear and descriptive commit messages.
   - Use conventional commits format (e.g., `feat: add activity dashboard`, `fix: correct layout on mobile`).

3. **Pull Requests**:
   - Open a Pull Request against the `dev` branch.
   - Ensure all tests and linting checks pass before requesting a review.
   - Request at least one code review from a team member.

## Environment Management

- **Frontend**: Environment variables should be placed in a `.env` file at the root. Prefix variables required by the frontend with `VITE_`.
- **Backend**: Managed via the `backend/.env` file. Ensure sensitive keys (like database passwords and API secrets) are never committed to version control.
  - `DATABASE_URL`, `JWT_SECRET`, and `ENCRYPTION_KEY` are required — the backend throws at
    startup if any is missing rather than falling back to an insecure default. See
    [backend/README.md](backend/README.md) for the full list.
  - `ENCRYPTION_KEY` must stay stable once set. It's used for AES-256 at-rest encryption of
    `meal.imageUrl` and `health_log.data` — rotating or losing it makes previously-encrypted
    rows permanently undecryptable.
  - Optional `CORS_ORIGIN` (comma-separated) overrides the default localhost-only CORS list;
    set it to the deployed frontend's origin in any non-local environment.

## Frontend Stability Conventions

- **Error boundaries**: The app is wrapped in a top-level `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) so an uncaught render error shows a recoverable "Reload" screen instead of a blank white screen. Feature-specific boundaries (like the one around `FoodRecognition`) are still fine for isolating risky subtrees, but don't rely on them as the only safety net.
- **localStorage reads**: Always read/parse `localStorage` via `safeGetItem`/`safeParse` (`src/utils/safeStorage.ts`) instead of raw `JSON.parse(localStorage.getItem(...))`. A single malformed value would otherwise throw during render with no boundary catching it in time, white-screening the app.

## Available Scripts

### Frontend Scripts
- `npm run dev`: Starts the Vite development server.
- `npm run build`: Compiles TypeScript and builds the app for production.
- `npm run lint`: Lints the codebase using ESLint.
- `npm run preview`: Previews the production build locally.

### Backend Scripts
- `npm run backend:install`: Installs dependencies for the backend.
- `npm run backend:dev`: Starts the backend server in development mode.
- `npm run backend:build`: Builds the backend.
- `npm run backend:start`: Starts the built backend in production mode.
- `npm run backend:db:up`: Spins up the local database using Docker Compose.
- `npm run backend:db:down`: Tears down the local database containers.

## Testing & Quality Assurance

- Always run `npm run lint` before committing to ensure code quality.
- Write unit tests for critical utility functions and hooks.
- Test across different devices as this application is a Progressive Web App (PWA) and is expected to be used on mobile.
