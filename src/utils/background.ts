import { waitUntil } from "@vercel/functions";

// Keeps fire-and-forget work (best-effort emails, notifications) alive after
// the HTTP response has been sent. On Vercel serverless a bare
// `void Promise.allSettled(...)` can be frozen mid-execution the moment the
// response returns — silently dropping SMTP sends that were still in flight.
export const runInBackground = (work: Promise<unknown>[]): void => {
  void waitUntil(Promise.allSettled(work));
};
