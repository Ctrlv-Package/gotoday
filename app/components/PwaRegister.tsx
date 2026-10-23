"use client";
import {useEffect} from "react";

/** Registers the service worker (public/sw.js) that makes GoToday installable and offline-tolerant. */
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
