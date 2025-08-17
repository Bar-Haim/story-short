export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20000
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
} 