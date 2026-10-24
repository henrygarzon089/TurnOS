"use client";

import { useEffect } from "react";

/** Registra el service worker (PWA, REQ-032.1 / REQ-011.6). Silencioso si no está disponible. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
