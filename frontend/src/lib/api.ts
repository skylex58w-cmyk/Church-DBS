const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
export const API_BASE_URL = configuredApiUrl.replace(/\/$/, "");

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success || payload.data === undefined) {
    const message = payload?.error?.message;
    throw new Error(typeof message === "string" ? message : `Request failed (${response.status})`);
  }
  return payload.data;
}
