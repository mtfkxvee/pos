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
      const versionFile = path.resolve(
        __vite_injected_original_dirname,
        "../pos_next/public/pos/version.json"
      );
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVc2VyXFxcXERvY3VtZW50c1xcXFxQT1NOZXh0LWRldmVsb3BcXFxcUE9TTmV4dC1kZXZlbG9wXFxcXFBPU1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcVXNlclxcXFxEb2N1bWVudHNcXFxcUE9TTmV4dC1kZXZlbG9wXFxcXFBPU05leHQtZGV2ZWxvcFxcXFxQT1NcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL1VzZXIvRG9jdW1lbnRzL1BPU05leHQtZGV2ZWxvcC9QT1NOZXh0LWRldmVsb3AvUE9TL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiXG5pbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gXCJub2RlOmZzXCJcbmltcG9ydCB2dWUgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXZ1ZVwiXG5pbXBvcnQgZnJhcHBldWkgZnJvbSBcImZyYXBwZS11aS92aXRlXCJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tIFwidml0ZS1wbHVnaW4tcHdhXCJcbmltcG9ydCB7IHZpdGVTdGF0aWNDb3B5IH0gZnJvbSBcInZpdGUtcGx1Z2luLXN0YXRpYy1jb3B5XCJcblxuLy8gR2V0IGJ1aWxkIHZlcnNpb24gZnJvbSBlbnZpcm9ubWVudCBvciB1c2UgdGltZXN0YW1wXG5jb25zdCBidWlsZFZlcnNpb24gPSBwcm9jZXNzLmVudi5QT1NfTkVYVF9CVUlMRF9WRVJTSU9OIHx8IERhdGUubm93KCkudG9TdHJpbmcoKVxuY29uc3QgZW5hYmxlU291cmNlTWFwID0gcHJvY2Vzcy5lbnYuUE9TX05FWFRfRU5BQkxFX1NPVVJDRU1BUCA9PT0gXCJ0cnVlXCJcblxuLyoqXG4gKiBWaXRlIHBsdWdpbiB0byB3cml0ZSBidWlsZCB2ZXJzaW9uIHRvIHZlcnNpb24uanNvbiBmaWxlXG4gKiBUaGlzIGVuYWJsZXMgY2FjaGUgYnVzdGluZyBhbmQgdmVyc2lvbiB0cmFja2luZ1xuICovXG5mdW5jdGlvbiBwb3NOZXh0QnVpbGRWZXJzaW9uUGx1Z2luKHZlcnNpb24pIHtcblx0cmV0dXJuIHtcblx0XHRuYW1lOiBcInBvcy1uZXh0LWJ1aWxkLXZlcnNpb25cIixcblx0XHRhcHBseTogXCJidWlsZFwiLFxuXHRcdGFzeW5jIHdyaXRlQnVuZGxlKCkge1xuXHRcdFx0Y29uc3QgdmVyc2lvbkZpbGUgPSBwYXRoLnJlc29sdmUoXG5cdFx0XHRcdF9fZGlybmFtZSxcblx0XHRcdFx0XCIuLi9wb3NfbmV4dC9wdWJsaWMvcG9zL3ZlcnNpb24uanNvblwiLFxuXHRcdFx0KVxuXHRcdFx0YXdhaXQgZnMubWtkaXIocGF0aC5kaXJuYW1lKHZlcnNpb25GaWxlKSwgeyByZWN1cnNpdmU6IHRydWUgfSlcblx0XHRcdGF3YWl0IGZzLndyaXRlRmlsZShcblx0XHRcdFx0dmVyc2lvbkZpbGUsXG5cdFx0XHRcdEpTT04uc3RyaW5naWZ5KFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHZlcnNpb24sXG5cdFx0XHRcdFx0XHR0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcblx0XHRcdFx0XHRcdGJ1aWxkRGF0ZTogbmV3IERhdGUoKS50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7XG5cdFx0XHRcdFx0XHRcdHllYXI6IFwibnVtZXJpY1wiLFxuXHRcdFx0XHRcdFx0XHRtb250aDogXCJsb25nXCIsXG5cdFx0XHRcdFx0XHRcdGRheTogXCJudW1lcmljXCIsXG5cdFx0XHRcdFx0XHR9KSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdG51bGwsXG5cdFx0XHRcdFx0Mixcblx0XHRcdFx0KSxcblx0XHRcdFx0XCJ1dGY4XCIsXG5cdFx0XHQpXG5cdFx0XHRjb25zb2xlLmxvZyhgXFxuXHUyNzEzIEJ1aWxkIHZlcnNpb24gd3JpdHRlbjogJHt2ZXJzaW9ufWApXG5cdFx0fSxcblx0fVxufVxuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcblx0cGx1Z2luczogW1xuXHRcdHBvc05leHRCdWlsZFZlcnNpb25QbHVnaW4oYnVpbGRWZXJzaW9uKSxcblx0XHRmcmFwcGV1aSh7XG5cdFx0XHRmcmFwcGVQcm94eTogdHJ1ZSxcblx0XHRcdGppbmphQm9vdERhdGE6IHRydWUsXG5cdFx0XHRsdWNpZGVJY29uczogdHJ1ZSxcblx0XHRcdGJ1aWxkQ29uZmlnOiB7XG5cdFx0XHRcdGluZGV4SHRtbFBhdGg6IFwiLi4vcG9zX25leHQvd3d3L3Bvcy5odG1sXCIsXG5cdFx0XHRcdG91dERpcjogXCIuLi9wb3NfbmV4dC9wdWJsaWMvcG9zXCIsXG5cdFx0XHRcdGVtcHR5T3V0RGlyOiB0cnVlLFxuXHRcdFx0XHRzb3VyY2VtYXA6IGVuYWJsZVNvdXJjZU1hcCxcblx0XHRcdH0sXG5cdFx0fSksXG5cdFx0dnVlKCksXG5cdFx0dml0ZVN0YXRpY0NvcHkoe1xuXHRcdFx0dGFyZ2V0czogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0c3JjOiBcInNyYy93b3JrZXJzXCIsXG5cdFx0XHRcdFx0ZGVzdDogXCIuXCIsXG5cdFx0XHRcdH0sXG5cdFx0XHRdLFxuXHRcdH0pLFxuXHRcdFZpdGVQV0Eoe1xuXHRcdFx0cmVnaXN0ZXJUeXBlOiBcImF1dG9VcGRhdGVcIixcblx0XHRcdGluamVjdFJlZ2lzdGVyOiBudWxsLFxuXHRcdFx0aW5jbHVkZUFzc2V0czogW1wiZmF2aWNvbi5wbmdcIiwgXCJpY29uLnN2Z1wiLCBcImljb24tbWFza2FibGUuc3ZnXCJdLFxuXHRcdFx0bWFuaWZlc3Q6IHtcblx0XHRcdFx0bmFtZTogXCJQT1NOZXh0XCIsXG5cdFx0XHRcdHNob3J0X25hbWU6IFwiUE9TTmV4dFwiLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjpcblx0XHRcdFx0XHRcIlBvaW50IG9mIFNhbGUgc3lzdGVtIHdpdGggcmVhbC10aW1lIGJpbGxpbmcsIHN0b2NrIG1hbmFnZW1lbnQsIGFuZCBvZmZsaW5lIHN1cHBvcnRcIixcblx0XHRcdFx0dGhlbWVfY29sb3I6IFwiIzRGNDZFNVwiLFxuXHRcdFx0XHRiYWNrZ3JvdW5kX2NvbG9yOiBcIiNmZmZmZmZcIixcblx0XHRcdFx0ZGlzcGxheTogXCJzdGFuZGFsb25lXCIsXG5cdFx0XHRcdHNjb3BlOiBcIi9cIixcblx0XHRcdFx0c3RhcnRfdXJsOiBcIi9wb3NcIixcblx0XHRcdFx0aWNvbnM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzcmM6IFwiL2Fzc2V0cy9wb3NfbmV4dC9wb3MvaWNvbi5zdmdcIixcblx0XHRcdFx0XHRcdHNpemVzOiBcIjE5MngxOTJcIixcblx0XHRcdFx0XHRcdHR5cGU6IFwiaW1hZ2Uvc3ZnK3htbFwiLFxuXHRcdFx0XHRcdFx0cHVycG9zZTogXCJhbnlcIixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNyYzogXCIvYXNzZXRzL3Bvc19uZXh0L3Bvcy9pY29uLnN2Z1wiLFxuXHRcdFx0XHRcdFx0c2l6ZXM6IFwiNTEyeDUxMlwiLFxuXHRcdFx0XHRcdFx0dHlwZTogXCJpbWFnZS9zdmcreG1sXCIsXG5cdFx0XHRcdFx0XHRwdXJwb3NlOiBcImFueVwiLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c3JjOiBcIi9hc3NldHMvcG9zX25leHQvcG9zL2ljb24tbWFza2FibGUuc3ZnXCIsXG5cdFx0XHRcdFx0XHRzaXplczogXCIxOTJ4MTkyXCIsXG5cdFx0XHRcdFx0XHR0eXBlOiBcImltYWdlL3N2Zyt4bWxcIixcblx0XHRcdFx0XHRcdHB1cnBvc2U6IFwibWFza2FibGVcIixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNyYzogXCIvYXNzZXRzL3Bvc19uZXh0L3Bvcy9pY29uLW1hc2thYmxlLnN2Z1wiLFxuXHRcdFx0XHRcdFx0c2l6ZXM6IFwiNTEyeDUxMlwiLFxuXHRcdFx0XHRcdFx0dHlwZTogXCJpbWFnZS9zdmcreG1sXCIsXG5cdFx0XHRcdFx0XHRwdXJwb3NlOiBcIm1hc2thYmxlXCIsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH0sXG5cdFx0XHR3b3JrYm94OiB7XG5cdFx0XHRcdGdsb2JQYXR0ZXJuczogW1wiKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZix3b2ZmMn1cIl0sXG5cdFx0XHRcdG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiA0ICogMTAyNCAqIDEwMjQsIC8vIDMgTUJcblx0XHRcdFx0bmF2aWdhdGVGYWxsYmFjazogbnVsbCxcblx0XHRcdFx0bmF2aWdhdGVGYWxsYmFja0RlbnlsaXN0OiBbL15cXC9hcGkvLCAvXlxcL2FwcC9dLFxuXHRcdFx0XHRydW50aW1lQ2FjaGluZzogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvZm9udHNcXC5nb29nbGVhcGlzXFwuY29tXFwvLiovaSxcblx0XHRcdFx0XHRcdGhhbmRsZXI6IFwiQ2FjaGVGaXJzdFwiLFxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRjYWNoZU5hbWU6IFwiZ29vZ2xlLWZvbnRzLWNhY2hlXCIsXG5cdFx0XHRcdFx0XHRcdGV4cGlyYXRpb246IHtcblx0XHRcdFx0XHRcdFx0XHRtYXhFbnRyaWVzOiAxMCxcblx0XHRcdFx0XHRcdFx0XHRtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUsIC8vIDEgeWVhclxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRjYWNoZWFibGVSZXNwb25zZToge1xuXHRcdFx0XHRcdFx0XHRcdHN0YXR1c2VzOiBbMCwgMjAwXSxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2ZvbnRzXFwuZ3N0YXRpY1xcLmNvbVxcLy4qL2ksXG5cdFx0XHRcdFx0XHRoYW5kbGVyOiBcIkNhY2hlRmlyc3RcIixcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0Y2FjaGVOYW1lOiBcImdzdGF0aWMtZm9udHMtY2FjaGVcIixcblx0XHRcdFx0XHRcdFx0ZXhwaXJhdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRcdG1heEVudHJpZXM6IDEwLFxuXHRcdFx0XHRcdFx0XHRcdG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSwgLy8gMSB5ZWFyXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGNhY2hlYWJsZVJlc3BvbnNlOiB7XG5cdFx0XHRcdFx0XHRcdFx0c3RhdHVzZXM6IFswLCAyMDBdLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9cXC9hc3NldHNcXC9wb3NfbmV4dFxcL3Bvc1xcLy4qL2ksXG5cdFx0XHRcdFx0XHRoYW5kbGVyOiBcIkNhY2hlRmlyc3RcIixcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0Y2FjaGVOYW1lOiBcInBvcy1hc3NldHMtY2FjaGVcIixcblx0XHRcdFx0XHRcdFx0ZXhwaXJhdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRcdG1heEVudHJpZXM6IDUwMCxcblx0XHRcdFx0XHRcdFx0XHRtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzMCwgLy8gMzAgZGF5c1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdC8vIENhY2hlIHByb2R1Y3QgaW1hZ2VzIHdpdGggU3RhbGVXaGlsZVJldmFsaWRhdGUgZm9yIGJldHRlciBVWFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9cXC9maWxlc1xcLy4qXFwuKGpwZ3xqcGVnfHBuZ3xnaWZ8d2VicHxzdmcpJC9pLFxuXHRcdFx0XHRcdFx0aGFuZGxlcjogXCJTdGFsZVdoaWxlUmV2YWxpZGF0ZVwiLFxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRjYWNoZU5hbWU6IFwicHJvZHVjdC1pbWFnZXMtY2FjaGVcIixcblx0XHRcdFx0XHRcdFx0ZXhwaXJhdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRcdG1heEVudHJpZXM6IDIwMCwgLy8gQ2FjaGUgdXAgdG8gMjAwIHByb2R1Y3QgaW1hZ2VzXG5cdFx0XHRcdFx0XHRcdFx0bWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogNywgLy8gNyBkYXlzXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGNhY2hlYWJsZVJlc3BvbnNlOiB7XG5cdFx0XHRcdFx0XHRcdFx0c3RhdHVzZXM6IFswLCAyMDBdLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9cXC9hcGlcXC8uKi9pLFxuXHRcdFx0XHRcdFx0aGFuZGxlcjogXCJOZXR3b3JrRmlyc3RcIixcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0Y2FjaGVOYW1lOiBcImFwaS1jYWNoZVwiLFxuXHRcdFx0XHRcdFx0XHRuZXR3b3JrVGltZW91dFNlY29uZHM6IDEwLFxuXHRcdFx0XHRcdFx0XHRleHBpcmF0aW9uOiB7XG5cdFx0XHRcdFx0XHRcdFx0bWF4RW50cmllczogMTAwLFxuXHRcdFx0XHRcdFx0XHRcdG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCwgLy8gMjQgaG91cnNcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0Y2FjaGVhYmxlUmVzcG9uc2U6IHtcblx0XHRcdFx0XHRcdFx0XHRzdGF0dXNlczogWzAsIDIwMF0sXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF0sXG5cdFx0XHRcdGNsZWFudXBPdXRkYXRlZENhY2hlczogdHJ1ZSxcblx0XHRcdFx0c2tpcFdhaXRpbmc6IHRydWUsXG5cdFx0XHRcdGNsaWVudHNDbGFpbTogdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRkZXZPcHRpb25zOiB7XG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdHR5cGU6IFwibW9kdWxlXCIsXG5cdFx0XHR9LFxuXHRcdH0pLFxuXHRdLFxuXHRidWlsZDoge1xuXHRcdGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTUwMCxcblx0XHRvdXREaXI6IFwiLi4vcG9zX25leHQvcHVibGljL3Bvc1wiLFxuXHRcdGVtcHR5T3V0RGlyOiB0cnVlLFxuXHRcdHRhcmdldDogXCJlczIwMTVcIixcblx0XHRzb3VyY2VtYXA6IGVuYWJsZVNvdXJjZU1hcCxcblx0fSxcblx0d29ya2VyOiB7XG5cdFx0Zm9ybWF0OiBcImVzXCIsXG5cdFx0cm9sbHVwT3B0aW9uczoge1xuXHRcdFx0b3V0cHV0OiB7XG5cdFx0XHRcdGZvcm1hdDogXCJlc1wiLFxuXHRcdFx0fSxcblx0XHR9LFxuXHR9LFxuXHRyZXNvbHZlOiB7XG5cdFx0YWxpYXM6IHtcblx0XHRcdFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInNyY1wiKSxcblx0XHRcdFwidGFpbHdpbmQuY29uZmlnLmpzXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwidGFpbHdpbmQuY29uZmlnLmpzXCIpLFxuXHRcdH0sXG5cdH0sXG5cdGRlZmluZToge1xuXHRcdF9fQlVJTERfVkVSU0lPTl9fOiBKU09OLnN0cmluZ2lmeShidWlsZFZlcnNpb24pLFxuXHR9LFxuXHRvcHRpbWl6ZURlcHM6IHtcblx0XHRpbmNsdWRlOiBbXG5cdFx0XHRcImZlYXRoZXItaWNvbnNcIixcblx0XHRcdFwic2hvd2Rvd25cIixcblx0XHRcdFwiaGlnaGxpZ2h0LmpzL2xpYi9jb3JlXCIsXG5cdFx0XHRcImludGVyYWN0anNcIixcblx0XHRdLFxuXHR9LFxuXHRzZXJ2ZXI6IHtcblx0XHRhbGxvd2VkSG9zdHM6IHRydWUsXG5cdFx0cG9ydDogODA4MCxcblx0XHRwcm94eToge1xuXHRcdFx0XCJeLyhhcHB8YXBpfGFzc2V0c3xmaWxlc3xwcmludHZpZXcpXCI6IHtcblx0XHRcdFx0dGFyZ2V0OiBcImh0dHA6Ly8xMjcuMC4wLjE6ODAwMFwiLFxuXHRcdFx0XHR3czogdHJ1ZSxcblx0XHRcdFx0Y2hhbmdlT3JpZ2luOiB0cnVlLFxuXHRcdFx0XHRzZWN1cmU6IGZhbHNlLFxuXHRcdFx0XHRjb29raWVEb21haW5SZXdyaXRlOiBcImxvY2FsaG9zdFwiLFxuXHRcdFx0XHRyb3V0ZXI6IChyZXEpID0+IHtcblx0XHRcdFx0XHRjb25zdCBzaXRlX25hbWUgPSByZXEuaGVhZGVycy5ob3N0LnNwbGl0KFwiOlwiKVswXVxuXHRcdFx0XHRcdC8vIFN1cHBvcnQgYm90aCBsb2NhbGhvc3QgYW5kIDEyNy4wLjAuMVxuXHRcdFx0XHRcdGNvbnN0IGlzTG9jYWxob3N0ID1cblx0XHRcdFx0XHRcdHNpdGVfbmFtZSA9PT0gXCJsb2NhbGhvc3RcIiB8fCBzaXRlX25hbWUgPT09IFwiMTI3LjAuMC4xXCJcblx0XHRcdFx0XHRjb25zdCB0YXJnZXRIb3N0ID0gaXNMb2NhbGhvc3QgPyBcIjEyNy4wLjAuMVwiIDogc2l0ZV9uYW1lXG5cdFx0XHRcdFx0cmV0dXJuIGBodHRwOi8vJHt0YXJnZXRIb3N0fTo4MDAwYFxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHR9LFxuXHR9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaVgsT0FBTyxVQUFVO0FBQ2xZLFNBQVMsWUFBWSxVQUFVO0FBQy9CLE9B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
