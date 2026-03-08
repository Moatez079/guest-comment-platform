import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "grc-offline-db";
const STORE_NAME = "pending-feedback";
const DB_VERSION = 1;

interface PendingFeedback {
  id: string;
  ship_id: string;
  room_number: string;
  language: string;
  ratings: Record<string, string | null>;
  comments: Record<string, string>;
  pdf_blob?: ArrayBuffer;
  pdf_path?: string;
  created_at: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFeedbackOffline(feedback: PendingFeedback): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(feedback);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingFeedback(): Promise<PendingFeedback[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removeFeedback(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncPendingFeedback(): Promise<number> {
  const pending = await getPendingFeedback();
  let synced = 0;

  for (const item of pending) {
    try {
      // Upload PDF if we have the blob
      let pdfUrl: string | null = null;
      if (item.pdf_blob && item.pdf_path) {
        const blob = new Blob([item.pdf_blob], { type: "application/pdf" });
        const { error: pdfErr } = await supabase.storage
          .from("feedback-files")
          .upload(item.pdf_path, blob, { contentType: "application/pdf" });
        if (!pdfErr) pdfUrl = item.pdf_path;
      }

      // Translate comments to English if not already English
      let translatedComments = { ...item.comments };
      if (item.language && item.language !== "en") {
        try {
          const { data, error: txErr } = await supabase.functions.invoke("translate-comments", {
            body: { comments: item.comments, language: item.language },
          });
          if (!txErr && data?.translated) {
            translatedComments = data.translated;
          }
        } catch {
          // Translation failed, will save original comments
        }
      }

      const { error } = await supabase.from("feedback").insert({
        ship_id: item.ship_id,
        room_number: item.room_number,
        language: item.language,
        ratings: item.ratings as any,
        comments: translatedComments as any,
        comments_original: item.comments as any,
        pdf_url: pdfUrl,
      });

      if (!error) {
        await removeFeedback(item.id);
        synced++;
      }
    } catch {
      // Will retry next time
    }
  }
  return synced;
}

// Auto-sync when coming back online
export function setupOnlineSync() {
  window.addEventListener("online", async () => {
    const count = await syncPendingFeedback();
    if (count > 0) {
      console.log(`[Offline Sync] Synced ${count} pending feedback(s)`);
    }
  });
}
