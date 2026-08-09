import type { CrearGastoInput, CrearIngresoInput } from "../api/types";

export type QueuedOperation =
  | { id: string; kind: "gasto"; payload: CrearGastoInput; createdAt: string; attempts: number; lastError?: string }
  | { id: string; kind: "ingreso"; payload: CrearIngresoInput; createdAt: string; attempts: number; lastError?: string };

const DB_NAME = "finnances-offline";
const STORE_NAME = "operations";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueOfflineOperation(operation: Omit<QueuedOperation, "createdAt" | "attempts">): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ ...operation, createdAt: new Date().toISOString(), attempts: 0 });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export async function listOfflineOperations(): Promise<QueuedOperation[]> {
  const db = await openDatabase();
  const operations = await new Promise<QueuedOperation[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as QueuedOperation[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return operations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeOfflineOperation(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export async function updateOfflineOperation(id: string, changes: Partial<QueuedOperation>): Promise<void> {
  const operation = (await listOfflineOperations()).find((item) => item.id === id);
  if (!operation) return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ ...operation, ...changes });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}
