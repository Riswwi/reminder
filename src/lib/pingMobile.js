export async function pingMobile(taskId = null, operation = "sync") {
  try {
    const response = await fetch("/api/ping-mobile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, operation }),
    });

    if (!response.ok) {
      console.error("Mobile sync ping failed:", response.status);
    }
  } catch (error) {
    // The Firestore write has already succeeded. Keep the UI responsive while
    // surfacing the push failure in the browser console for diagnostics.
    console.error("Mobile sync ping failed:", error);
  }
}
