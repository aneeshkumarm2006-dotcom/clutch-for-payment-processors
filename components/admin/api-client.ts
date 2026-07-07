/**
 * Tiny client-side fetch wrapper for admin mutations (TODO §2.1).
 *
 * Normalizes the JSON error shape returned by `lib/api.ts#handleApiError`
 * (`{ error, fieldErrors? }`) into a thrown `ApiClientError` so forms can show a
 * toast (`.message`) AND map server-side field errors back onto react-hook-form
 * (`.fieldErrors`). All admin write paths go through this.
 */

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type Body = Record<string, unknown> | unknown[];

async function request<T>(method: string, url: string, body?: Body): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 204 / empty body
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!res.ok) {
    throw new ApiClientError(
      (data.error as string) || "Request failed. Please try again.",
      res.status,
      data.fieldErrors as Record<string, string[]> | undefined,
    );
  }

  return data as T;
}

export const apiClient = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: Body) => request<T>("POST", url, body),
  put: <T>(url: string, body?: Body) => request<T>("PUT", url, body),
  patch: <T>(url: string, body?: Body) => request<T>("PATCH", url, body),
  delete: <T>(url: string) => request<T>("DELETE", url),
};

/**
 * Upload an image (multipart) and return the public URL. Defaults to the admin
 * `POST /api/upload` route; the SEO team passes `endpoint="/api/seoteam/media"`
 * (cookie-guarded, and also registers a Media library record). Both routes return
 * `{ url }`.
 */
export async function uploadImageFile(
  file: File,
  folder = "uploads",
  endpoint = "/api/upload",
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);

  const res = await fetch(endpoint, { method: "POST", body: fd });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!res.ok) {
    throw new ApiClientError((data.error as string) || "Upload failed.", res.status);
  }
  return data.url as string;
}
