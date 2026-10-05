import { createClient } from "@supabase/supabase-js";

const fallbackStorage = new Map<string, string>();
let browserClient: ReturnType<typeof createClient<any, "public", "public">> | null = null;
let browserClientKey = "";

function browserStorage() {
  if (typeof window === "undefined") return null;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[name];
      const probe = `__photo_gallery_storage_probe_${name}`;
      storage.setItem(probe, "1");
      storage.removeItem(probe);
      return storage;
    } catch {
      // Some embedded browsers deny persistent storage; try the next option.
    }
  }
  return null;
}

const safeAuthStorage = {
  getItem(key: string) {
    try {
      const storage = browserStorage();
      const value = storage?.getItem(key);
      if (value !== null && value !== undefined) return value;
    } catch {
      // Fall through to the shared, tab-lifetime fallback.
    }
    return fallbackStorage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    try {
      const storage = browserStorage();
      if (storage) {
        storage.setItem(key, value);
        fallbackStorage.delete(key);
        return;
      }
    } catch {
      // Fall through to the shared, tab-lifetime fallback.
    }
    fallbackStorage.set(key, value);
  },
  removeItem(key: string) {
    try {
      browserStorage()?.removeItem(key);
    } catch {
      // Also clear the fallback when browser storage is unavailable.
    }
    fallbackStorage.delete(key);
  },
};

export function createAppSupabaseClient(url: string, anonKey: string) {
  if (typeof window !== "undefined" && browserClient && browserClientKey === `${url}:${anonKey}`) {
    return browserClient;
  }
  const client = createClient(url, anonKey, {
    auth: {
      storage: safeAuthStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  if (typeof window !== "undefined") {
    browserClient = client;
    browserClientKey = `${url}:${anonKey}`;
  }
  return client;
}
