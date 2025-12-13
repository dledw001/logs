export function extractCsrfToken(res) {
  const cookies = res.headers?.["set-cookie"];
  if (!cookies) return null;
  const arr = Array.isArray(cookies) ? cookies : [cookies];
  for (const c of arr) {
    const match = c.match(/csrf_token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}
