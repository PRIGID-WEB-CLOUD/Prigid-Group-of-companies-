import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT || "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "seller-slash-redirect",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || "";
          let parsedUrl;
          try {
            parsedUrl = new URL(url, "http://localhost");
          } catch {
            return next();
          }
          
          const pathname = parsedUrl.pathname;
          const isPreview = parsedUrl.searchParams.has("preview") || parsedUrl.searchParams.get("store") === "true";

          if (pathname.startsWith("/boutique/") || pathname.startsWith("/store/")) {
            const parts = pathname.split("/").filter(Boolean);
            const slug = parts[1];
            if (slug) {
              res.setHeader("Set-Cookie", `prigid_store_slug=${slug}; Path=/; Max-Age=86400; SameSite=Lax`);
            }
          }

          if (pathname === "/seller" || pathname.startsWith("/seller?")) {
            const query = url.includes("?") ? url.slice(url.indexOf("?")) : "";
            res.writeHead(302, { Location: `/seller/${query}` });
            res.end();
            return;
          }

          if (pathname === "/" || pathname === "/platform") {
            if (isPreview) {
              return next();
            }
            try {
              const fs = await import("fs");
              const landingPath = path.resolve(import.meta.dirname, "..", "prigid-landing/index.html");
              if (fs.existsSync(landingPath)) {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(fs.readFileSync(landingPath, "utf-8"));
                return;
              }
            } catch (e) {
              console.error("Failed to serve landing page in dev server:", e);
            }
          }
          next();
        });
      },
    },
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    fs: {
      strict: false,
    },
    proxy: {
      "/sitemap.xml": {
        target: "http://127.0.0.1:5001",
        changeOrigin: true,
      },
      "/robots.txt": {
        target: "http://127.0.0.1:5001",
        changeOrigin: true,
      },
      "/api": {
        target: "http://127.0.0.1:5001",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (_err, _req, res) => {
            if (res && "writeHead" in res && !res.headersSent) {
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Backend API warming up. Please retry." }));
            }
          });
        },
      },
      "/seller": {
        target: "http://127.0.0.1:3005",
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on("error", (_err, _req, res) => {
            if (res && "writeHead" in res && !res.headersSent) {
              res.writeHead(503, { "Content-Type": "text/html" });
              res.end("Seller service warming up. Please reload in a moment.");
            }
          });
        },
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
