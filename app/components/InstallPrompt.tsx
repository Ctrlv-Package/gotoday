"use client";
import {useEffect, useState} from "react";
import {usePathname} from "next/navigation";
import {useT} from "./Lang";

// The browser's install offer, caught so the card can offer a real one-tap install.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
};

const DISMISS_KEY = "gotoday:install-dismissed";
const DISMISS_MS = 60 * 86400e3; // after a "not now", don't ask again for 60 days

/**
 * A small card inviting visitors to put GoToday on their home screen — most people never learn
 * the browser menu can do that. Android/desktop Chrome get a real Install button (the browser's
 * beforeinstallprompt); iPhones get the Share-sheet walkthrough, since iOS has no programmatic
 * prompt. Never shows when the app is already installed, on account/admin pages, or after a
 * recent dismissal.
 */
export default function InstallPrompt() {
  const {t} = useT();
  const path = usePathname();
  const [mode, setMode] = useState<"prompt" | "ios" | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as {standalone?: boolean}).standalone === true;
    if (standalone) return;
    try {
      const d = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (d && Date.now() - d < DISMISS_MS) return;
    } catch {}

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep Chrome's mini-infobar away; the card is the invitation
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => {
      setMode(null);
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari fires no install event: offer the manual steps, after a beat so it isn't the
    // first thing on the screen. (In-app browsers like Chrome/Firefox on iOS can't install.)
    const ua = window.navigator.userAgent;
    const iosSafari = /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios/i.test(ua);
    const timer = iosSafari ? window.setTimeout(() => setMode((m) => m ?? "ios"), 2500) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!mode || /^\/(admin|signin|me|manage|cal|create)/.test(path || "")) return null;

  const dismiss = () => {
    setMode(null);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setMode(null);
    else dismiss();
  };

  return (
    <div className="installCard" role="dialog" aria-label={t("Install GoToday")}>
      <img src="/icons/icon-192.png" alt="" width={44} height={44} />
      <div className="installTxt">
        <b>{mode === "ios" ? t("Get GoToday on your home screen") : t("GoToday, one tap away")}</b>
        <span>{mode === "ios"
          ? t("Tap Share ⬆, then \"Add to Home Screen\".")
          : t("Put GoToday on your home screen — no app store, no download.")}</span>
      </div>
      {mode === "prompt" && <button type="button" className="installBtn" onClick={install}>{t("Add it")}</button>}
      <button type="button" className="installX" onClick={dismiss} aria-label={t("Not now")}>✕</button>
    </div>
  );
}
