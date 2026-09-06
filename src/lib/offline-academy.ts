/**
 * Academia sin conexión.
 *
 * El contenido descargado vive en IndexedDB y **lo escribe la página**, nunca
 * el service worker. Esa decisión es deliberada: el worker mantiene intacta su
 * política de no interceptar navegación autenticada ni `/api/`, así que aquí no
 * se cachea ninguna respuesta con sesión, cotización ni dato de pago. Solo
 * texto de lecciones a las que la cuenta ya tiene derecho.
 *
 * El almacén queda marcado con la cuenta que lo descargó. Si entra otra
 * persona en el mismo dispositivo, se borra antes de escribir nada: en un
 * equipo compartido, el contenido de una suscripción no puede sobrevivir al
 * cierre de sesión de quien la paga.
 */

export const OFFLINE_DB = 'tradinglab-offline';
export const OFFLINE_DB_VERSION = 1;
export const LESSON_STORE = 'lessons';
export const META_STORE = 'meta';

export interface OfflineLesson {
  slug: string;
  title: string;
  summary: string;
  /** `LessonBlock[]` serializado tal y como lo sirve la API. */
  blocks: unknown[];
  estimatedMinutes: number;
  trackTitle: string;
  courseTitle: string;
  position: number;
  /** Bloques que necesitan mercado en vivo y no se pueden leer sin conexión. */
  liveBlocks: number;
}

export interface OfflineStatus {
  supported: boolean;
  count: number;
  bytes: number;
  savedAt: number | null;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LESSON_STORE)) db.createObjectStore(LESSON_STORE, { keyPath: 'slug' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('La base de datos local está en uso en otra pestaña.'));
  });
}

function run<T>(store: IDBObjectStore, request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    void store;
  });
}

export function offlineSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

/** Guarda el paquete de lecciones, reemplazando cualquier descarga anterior. */
export async function saveLessons(lessons: OfflineLesson[], scope: string): Promise<OfflineStatus> {
  const db = await openDatabase();
  try {
    const tx = db.transaction([LESSON_STORE, META_STORE], 'readwrite');
    const lessonStore = tx.objectStore(LESSON_STORE);
    const metaStore = tx.objectStore(META_STORE);
    lessonStore.clear();
    for (const lesson of lessons) lessonStore.put(lesson);
    const bytes = new Blob([JSON.stringify(lessons)]).size;
    metaStore.put({ key: 'scope', value: scope });
    metaStore.put({ key: 'savedAt', value: Date.now() });
    metaStore.put({ key: 'bytes', value: bytes });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return { supported: true, count: lessons.length, bytes, savedAt: Date.now() };
  } finally {
    db.close();
  }
}

export async function readStatus(): Promise<OfflineStatus> {
  if (!offlineSupported()) return { supported: false, count: 0, bytes: 0, savedAt: null };
  let db: IDBDatabase | undefined;
  try {
    db = await openDatabase();
    const tx = db.transaction([LESSON_STORE, META_STORE], 'readonly');
    const count = await run(tx.objectStore(LESSON_STORE), tx.objectStore(LESSON_STORE).count());
    const meta = tx.objectStore(META_STORE);
    const savedAt = await run(meta, meta.get('savedAt'));
    const bytes = await run(meta, meta.get('bytes'));
    return {
      supported: true,
      count,
      bytes: (bytes as { value?: number } | undefined)?.value ?? 0,
      savedAt: (savedAt as { value?: number } | undefined)?.value ?? null,
    };
  } catch {
    return { supported: offlineSupported(), count: 0, bytes: 0, savedAt: null };
  } finally {
    db?.close();
  }
}

/**
 * Borra todo el contenido descargado. Se invoca al cerrar sesión y antes de
 * escribir una descarga de una cuenta distinta.
 */
export async function clearOffline(): Promise<void> {
  if (!offlineSupported()) return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(OFFLINE_DB);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

/** Descarta la descarga si pertenece a otra cuenta. */
export async function clearIfForeign(scope: string): Promise<void> {
  if (!offlineSupported()) return;
  let db: IDBDatabase | undefined;
  try {
    db = await openDatabase();
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const stored = (await run(store, store.get('scope'))) as { value?: string } | undefined;
    db.close();
    db = undefined;
    if (stored?.value && stored.value !== scope) await clearOffline();
  } catch {
    /* Sin almacén previo no hay nada que descartar. */
  } finally {
    db?.close();
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
