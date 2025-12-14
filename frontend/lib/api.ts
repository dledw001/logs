const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export async function callApi(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ status: number; data: unknown }> {
  const csrf = getCookie("csrf_token");
  const method = (options.method || "GET").toUpperCase();
  const headers: Record<string, string> = {};

  if (options.body) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrf) {
    headers["x-csrf-token"] = csrf;
  }

  const res = await fetch(`${apiBase}${path}`, {
    method,
    credentials: "include",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    try {
      data = await res.text();
    } catch {
      data = null;
    }
  }

  return { status: res.status, data };
}

export function apiHint(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  return "proxying through Next rewrites (recommended for cookies)";
}
