import { randomUUID } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

/**
 * Sesiones del cliente en el dispositivo. Nada de esto existe en el servidor:
 * el backend no guarda ninguna fila por sesión, solo firma un payload que
 * vive aquí. Por eso el acceso es realmente "sin cuenta y sin datos".
 *
 * Se guardan VARIAS: un cliente puede tener la galería de su boda y la de la
 * sesión familiar, o dos fotógrafos distintos. Con una sola sesión, mirar la
 * otra obligaba a salir y volver a teclear el código.
 */

const DEVICE_KEY = "nayra.deviceId";
const INDEX_KEY = "nayra.sessions";
const ACTIVE_KEY = "nayra.activeGallery";
const sessionKey = (galleryId: string) => `nayra.session.${galleryId}`;

export type StoredSession = {
  token: string;
  expiresAt: string;
  galleryId: string;
  galleryTitle: string;
  studioName: string;
  /** Para ordenar la lista por uso más reciente. */
  openedAt: string;
};

let cachedDeviceId: string | null = null;

/**
 * Identificador aleatorio del dispositivo, creado en el primer arranque. Solo
 * sale de aquí dentro de la cabecera `X-Nayra-Device`, y el servidor guarda
 * únicamente su hash dentro del token de sesión — nunca en una tabla.
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const stored = await SecureStore.getItemAsync(DEVICE_KEY);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }
  const created = randomUUID();
  await SecureStore.setItemAsync(DEVICE_KEY, created);
  cachedDeviceId = created;
  return created;
}

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function readSession(galleryId: string): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(sessionKey(galleryId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed.token ? parsed : null;
  } catch {
    return null;
  }
}

/** Galerías guardadas, de la más usada recientemente a la más antigua. */
export async function listSessions(): Promise<StoredSession[]> {
  const ids = await readIndex();
  const sessions = await Promise.all(ids.map(readSession));
  return sessions
    .filter((s): s is StoredSession => s !== null)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

export async function getActiveSession(): Promise<StoredSession | null> {
  const activeId = await SecureStore.getItemAsync(ACTIVE_KEY);
  if (activeId) {
    const session = await readSession(activeId);
    if (session) return session;
  }
  // Sin activa válida se cae a la más reciente: pasa cuando el fotógrafo
  // regeneró el enlace de una y el cliente tiene otras.
  const [first] = await listSessions();
  return first ?? null;
}

/**
 * Guarda (o actualiza) una galería y la deja como activa. Cada sesión va en
 * su propia clave y el índice solo lleva ids: SecureStore no promete
 * funcionar con valores grandes en Android, y un único blob con todas las
 * sesiones crecería sin techo.
 */
export async function saveSession(session: StoredSession): Promise<void> {
  const ids = await readIndex();
  if (!ids.includes(session.galleryId)) {
    ids.push(session.galleryId);
    await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids));
  }
  await SecureStore.setItemAsync(
    sessionKey(session.galleryId),
    JSON.stringify(session),
  );
  await SecureStore.setItemAsync(ACTIVE_KEY, session.galleryId);
}

export async function setActiveSession(galleryId: string): Promise<void> {
  const session = await readSession(galleryId);
  if (!session) return;
  await saveSession({ ...session, openedAt: new Date().toISOString() });
}

/** Saca una galería del dispositivo. El resto siguen accesibles. */
export async function removeSession(galleryId: string): Promise<void> {
  const ids = (await readIndex()).filter((id) => id !== galleryId);
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids));
  await SecureStore.deleteItemAsync(sessionKey(galleryId));
  const activeId = await SecureStore.getItemAsync(ACTIVE_KEY);
  if (activeId === galleryId) await SecureStore.deleteItemAsync(ACTIVE_KEY);
}
