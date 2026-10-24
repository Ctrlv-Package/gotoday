import type {MetadataRoute} from "next";

// Tells search engines what to read and where the page list (sitemap) is. Private and admin pages stay out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/me", "/manage", "/signin", "/e/*/add", "/events/*/add"]}],
    sitemap: "https://www.mygotoday.com/sitemap.xml",
    host: "https://www.mygotoday.com",
  };
}
