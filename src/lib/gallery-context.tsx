import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { router, useFocusEffect } from "expo-router";

import {
  ApiError,
  fetchManifest,
  fetchPhotoUrls,
  fetchPreview,
  getActiveSession,
  submitSelection as submitSelectionApi,
  toggleSelection as toggleSelectionApi,
  type Manifest,
} from "@/api/client";
import {
  listSessions,
  removeSession,
  type StoredSession,
} from "@/lib/session";

/**
 * Estado de la galería abierta. Concentra lo que la app hace distinto de la
 * web: las URLs de R2 firmadas caducan, y `expo-image` cachea por URL, así
 * que re-firmar a lo bruto volvería a descargar la galería entera.
 */

/** Se pide una URL nueva con este margen antes de que caduque. */
const RENEW_MARGIN_MS = 5 * 60 * 1000;

/** Se agrupan las peticiones de la ventana visible en un solo viaje. */
const BATCH_DELAY_MS = 250;

/** Tope del endpoint. */
const BATCH_MAX = 100;

/**
 * Cuántas derivadas se generan a la vez. Cada una baja el original y lo pasa
 * por sharp en el servidor, así que pedir cien de golpe al abrir una galería
 * recién subida la tumbaría.
 */
const GENERATE_CONCURRENCY = 3;

type Entry = { url: string; expiresAt: number };

type GalleryState = {
  session: StoredSession | null;
  manifest: Manifest | null;
  loading: boolean;
  error: string | null;
  selected: Set<string>;
  urls: Record<string, Entry>;
  /** Pide (o re-pide) las URLs de los ids que lo necesiten. */
  ensureUrls: (ids: string[]) => void;
  /** La imagen falló: se descarta la URL y se pide otra. */
  markStale: (id: string) => void;
  toggle: (photoId: string) => Promise<"ok" | "limit_reached" | "error">;
  submit: () => Promise<boolean>;
  leave: () => Promise<void>;
};

const GalleryContext = createContext<GalleryState | null>(null);

export function useGallery(): GalleryState {
  const value = useContext(GalleryContext);
  if (!value) throw new Error("useGallery fuera de GalleryProvider");
  return value;
}

export function GalleryProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [urls, setUrls] = useState<Record<string, Entry>>({});

  const urlsRef = useRef(urls);
  urlsRef.current = urls;
  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);

  /**
   * La sesión murió: el fotógrafo regeneró el enlace, o caducó. Se quita
   * solo esta galería —las demás del dispositivo siguen sirviendo— y el
   * arranque decide a dónde ir.
   */
  const expire = useCallback(async (galleryId?: string) => {
    if (galleryId) await removeSession(galleryId);
    router.replace("/");
  }, []);

  const loadedId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const stored = await getActiveSession();
    if (!stored) {
      router.replace("/access");
      return;
    }
    loadedId.current = stored.galleryId;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchManifest(stored);
      tokenRef.current = result.session.token;
      setSession(result.session);
      setManifest(result.manifest);
      setSelected(new Set(result.manifest.selectedPhotoIds));
      setUrls(
        Object.fromEntries(
          result.manifest.thumbs.map((t) => [
            t.id,
            { url: t.url, expiresAt: Date.parse(t.expiresAt) },
          ]),
        ),
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "session_invalid") {
        void expire(stored.galleryId);
        return;
      }
      setError(
        cause instanceof ApiError && cause.code === "offline"
          ? "errors.offline"
          : "errors.generic",
      );
    } finally {
      setLoading(false);
    }
  }, [expire]);

  /**
   * Recarga cuando cambia la galería activa. Al volver de "Tus galerías" la
   * pantalla puede seguir montada, y sin esto enseñaría las fotos de la
   * galería anterior con el nombre de la nueva.
   */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const stored = await getActiveSession();
        if (!active) return;
        if (loadedId.current !== (stored?.galleryId ?? null)) void load();
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );


  const flush = useCallback(async () => {
    const token = tokenRef.current;
    const ids = [...pending.current].slice(0, BATCH_MAX);
    pending.current.clear();
    if (!token || ids.length === 0) return;
    const merge = (entries: { id: string; url: string; expiresAt: string }[]) => {
      if (entries.length === 0) return;
      setUrls((prev) => {
        const next = { ...prev };
        for (const entry of entries) {
          next[entry.id] = {
            url: entry.url,
            expiresAt: Date.parse(entry.expiresAt),
          };
        }
        return next;
      });
    };

    try {
      const { urls: fresh, missing } = await fetchPhotoUrls(token, ids);
      merge(fresh);

      // `missing` son las fotos a las que todavía no se les ha pasado sharp.
      // La ruta de una sola foto las genera al vuelo y desde entonces caen
      // en el camino rápido del lote.
      for (let i = 0; i < missing.length; i += GENERATE_CONCURRENCY) {
        const slice = missing.slice(i, i + GENERATE_CONCURRENCY);
        const generated = await Promise.all(
          slice.map((id) =>
            fetchPreview(token, id, "thumb")
              .then((result) => ({
                id,
                url: result.url,
                expiresAt: result.expiresAt,
              }))
              .catch(() => null),
          ),
        );
        merge(generated.filter((entry) => entry !== null));
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "session_invalid") {
        void expire();
      }
      // Cualquier otro fallo se reintenta solo en el próximo scroll.
    }
  }, [expire]);

  const ensureUrls = useCallback(
    (ids: string[]) => {
      const deadline = Date.now() + RENEW_MARGIN_MS;
      let queued = false;
      for (const id of ids) {
        const entry = urlsRef.current[id];
        if (entry && entry.expiresAt > deadline) continue;
        pending.current.add(id);
        queued = true;
      }
      if (!queued) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), BATCH_DELAY_MS);
    },
    [flush],
  );

  const markStale = useCallback(
    (id: string) => {
      setUrls((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      pending.current.add(id);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), BATCH_DELAY_MS);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const toggle = useCallback<GalleryState["toggle"]>(
    async (photoId) => {
      const token = tokenRef.current;
      if (!token) return "error";
      try {
        const result = await toggleSelectionApi(token, photoId);
        setSelected((prev) => {
          const next = new Set(prev);
          if (result.selected) next.add(photoId);
          else next.delete(photoId);
          return next;
        });
        return "ok";
      } catch (cause) {
        if (cause instanceof ApiError) {
          if (cause.code === "session_invalid") {
            void expire();
            return "error";
          }
          if (cause.code === "limit_reached") return "limit_reached";
        }
        return "error";
      }
    },
    [expire],
  );

  const submit = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return false;
    try {
      const result = await submitSelectionApi(token);
      setManifest((prev) =>
        prev
          ? {
              ...prev,
              gallery: {
                ...prev.gallery,
                selectionSubmittedAt: result.submittedAt,
              },
            }
          : prev,
      );
      return true;
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "session_invalid") {
        void expire();
      }
      return false;
    }
  }, [expire]);

  /** Salir de esta galería: se quita del dispositivo y se vuelve al inicio. */
  const leave = useCallback(async () => {
    const current = await getActiveSession();
    if (current) await removeSession(current.galleryId);
    const rest = await listSessions();
    router.replace(rest.length > 0 ? "/galleries" : "/access");
  }, []);

  const value = useMemo<GalleryState>(
    () => ({
      session,
      manifest,
      loading,
      error,
      selected,
      urls,
      ensureUrls,
      markStale,
      toggle,
      submit,
      leave,
    }),
    [
      session,
      manifest,
      loading,
      error,
      selected,
      urls,
      ensureUrls,
      markStale,
      toggle,
      submit,
      leave,
    ],
  );

  return (
    <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>
  );
}
