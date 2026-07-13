# App Domain

## Purpose
Python backend responsible for serving the JSON API, handling SSE (Server-Sent Events) for real-time schedule updates, and running background tasks via APScheduler to synchronize MDB database content to local SQLite.

## Ownership
- `server.py`: Flask application and Waitress HTTP server execution.
- `sync_service.py`: APScheduler jobs, `mdbtools` execution, and data synchronization.
- Data models and routing logic for the schedule.

## Local Contracts
- The API must always provide structurally valid schedule arrays for college/university.
- SSE events (`sync_status`, `schedule_update`) must be pushed efficiently without overwhelming the client.
- Background sync must be resilient to `mdbtools` failures and log errors appropriately.

## Work Guidance
- Use Waitress for production serving instead of Flask's built-in dev server.
- Logging should differentiate between routine sync actions and critical failures.
- Treat the `.mdb` file as read-only. Ensure SQLite acts as an efficient cache.

## Verification
- Start the server and check that `http://localhost:9090/` returns the expected app shell.
- Monitor `/api/events` endpoint to verify SSE keep-alive and event dispatches.
- Watch logs (`logs/app.log`) for successful sync task completions.

## Child DOX Index
This domain has no child directories requiring their own DOX files.
