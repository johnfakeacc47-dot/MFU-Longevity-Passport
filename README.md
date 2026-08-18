# MFU Longevity Passport

The MFU Longevity Passport is a comprehensive health and longevity tracking application. It features modules for monitoring daily activity, eating habits, mental health, and sleep patterns to help users maintain a healthy lifestyle.

## Features

- **Activity Tracking**: Monitor daily physical activities.
- **Eating & Diet**: Log dietary habits (includes Food Recognition powered by TensorFlow).
- **Mental Health**: Track mental well-being and stress levels.
- **Sleep Tracking**: Keep logs of sleep quality and duration.
- **Dashboard**: A comprehensive overview of health metrics.
- **Goal Setting**: Set and monitor personal health goals.
- **PWA Support**: Installable as a Progressive Web App.

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, Mantine UI components
- **Backend & Database**: Node.js backend with PostgreSQL / Supabase
- **Machine Learning**: TensorFlow.js (for food recognition capabilities)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- Docker (for local database)

### Installation

1. Clone the repository and install frontend dependencies:
   ```bash
   npm install
   ```

2. Install backend dependencies:
   ```bash
   npm run backend:install
   ```

3. Set up environment variables for the backend:
   Copy `backend/.env.example` to `backend/.env` and update the values as needed.

   `DATABASE_URL`, `JWT_SECRET`, and `ENCRYPTION_KEY` are **required** — the backend now fails
   fast on startup if any of them is missing (previously it would silently fall back to an
   insecure default, which masked misconfiguration and, for `ENCRYPTION_KEY`, silently
   corrupted encrypted data on every restart). Generate a key for `ENCRYPTION_KEY` with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex').slice(0,32))"
   ```

   See [backend/README.md](backend/README.md) for the full list of environment variables.

### Running the Application

1. Start the local database using Docker:
   ```bash
   npm run backend:db:up
   ```

2. Start the backend development server:
   ```bash
   npm run backend:dev
   ```

3. Start the frontend development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173`.

## Documentation

For details on the development process, branching strategies, and contribution guidelines, please refer to [process.md](process.md).
