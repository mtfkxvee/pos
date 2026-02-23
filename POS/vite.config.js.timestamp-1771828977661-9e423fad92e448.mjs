// vite.config.js
import path from "node:path";
import { promises as fs } from "node:fs";
import vue from "file:///C:/Users/User/Documents/POSNext-develop/POSNext-develop/POS/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import frappeui from "file:///C:/Users/User/Documents/POSNext-develop/POSNext-develop/POS/node_modules/frappe-ui/vite/index.js";
import { defineConfig } from "file:///C:/Users/User/Documents/POSNext-develop/POSNext-develop/POS/node_modules/vite/dist/node/index.js";
import { VitePWA } from "file:///C:/Users/User/Documents/POSNext-develop/POSNext-develop/POS/node_modules/vite-plugin-pwa/dist/index.js";
import { viteStaticCopy } from "file:///C:/Users/User/Documents/POSNext-develop/POSNext-develop/POS/node_modules/vite-plugin-static-copy/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\User\\Documents\\POSNext-develop\\POSNext-develop\\POS";
var buildVersion = process.env.POS_NEXT_BUILD_VERSION || Date.now().toString();
var enableSourceMap = process.env.POS_NEXT_ENABLE_SOURCEMAP === "true";
function posNextBuildVersionPlugin(version) {
  return {
    name: "pos-next-build-version",
    apply: "build",
    async writeBundle() {
      const versionFile = path.resolve(__vite_injected_original_dirname, "../pos_next/public/pos/version.json");
      await fs.mkdir(path.dirname(versionFile), { recursive: true });
      await fs.writeFile(
        versionFile,
        JSON.stringify(
          {
            version,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            buildDate: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric"
            })
          },
          null,
          2
        ),
        "utf8"
      );
      console.log(`
\u2713 Build version written: ${version}`);
    }
  };
}
var vite_config_default = defineConfig({
  plugins: [
    posNextBuildVersionPlugin(buildVersion),
    frappeui({
      frappeProxy: true,
      jinjaBootData: true,
      lucideIcons: true,
      buildConfig: {
        indexHtmlPath: "../pos_next/www/pos.html",
        outDir: "../pos_next/public/pos",
        emptyOutDir: true,
        sourcemap: enableSourceMap
      }
    }),
    vue(),
    viteStaticCopy({
      targets: [
        {
          src: "src/workers",
          dest: "."
        }
      ]
    }),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["favicon.png", "icon.svg", "icon-maskable.svg"],
      manifest: {
        name: "POSNext",
        short_name: "POSNext",
        description: "Point of Sale system with real-time billing, stock management, and offline support",
        theme_color: "#4F46E5",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/pos",
        icons: [
          {
            src: "/assets/pos_next/pos/icon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/assets/pos_next/pos/icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/assets/pos_next/pos/icon-maskable.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "maskable"
          },
          {
            src: "/assets/pos_next/pos/icon-maskable.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // 3 MB
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/api/, /^\/app/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
                // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
                // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/assets\/pos_next\/pos\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "pos-assets-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30
                // 30 days
              }
            }
          },
          // Cache product images with StaleWhileRevalidate for better UX
          {
            urlPattern: /\/files\/.*\.(jpg|jpeg|png|gif|webp|svg)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "product-images-cache",
              expiration: {
                maxEntries: 200,
                // Cache up to 200 product images
                maxAgeSeconds: 60 * 60 * 24 * 7
                // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24
                // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: true,
        type: "module"
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    outDir: "../pos_next/public/pos",
    emptyOutDir: true,
    target: "es2015",
    sourcemap: enableSourceMap
  },
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        format: "es"
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "src"),
      "tailwind.config.js": path.resolve(__vite_injected_original_dirname, "tailwind.config.js")
    }
  },
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion)
  },
  optimizeDeps: {
    include: [
      "feather-icons",
      "showdown",
      "highlight.js/lib/core",
      "interactjs"
    ]
  },
  server: {
    allowedHosts: true,
    port: 8080,
    proxy: {
      "^/(app|api|assets|files|printview)": {
        target: "http://127.0.0.1:8000",
        ws: true,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "localhost",
        router: (req) => {
          const site_name = req.headers.host.split(":")[0];
          const isLocalhost = site_name === "localhost" || site_name === "127.0.0.1";
          const targetHost = isLocalhost ? "127.0.0.1" : site_name;
          return `http://${targetHost}:8000`;
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVc2VyXFxcXERvY3VtZW50c1xcXFxQT1NOZXh0LWRldmVsb3BcXFxcUE9TTmV4dC1kZXZlbG9wXFxcXFBPU1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcVXNlclxcXFxEb2N1bWVudHNcXFxcUE9TTmV4dC1kZXZlbG9wXFxcXFBPU05leHQtZGV2ZWxvcFxcXFxQT1NcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL1VzZXIvRG9jdW1lbnRzL1BPU05leHQtZGV2ZWxvcC9QT1NOZXh0LWRldmVsb3AvUE9TL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiXHJcbmltcG9ydCB7IHByb21pc2VzIGFzIGZzIH0gZnJvbSBcIm5vZGU6ZnNcIlxyXG5pbXBvcnQgdnVlIGZyb20gXCJAdml0ZWpzL3BsdWdpbi12dWVcIlxyXG5pbXBvcnQgZnJhcHBldWkgZnJvbSBcImZyYXBwZS11aS92aXRlXCJcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIlxyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSBcInZpdGUtcGx1Z2luLXB3YVwiXHJcbmltcG9ydCB7IHZpdGVTdGF0aWNDb3B5IH0gZnJvbSBcInZpdGUtcGx1Z2luLXN0YXRpYy1jb3B5XCJcclxuXHJcbi8vIEdldCBidWlsZCB2ZXJzaW9uIGZyb20gZW52aXJvbm1lbnQgb3IgdXNlIHRpbWVzdGFtcFxyXG5jb25zdCBidWlsZFZlcnNpb24gPSBwcm9jZXNzLmVudi5QT1NfTkVYVF9CVUlMRF9WRVJTSU9OIHx8IERhdGUubm93KCkudG9TdHJpbmcoKVxyXG5jb25zdCBlbmFibGVTb3VyY2VNYXAgPSBwcm9jZXNzLmVudi5QT1NfTkVYVF9FTkFCTEVfU09VUkNFTUFQID09PSBcInRydWVcIlxyXG5cclxuLyoqXHJcbiAqIFZpdGUgcGx1Z2luIHRvIHdyaXRlIGJ1aWxkIHZlcnNpb24gdG8gdmVyc2lvbi5qc29uIGZpbGVcclxuICogVGhpcyBlbmFibGVzIGNhY2hlIGJ1c3RpbmcgYW5kIHZlcnNpb24gdHJhY2tpbmdcclxuICovXHJcbmZ1bmN0aW9uIHBvc05leHRCdWlsZFZlcnNpb25QbHVnaW4odmVyc2lvbikge1xyXG5cdHJldHVybiB7XHJcblx0XHRuYW1lOiBcInBvcy1uZXh0LWJ1aWxkLXZlcnNpb25cIixcclxuXHRcdGFwcGx5OiBcImJ1aWxkXCIsXHJcblx0XHRhc3luYyB3cml0ZUJ1bmRsZSgpIHtcclxuXHRcdFx0Y29uc3QgdmVyc2lvbkZpbGUgPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uL3Bvc19uZXh0L3B1YmxpYy9wb3MvdmVyc2lvbi5qc29uXCIpXHJcblx0XHRcdGF3YWl0IGZzLm1rZGlyKHBhdGguZGlybmFtZSh2ZXJzaW9uRmlsZSksIHsgcmVjdXJzaXZlOiB0cnVlIH0pXHJcblx0XHRcdGF3YWl0IGZzLndyaXRlRmlsZShcclxuXHRcdFx0XHR2ZXJzaW9uRmlsZSxcclxuXHRcdFx0XHRKU09OLnN0cmluZ2lmeShcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dmVyc2lvbixcclxuXHRcdFx0XHRcdFx0dGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcblx0XHRcdFx0XHRcdGJ1aWxkRGF0ZTogbmV3IERhdGUoKS50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7XHJcblx0XHRcdFx0XHRcdFx0eWVhcjogXCJudW1lcmljXCIsXHJcblx0XHRcdFx0XHRcdFx0bW9udGg6IFwibG9uZ1wiLFxyXG5cdFx0XHRcdFx0XHRcdGRheTogXCJudW1lcmljXCIsXHJcblx0XHRcdFx0XHRcdH0pLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdG51bGwsXHJcblx0XHRcdFx0XHQyXHJcblx0XHRcdFx0KSxcclxuXHRcdFx0XHRcInV0ZjhcIlxyXG5cdFx0XHQpXHJcblx0XHRcdGNvbnNvbGUubG9nKGBcXG5cdTI3MTMgQnVpbGQgdmVyc2lvbiB3cml0dGVuOiAke3ZlcnNpb259YClcclxuXHRcdH0sXHJcblx0fVxyXG59XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG5cdHBsdWdpbnM6IFtcclxuXHRcdHBvc05leHRCdWlsZFZlcnNpb25QbHVnaW4oYnVpbGRWZXJzaW9uKSxcclxuXHRcdGZyYXBwZXVpKHtcclxuXHRcdFx0ZnJhcHBlUHJveHk6IHRydWUsXHJcblx0XHRcdGppbmphQm9vdERhdGE6IHRydWUsXHJcblx0XHRcdGx1Y2lkZUljb25zOiB0cnVlLFxyXG5cdFx0XHRidWlsZENvbmZpZzoge1xyXG5cdFx0XHRcdGluZGV4SHRtbFBhdGg6IFwiLi4vcG9zX25leHQvd3d3L3Bvcy5odG1sXCIsXHJcblx0XHRcdFx0b3V0RGlyOiBcIi4uL3Bvc19uZXh0L3B1YmxpYy9wb3NcIixcclxuXHRcdFx0XHRlbXB0eU91dERpcjogdHJ1ZSxcclxuXHRcdFx0XHRzb3VyY2VtYXA6IGVuYWJsZVNvdXJjZU1hcCxcclxuXHRcdFx0fSxcclxuXHRcdH0pLFxyXG5cdFx0dnVlKCksXHJcblx0XHR2aXRlU3RhdGljQ29weSh7XHJcblx0XHRcdHRhcmdldHM6IFtcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRzcmM6IFwic3JjL3dvcmtlcnNcIixcclxuXHRcdFx0XHRcdGRlc3Q6IFwiLlwiLFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdF0sXHJcblx0XHR9KSxcclxuXHRcdFZpdGVQV0Eoe1xyXG5cdFx0XHRyZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxyXG5cdFx0XHRpbmplY3RSZWdpc3RlcjogbnVsbCxcclxuXHRcdFx0aW5jbHVkZUFzc2V0czogW1wiZmF2aWNvbi5wbmdcIiwgXCJpY29uLnN2Z1wiLCBcImljb24tbWFza2FibGUuc3ZnXCJdLFxyXG5cdFx0XHRtYW5pZmVzdDoge1xyXG5cdFx0XHRcdG5hbWU6IFwiUE9TTmV4dFwiLFxyXG5cdFx0XHRcdHNob3J0X25hbWU6IFwiUE9TTmV4dFwiLFxyXG5cdFx0XHRcdGRlc2NyaXB0aW9uOlxyXG5cdFx0XHRcdFx0XCJQb2ludCBvZiBTYWxlIHN5c3RlbSB3aXRoIHJlYWwtdGltZSBiaWxsaW5nLCBzdG9jayBtYW5hZ2VtZW50LCBhbmQgb2ZmbGluZSBzdXBwb3J0XCIsXHJcblx0XHRcdFx0dGhlbWVfY29sb3I6IFwiIzRGNDZFNVwiLFxyXG5cdFx0XHRcdGJhY2tncm91bmRfY29sb3I6IFwiI2ZmZmZmZlwiLFxyXG5cdFx0XHRcdGRpc3BsYXk6IFwic3RhbmRhbG9uZVwiLFxyXG5cdFx0XHRcdHNjb3BlOiBcIi9cIixcclxuXHRcdFx0XHRzdGFydF91cmw6IFwiL3Bvc1wiLFxyXG5cdFx0XHRcdGljb25zOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHNyYzogXCIvYXNzZXRzL3Bvc19uZXh0L3Bvcy9pY29uLnN2Z1wiLFxyXG5cdFx0XHRcdFx0XHRzaXplczogXCIxOTJ4MTkyXCIsXHJcblx0XHRcdFx0XHRcdHR5cGU6IFwiaW1hZ2Uvc3ZnK3htbFwiLFxyXG5cdFx0XHRcdFx0XHRwdXJwb3NlOiBcImFueVwiLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0c3JjOiBcIi9hc3NldHMvcG9zX25leHQvcG9zL2ljb24uc3ZnXCIsXHJcblx0XHRcdFx0XHRcdHNpemVzOiBcIjUxMng1MTJcIixcclxuXHRcdFx0XHRcdFx0dHlwZTogXCJpbWFnZS9zdmcreG1sXCIsXHJcblx0XHRcdFx0XHRcdHB1cnBvc2U6IFwiYW55XCIsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRzcmM6IFwiL2Fzc2V0cy9wb3NfbmV4dC9wb3MvaWNvbi1tYXNrYWJsZS5zdmdcIixcclxuXHRcdFx0XHRcdFx0c2l6ZXM6IFwiMTkyeDE5MlwiLFxyXG5cdFx0XHRcdFx0XHR0eXBlOiBcImltYWdlL3N2Zyt4bWxcIixcclxuXHRcdFx0XHRcdFx0cHVycG9zZTogXCJtYXNrYWJsZVwiLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0c3JjOiBcIi9hc3NldHMvcG9zX25leHQvcG9zL2ljb24tbWFza2FibGUuc3ZnXCIsXHJcblx0XHRcdFx0XHRcdHNpemVzOiBcIjUxMng1MTJcIixcclxuXHRcdFx0XHRcdFx0dHlwZTogXCJpbWFnZS9zdmcreG1sXCIsXHJcblx0XHRcdFx0XHRcdHB1cnBvc2U6IFwibWFza2FibGVcIixcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XSxcclxuXHRcdFx0fSxcclxuXHRcdFx0d29ya2JveDoge1xyXG5cdFx0XHRcdGdsb2JQYXR0ZXJuczogW1wiKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZix3b2ZmMn1cIl0sXHJcblx0XHRcdFx0bWF4aW11bUZpbGVTaXplVG9DYWNoZUluQnl0ZXM6IDQgKiAxMDI0ICogMTAyNCwgLy8gMyBNQlxyXG5cdFx0XHRcdG5hdmlnYXRlRmFsbGJhY2s6IG51bGwsXHJcblx0XHRcdFx0bmF2aWdhdGVGYWxsYmFja0RlbnlsaXN0OiBbL15cXC9hcGkvLCAvXlxcL2FwcC9dLFxyXG5cdFx0XHRcdHJ1bnRpbWVDYWNoaW5nOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvZm9udHNcXC5nb29nbGVhcGlzXFwuY29tXFwvLiovaSxcclxuXHRcdFx0XHRcdFx0aGFuZGxlcjogXCJDYWNoZUZpcnN0XCIsXHJcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcclxuXHRcdFx0XHRcdFx0XHRjYWNoZU5hbWU6IFwiZ29vZ2xlLWZvbnRzLWNhY2hlXCIsXHJcblx0XHRcdFx0XHRcdFx0ZXhwaXJhdGlvbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0bWF4RW50cmllczogMTAsXHJcblx0XHRcdFx0XHRcdFx0XHRtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUsIC8vIDEgeWVhclxyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0Y2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuXHRcdFx0XHRcdFx0XHRcdHN0YXR1c2VzOiBbMCwgMjAwXSxcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdzdGF0aWNcXC5jb21cXC8uKi9pLFxyXG5cdFx0XHRcdFx0XHRoYW5kbGVyOiBcIkNhY2hlRmlyc3RcIixcclxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xyXG5cdFx0XHRcdFx0XHRcdGNhY2hlTmFtZTogXCJnc3RhdGljLWZvbnRzLWNhY2hlXCIsXHJcblx0XHRcdFx0XHRcdFx0ZXhwaXJhdGlvbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0bWF4RW50cmllczogMTAsXHJcblx0XHRcdFx0XHRcdFx0XHRtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUsIC8vIDEgeWVhclxyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0Y2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuXHRcdFx0XHRcdFx0XHRcdHN0YXR1c2VzOiBbMCwgMjAwXSxcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dXJsUGF0dGVybjogL1xcL2Fzc2V0c1xcL3Bvc19uZXh0XFwvcG9zXFwvLiovaSxcclxuXHRcdFx0XHRcdFx0aGFuZGxlcjogXCJDYWNoZUZpcnN0XCIsXHJcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcclxuXHRcdFx0XHRcdFx0XHRjYWNoZU5hbWU6IFwicG9zLWFzc2V0cy1jYWNoZVwiLFxyXG5cdFx0XHRcdFx0XHRcdGV4cGlyYXRpb246IHtcclxuXHRcdFx0XHRcdFx0XHRcdG1heEVudHJpZXM6IDUwMCxcclxuXHRcdFx0XHRcdFx0XHRcdG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDMwLCAvLyAzMCBkYXlzXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHQvLyBDYWNoZSBwcm9kdWN0IGltYWdlcyB3aXRoIFN0YWxlV2hpbGVSZXZhbGlkYXRlIGZvciBiZXR0ZXIgVVhcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dXJsUGF0dGVybjogL1xcL2ZpbGVzXFwvLipcXC4oanBnfGpwZWd8cG5nfGdpZnx3ZWJwfHN2ZykkL2ksXHJcblx0XHRcdFx0XHRcdGhhbmRsZXI6IFwiU3RhbGVXaGlsZVJldmFsaWRhdGVcIixcclxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xyXG5cdFx0XHRcdFx0XHRcdGNhY2hlTmFtZTogXCJwcm9kdWN0LWltYWdlcy1jYWNoZVwiLFxyXG5cdFx0XHRcdFx0XHRcdGV4cGlyYXRpb246IHtcclxuXHRcdFx0XHRcdFx0XHRcdG1heEVudHJpZXM6IDIwMCwgLy8gQ2FjaGUgdXAgdG8gMjAwIHByb2R1Y3QgaW1hZ2VzXHJcblx0XHRcdFx0XHRcdFx0XHRtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiA3LCAvLyA3IGRheXNcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdGNhY2hlYWJsZVJlc3BvbnNlOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRzdGF0dXNlczogWzAsIDIwMF0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9cXC9hcGlcXC8uKi9pLFxyXG5cdFx0XHRcdFx0XHRoYW5kbGVyOiBcIk5ldHdvcmtGaXJzdFwiLFxyXG5cdFx0XHRcdFx0XHRvcHRpb25zOiB7XHJcblx0XHRcdFx0XHRcdFx0Y2FjaGVOYW1lOiBcImFwaS1jYWNoZVwiLFxyXG5cdFx0XHRcdFx0XHRcdG5ldHdvcmtUaW1lb3V0U2Vjb25kczogMTAsXHJcblx0XHRcdFx0XHRcdFx0ZXhwaXJhdGlvbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0bWF4RW50cmllczogMTAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0bWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0LCAvLyAyNCBob3Vyc1xyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0Y2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuXHRcdFx0XHRcdFx0XHRcdHN0YXR1c2VzOiBbMCwgMjAwXSxcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRdLFxyXG5cdFx0XHRcdGNsZWFudXBPdXRkYXRlZENhY2hlczogdHJ1ZSxcclxuXHRcdFx0XHRza2lwV2FpdGluZzogdHJ1ZSxcclxuXHRcdFx0XHRjbGllbnRzQ2xhaW06IHRydWUsXHJcblx0XHRcdH0sXHJcblx0XHRcdGRldk9wdGlvbnM6IHtcclxuXHRcdFx0XHRlbmFibGVkOiB0cnVlLFxyXG5cdFx0XHRcdHR5cGU6IFwibW9kdWxlXCIsXHJcblx0XHRcdH0sXHJcblx0XHR9KSxcclxuXHRdLFxyXG5cdGJ1aWxkOiB7XHJcblx0XHRjaHVua1NpemVXYXJuaW5nTGltaXQ6IDE1MDAsXHJcblx0XHRvdXREaXI6IFwiLi4vcG9zX25leHQvcHVibGljL3Bvc1wiLFxyXG5cdFx0ZW1wdHlPdXREaXI6IHRydWUsXHJcblx0XHR0YXJnZXQ6IFwiZXMyMDE1XCIsXHJcblx0XHRzb3VyY2VtYXA6IGVuYWJsZVNvdXJjZU1hcCxcclxuXHR9LFxyXG5cdHdvcmtlcjoge1xyXG5cdFx0Zm9ybWF0OiBcImVzXCIsXHJcblx0XHRyb2xsdXBPcHRpb25zOiB7XHJcblx0XHRcdG91dHB1dDoge1xyXG5cdFx0XHRcdGZvcm1hdDogXCJlc1wiLFxyXG5cdFx0XHR9LFxyXG5cdFx0fSxcclxuXHR9LFxyXG5cdHJlc29sdmU6IHtcclxuXHRcdGFsaWFzOiB7XHJcblx0XHRcdFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInNyY1wiKSxcclxuXHRcdFx0XCJ0YWlsd2luZC5jb25maWcuanNcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJ0YWlsd2luZC5jb25maWcuanNcIiksXHJcblx0XHR9LFxyXG5cdH0sXHJcblx0ZGVmaW5lOiB7XHJcblx0XHRfX0JVSUxEX1ZFUlNJT05fXzogSlNPTi5zdHJpbmdpZnkoYnVpbGRWZXJzaW9uKSxcclxuXHR9LFxyXG5cdG9wdGltaXplRGVwczoge1xyXG5cdFx0aW5jbHVkZTogW1xyXG5cdFx0XHRcImZlYXRoZXItaWNvbnNcIixcclxuXHRcdFx0XCJzaG93ZG93blwiLFxyXG5cdFx0XHRcImhpZ2hsaWdodC5qcy9saWIvY29yZVwiLFxyXG5cdFx0XHRcImludGVyYWN0anNcIixcclxuXHRcdF0sXHJcblx0fSxcclxuXHRzZXJ2ZXI6IHtcclxuXHRcdGFsbG93ZWRIb3N0czogdHJ1ZSxcclxuXHRcdHBvcnQ6IDgwODAsXHJcblx0XHRwcm94eToge1xyXG5cdFx0XHRcIl4vKGFwcHxhcGl8YXNzZXRzfGZpbGVzfHByaW50dmlldylcIjoge1xyXG5cdFx0XHRcdHRhcmdldDogXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIixcclxuXHRcdFx0XHR3czogdHJ1ZSxcclxuXHRcdFx0XHRjaGFuZ2VPcmlnaW46IHRydWUsXHJcblx0XHRcdFx0c2VjdXJlOiBmYWxzZSxcclxuXHRcdFx0XHRjb29raWVEb21haW5SZXdyaXRlOiBcImxvY2FsaG9zdFwiLFxyXG5cdFx0XHRcdHJvdXRlcjogKHJlcSkgPT4ge1xyXG5cdFx0XHRcdFx0Y29uc3Qgc2l0ZV9uYW1lID0gcmVxLmhlYWRlcnMuaG9zdC5zcGxpdChcIjpcIilbMF1cclxuXHRcdFx0XHRcdC8vIFN1cHBvcnQgYm90aCBsb2NhbGhvc3QgYW5kIDEyNy4wLjAuMVxyXG5cdFx0XHRcdFx0Y29uc3QgaXNMb2NhbGhvc3QgPVxyXG5cdFx0XHRcdFx0XHRzaXRlX25hbWUgPT09IFwibG9jYWxob3N0XCIgfHwgc2l0ZV9uYW1lID09PSBcIjEyNy4wLjAuMVwiXHJcblx0XHRcdFx0XHRjb25zdCB0YXJnZXRIb3N0ID0gaXNMb2NhbGhvc3QgPyBcIjEyNy4wLjAuMVwiIDogc2l0ZV9uYW1lXHJcblx0XHRcdFx0XHRyZXR1cm4gYGh0dHA6Ly8ke3RhcmdldEhvc3R9OjgwMDBgXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdH0sXHJcblx0fSxcclxufSlcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFpWCxPQUFPLFVBQVU7QUFDbFksU0FBUyxZQUFZLFVBQVU7QUFDL0IsT0FBTyxTQUFTO0FBQ2hCLE9BQU8sY0FBYztBQUNyQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxzQkFBc0I7QUFOL0IsSUFBTSxtQ0FBbUM7QUFTekMsSUFBTSxlQUFlLFFBQVEsSUFBSSwwQkFBMEIsS0FBSyxJQUFJLEVBQUUsU0FBUztBQUMvRSxJQUFNLGtCQUFrQixRQUFRLElBQUksOEJBQThCO0FBTWxFLFNBQVMsMEJBQTBCLFNBQVM7QUFDM0MsU0FBTztBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsTUFBTSxjQUFjO0FBQ25CLFlBQU0sY0FBYyxLQUFLLFFBQVEsa0NBQVcscUNBQXFDO0FBQ2pGLFlBQU0sR0FBRyxNQUFNLEtBQUssUUFBUSxXQUFXLEdBQUcsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUM3RCxZQUFNLEdBQUc7QUFBQSxRQUNSO0FBQUEsUUFDQSxLQUFLO0FBQUEsVUFDSjtBQUFBLFlBQ0M7QUFB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
