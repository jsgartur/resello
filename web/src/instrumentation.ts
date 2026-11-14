// Startet beim Hochfahren des Dashboards den 15-Minuten-Takt für Automationen
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/automation");
    startScheduler();
  }
}
