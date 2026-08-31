import {
  getActiveSession,
  getDeviceId,
  saveSession,
  type StoredSession,
} from "@/lib/session";

/**
 * Cliente de `/api/client/v1`. La app nunca habla con Supabase ni con R2
 * salvo para bajar los bytes de una URL que el servidor ya firmó: no lleva
 * llave anónima, ni credenciales de almacenamiento, ni sesión de Supabase.
 */

const BASE = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

/** Códigos estables del backend; la app pone los textos. */
export type ApiErrorCode =
  | "invalid_request"
  | "invalid_code"
  | "gallery_unavailable"
  | "session_invalid"
  | "not_found"
  | "already_submitted"
  | "limit_reached"
  | "submit_empty"
  | "code_expired"
  | "code_exhausted"
  | "code_revoked"
  | "needs_selection"
  | "no_photos"
  | "too_large"
  | "too_many_attempts"
  | "server_error"
  | "offline";

export class ApiError extends Error {
  constructor(readonly code: ApiErrorCode) {
    super(code);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  /** Token de sesión; sin él la petición va anónima (solo `/session`). */
  token?: string;
  headers?: Record<string, string>;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, headers = {} } = options;

  let response: Response;
  try {
    response = await fetch(`${BASE}/api/client/v1${path}`, {
      method,
      headers: {
        "X-Nayra-Device": await getDeviceId(),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("offline");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: ApiErrorCode }
      | null;
    throw new ApiError(payload?.error ?? "server_error");
  }
  return (await response.json()) as T;
}

export type SessionResponse = {
  session: { token: string; expiresAt: string };
  gallery: { id: string; title: string; studioName: string };
};

export async function openGallery(code: string): Promise<StoredSession> {
  const data = await request<SessionResponse>("/session", {
    method: "POST",
    body: { code },
  });
  const session: StoredSession = {
    token: data.session.token,
    expiresAt: data.session.expiresAt,
    galleryId: data.gallery.id,
    galleryTitle: data.gallery.title,
    studioName: data.gallery.studioName,
    openedAt: new Date().toISOString(),
  };
  await saveSession(session);
  return session;
}

export type PhotoMeta = {
  id: string;
  w: number | null;
  h: number | null;
  position: number;
};

export type SignedUrl = { id: string; url: string; expiresAt: string };

export type Manifest = {
  gallery: {
    id: string;
    title: string;
    status: string;
    selectionLimit: number | null;
    extraPhotoPriceCents: number | null;
    currency: string;
    expiresAt: string | null;
    selectionSubmittedAt: string | null;
    hasCover: boolean;
  };
  studio: { name: string; logoUrl: string | null; branded: boolean };
  photos: PhotoMeta[];
  selectedPhotoIds: string[];
  thumbs: SignedUrl[];
  session?: { token: string; expiresAt: string };
};

/**
 * El manifiesto puede traer una sesión renovada (renovación deslizante); se
 * guarda al vuelo para que el cliente activo nunca vuelva a teclear su código.
 */
export async function fetchManifest(session: StoredSession): Promise<{
  manifest: Manifest;
  session: StoredSession;
}> {
  const manifest = await request<Manifest>("/gallery", { token: session.token });
  let next = session;
  if (manifest.session) {
    next = {
      ...session,
      token: manifest.session.token,
      expiresAt: manifest.session.expiresAt,
    };
    await saveSession(next);
  }
  return { manifest, session: next };
}

export function fetchPhotoUrls(
  token: string,
  ids: string[],
): Promise<{ urls: SignedUrl[]; missing: string[] }> {
  return request("/photo-urls", { method: "POST", body: { ids }, token });
}

export function toggleSelection(
  token: string,
  photoId: string,
): Promise<{ selected: boolean; count: number }> {
  return request("/selections/toggle", {
    method: "POST",
    body: { photoId },
    token,
  });
}

export function submitSelection(
  token: string,
): Promise<{ submittedAt: string; alreadySubmitted: boolean }> {
  return request("/selections/submit", { method: "POST", body: {}, token });
}

export type DownloadItem = { name: string; url: string };
export type Downloads = {
  grant?: string;
  items: DownloadItem[];
  expiresAt?: string;
  zipUrl: string | null;
};

export function redeemDownloadCode(
  token: string,
  code: string,
): Promise<Downloads> {
  return request("/downloads/redeem", {
    method: "POST",
    body: { code },
    token,
  });
}

/** Re-firma las descargas de un código ya canjeado sin gastar un uso. */
export function refreshDownloads(
  token: string,
  grant: string,
): Promise<Downloads> {
  return request("/downloads", { token, headers: { "X-Nayra-Grant": grant } });
}

export type PreviewResponse = {
  url: string;
  expiresAt: string;
  width: number | null;
  height: number | null;
};

/**
 * Preview de 1600px de una foto. Devuelve una URL firmada, no un redirect:
 * mandar el bearer a una URL prefirmada de R2 la rompería. La caché no sufre
 * porque las imágenes se guardan con `cacheKey` (el id de la foto), así que
 * una firma nueva no es una entrada nueva.
 *
 * Es además el camino que genera los derivados al vuelo, así que aquí van las
 * fotos que `/photo-urls` devuelve como `missing`.
 */
export function fetchPreview(
  token: string,
  photoId: string,
  size?: "thumb",
): Promise<PreviewResponse> {
  const query = size ? `?size=${size}` : "";
  return request(`/photos/${photoId}/preview${query}`, { token });
}

export function fetchCover(
  token: string,
): Promise<{ url: string; expiresAt: string }> {
  return request("/gallery/cover", { token });
}

export { getActiveSession };
