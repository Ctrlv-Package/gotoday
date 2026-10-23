import type {MetadataRoute} from "next";

// Web app manifest: what makes GoToday installable from the browser ("Add to Home Screen")
// with its own icon and a full-screen, app-like launch — no app store involved.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GoToday — Find something worth doing near you",
    short_name: "GoToday",
    description: "Free and local things happening near you — library storytimes, park concerts, festivals, markets and more.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#7c3aed",
    icons: [
      {src: "/icons/icon-192.png", sizes: "192x192", type: "image/png"},
      {src: "/icons/icon-512.png", sizes: "512x512", type: "image/png"},
      {src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable"}
    ]
  };
}
