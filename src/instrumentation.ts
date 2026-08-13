// Runs once when the Next.js server boots. Starts the in-process daily sync
// scheduler — Node runtime only, never on the edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}
