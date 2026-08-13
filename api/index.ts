// Vercel serverless entrypoint — re-exports the same Express app the local
// build uses. Vercel's @vercel/node runtime compiles and wraps it; the app is
// split from server.ts (which only starts the listener) so the two hosts share
// one route registry.
import app from "../src/app";

export default app;