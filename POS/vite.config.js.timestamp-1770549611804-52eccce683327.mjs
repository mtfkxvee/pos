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
      includeAssets: ["favicon.png", "icon.svg", "icon-maskable.svg"],
      manifest: {
        name: "POSNext",
        short_name: "POSNext",
        description: "Point of Sale system with real-time billing, stock management, and offline support",
        theme_color: "#4F46E5",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/assets/pos_next/pos/",
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
          },
          {
            urlPattern: ({ request, url }) => request.mode === "navigate" && url.pathname.startsWith("/pos"),
            handler: "NetworkFirst",
            options: {
              cacheName: "pos-page-cache",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24
                // 24 hours
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVc2VyXFxcXERvY3VtZW50c1xcXFxQT1NOZXh0LWRldmVsb3BcXFxcUE9TTmV4dC1kZXZlbG9wXFxcXFBPU1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcVXNlclxcXFxEb2N1bWVudHNcXFxcUE9TTmV4dC1kZXZlbG9wXFxcXFBPU05leHQtZGV2ZWxvcFxcXFxQT1NcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL1VzZXIvRG9jdW1lbnRzL1BPU05leHQtZGV2ZWxvcC9QT1NOZXh0LWRldmVsb3AvUE9TL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiXG5pbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gXCJub2RlOmZzXCJcbmltcG9ydCB2dWUgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXZ1ZVwiXG5pbXBvcnQgZnJhcHBldWkgZnJvbSBcImZyYXBwZS11aS92aXRlXCJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tIFwidml0ZS1wbHVnaW4tcHdhXCJcbmltcG9ydCB7IHZpdGVTdGF0aWNDb3B5IH0gZnJvbSBcInZpdGUtcGx1Z2luLXN0YXRpYy1jb3B5XCJcblxuLy8gR2V0IGJ1aWxkIHZlcnNpb24gZnJvbSBlbnZpcm9ubWVudCBvciB1c2UgdGltZXN0YW1wXG5jb25zdCBidWlsZFZlcnNpb24gPSBwcm9jZXNzLmVudi5QT1NfTkVYVF9CVUlMRF9WRVJTSU9OIHx8IERhdGUubm93KCkudG9TdHJpbmcoKVxuY29uc3QgZW5hYmxlU291cmNlTWFwID0gcHJvY2Vzcy5lbnYuUE9TX05FWFRfRU5BQkxFX1NPVVJDRU1BUCA9PT0gXCJ0cnVlXCJcblxuLyoqXG4gKiBWaXRlIHBsdWdpbiB0byB3cml0ZSBidWlsZCB2ZXJzaW9uIHRvIHZlcnNpb24uanNvbiBmaWxlXG4gKiBUaGlzIGVuYWJsZXMgY2FjaGUgYnVzdGluZyBhbmQgdmVyc2lvbiB0cmFja2luZ1xuICovXG5mdW5jdGlvbiBwb3NOZXh0QnVpbGRWZXJzaW9uUGx1Z2luKHZlcnNpb24pIHtcblx0cmV0dXJuIHtcblx0XHRuYW1lOiBcInBvcy1uZXh0LWJ1aWxkLXZlcnNpb25cIixcblx0XHRhcHBseTogXCJidWlsZFwiLFxuXHRcdGFzeW5jIHdyaXRlQnVuZGxlKCkge1xuXHRcdFx0Y29uc3QgdmVyc2lvbkZpbGUgPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uL3Bvc19uZXh0L3B1YmxpYy9wb3MvdmVyc2lvbi5qc29uXCIpXG5cdFx0XHRhd2FpdCBmcy5ta2RpcihwYXRoLmRpcm5hbWUodmVyc2lvbkZpbGUpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KVxuXHRcdFx0YXdhaXQgZnMud3JpdGVGaWxlKFxuXHRcdFx0XHR2ZXJzaW9uRmlsZSxcblx0XHRcdFx0SlNPTi5zdHJpbmdpZnkoXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dmVyc2lvbixcblx0XHRcdFx0XHRcdHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuXHRcdFx0XHRcdFx0YnVpbGREYXRlOiBuZXcgRGF0ZSgpLnRvTG9jYWxlRGF0ZVN0cmluZyhcImVuLVVTXCIsIHtcblx0XHRcdFx0XHRcdFx0eWVhcjogXCJudW1lcmljXCIsXG5cdFx0XHRcdFx0XHRcdG1vbnRoOiBcImxvbmdcIixcblx0XHRcdFx0XHRcdFx0ZGF5OiBcIm51bWVyaWNcIixcblx0XHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0bnVsbCxcblx0XHRcdFx0XHQyXG5cdFx0XHRcdCksXG5cdFx0XHRcdFwidXRmOFwiXG5cdFx0XHQpXG5cdFx0XHRjb25zb2xlLmxvZyhgXFxuXHUyNzEzIEJ1aWxkIHZlcnNpb24gd3JpdHRlbjogJHt2ZXJzaW9ufWApXG5cdFx0fSxcblx0fVxufVxuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcblx0cGx1Z2luczogW1xuXHRcdHBvc05leHRCdWlsZFZlcnNpb25QbHVnaW4oYnVpbGRWZXJzaW9uKSxcblx0XHRmcmFwcGV1aSh7XG5cdFx0XHRmcmFwcGVQcm94eTogdHJ1ZSxcblx0XHRcdGppbmphQm9vdERhdGE6IHRydWUsXG5cdFx0XHRsdWNpZGVJY29uczogdHJ1ZSxcblx0XHRcdGJ1aWxkQ29uZmlnOiB7XG5cdFx0XHRcdGluZGV4SHRtbFBhdGg6IFwiLi4vcG9zX25leHQvd3d3L3Bvcy5odG1sXCIsXG5cdFx0XHRcdG91dERpcjogXCIuLi9wb3NfbmV4dC9wdWJsaWMvcG9zXCIsXG5cdFx0XHRcdGVtcHR5T3V0RGlyOiB0cnVlLFxuXHRcdFx0XHRzb3VyY2VtYXA6IGVuYWJsZVNvdXJjZU1hcCxcblx0XHRcdH0sXG5cdFx0fSksXG5cdFx0dnVlKCksXG5cdFx0dml0ZVN0YXRpY0NvcHkoe1xuXHRcdFx0dGFyZ2V0czogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0c3JjOiBcInNyYy93b3JrZXJzXCIsXG5cdFx0XHRcdFx0ZGVzdDogXCIuXCIsXG5cdFx0XHRcdH0sXG5cdFx0XHRdLFxuXHRcdH0pLFxuXHRcdFZpdGVQV0Eoe1xuXHRcdFx0cmVnaXN0ZXJUeXBlOiBcImF1dG9VcGRhdGVcIixcblx0XHRcdGluY2x1ZGVBc3NldHM6IFtcImZhdmljb24ucG5nXCIsIFwiaWNvbi5zdmdcIiwgXCJpY29uLW1hc2thYmxlLnN2Z1wiXSxcblx0XHRcdG1hbmlmZXN0OiB7XG5cdFx0XHRcdG5hbWU6IFwiUE9TTmV4dFwiLFxuXHRcdFx0XHRzaG9ydF9uYW1lOiBcIlBPU05leHRcIixcblx0XHRcdFx0ZGVzY3JpcHRpb246XG5cdFx0XHRcdFx0XCJQb2ludCBvZiBTYWxlIHN5c3RlbSB3aXRoIHJlYWwtdGltZSBiaWxsaW5nLCBzdG9jayBtYW5hZ2VtZW50LCBhbmQgb2ZmbGluZSBzdXBwb3J0XCIsXG5cdFx0XHRcdHRoZW1lX2NvbG9yOiBcIiM0RjQ2RTVcIixcblx0XHRcdFx0YmFja2dyb3VuZF9jb2xvcjogXCIjZmZmZmZmXCIsXG5cdFx0XHRcdGRpc3BsYXk6IFwic3RhbmRhbG9uZVwiLFxuXHRcdFx0XHRzY29wZTogXCIvYXNzZXRzL3Bvc19uZXh0L3Bvcy9cIixcblx0XHRcdFx0c3RhcnRfdXJsOiBcIi9wb3NcIixcblx0XHRcdFx0aWNvbnM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzcmM6IFwiL2Fzc2V0cy9wb3NfbmV4dC9wb3MvaWNvbi5zdmdcIixcblx0XHRcdFx0XHRcdHNpemVzOiBcIjE5MngxOTJcIixcblx0XHRcdFx0XHRcdHR5cGU6IFwiaW1hZ2Uvc3ZnK3htbFwiLFxuXHRcdFx0XHRcdFx0cHVycG9zZTogXCJhbnlcIixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNyYzogXCIvYXNzZXRzL3Bvc19uZXh0L3Bvcy9pY29uLnN2Z1wiLFxuXHRcdFx0XHRcdFx0c2l6ZXM6IFwiNTEyeDUxMlwiLFxuXHRcdFx0XHRcdFx0dHlwZTogXCJpbWFnZS9zdmcreG1sXCIsXG5cdFx0XHRcdFx0XHRwdXJwb3NlOiBcImFueVwiLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c3JjOiBcIi9hc3NldHMvcG9zX25leHQvcG9zL2ljb24tbWFza2FibGUuc3ZnXCIsXG5cdFx0XHRcdFx0XHRzaXplczogXCIxOTJ4MTkyXCIsXG5cdFx0XHRcdFx0XHR0eXBlOiBcImltYWdlL3N2Zyt4bWxcIixcblx0XHRcdFx0XHRcdHB1cnBvc2U6IFwibWFza2FibGVcIixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNyYzogXCIvYXNzZXRzL3Bvc19uZXh0L3Bvcy9pY29uLW1hc2thYmxlLnN2Z1wiLFxuXHRcdFx0XHRcdFx0c2l6ZXM6IFwiNTEyeDUxMlwiLFxuXHRcdFx0XHRcdFx0dHlwZTogXCJpbWFnZS9zdmcreG1sXCIsXG5cdFx0XHRcdFx0XHRwdXJwb3NlOiBcIm1hc2thYmxlXCIsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH0sXG5cdFx0XHR3b3JrYm94OiB7XG5cdFx0XHRcdGdsb2JQYXR0ZXJuczogW1wiKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZix3b2ZmMn1cIl0sXG5cdFx0XHRcdG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiA0ICogMTAyNCAqIDEwMjQsIC8vIDMgTUJcblx0XHRcdFx0bmF2aWdhdGVGYWxsYmFjazogbnVsbCxcblx0XHRcdFx0bmF2aWdhdGVGYWxsYmFja0RlbnlsaXN0OiBbL15cXC9hcGkvLCAvXlxcL2FwcC9dLFxuXHRcdFx0XHRydW50aW1lQ2FjaGluZzogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvZm9udHNcXC5nb29nbGVhcGlzXFwuY29tXFwvLiovaSxcblx0XHRcdFx0XHRcdGhhbmRsZXI6IFwiQ2FjaGVGaXJzdFwiLFxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRjYWNoZU5hbWU6IFwiZ29vZ2xlLWZvbnRzLWNhY2hlXCIsXG5cdFx0XHRcdFx0XHRcdGV4cGlyYXRpb246IHtcblx0XHRcdFx0XHRcdFx0XHRtYXhFbnRyaWVzOiAxMCxcblx0XHRcdFx0XHRcdFx0XHRtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUsIC8vIDEgeWVhclxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRjYWNoZWFibGVSZXNwb25zZToge1xuXHRcdFx0XHRcdFx0XHRcdHN0YXR1c2VzOiBbMCwgMjAwXSxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2ZvbnRzXFwuZ3N0YXRpY1xcLmNvbVxcLy4qL2ksXG5cdFx0XHRcdFx0XHRoYW5kbGVyOiBcIkNhY2hlRmlyc3RcIixcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0Y2FjaGVOYW1lOiBcImdzdGF0aWMtZm9udHMtY2FjaGVcIixcblx0XHRcdFx0XHRcdFx0ZXhwaXJhdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRcdG1heEVudHJpZXM6IDEwLFxuXHRcdFx0XHRcdFx0XHRcdG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSwgLy8gMSB5ZWFyXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGNhY2hlYWJsZVJlc3BvbnNlOiB7XG5cdFx0XHRcdFx0XHRcdFx0c3RhdHVzZXM6IFswLCAyMDBdLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9cXC9hc3NldHNcXC9wb3NfbmV4dFxcL3Bvc1xcLy4qL2ksXG5cdFx0XHRcdFx0XHRoYW5kbGVyOiBcIkNhY2hlRmlyc3RcIixcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0Y2FjaGVOYW1lOiBcInBvcy1hc3NldHMtY2FjaGVcIixcblx0XHRcdFx0XHRcdFx0ZXhwaXJhdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRcdG1heEVudHJpZXM6IDUwMCxcblx0XHRcdFx0XHRcdFx0XHRtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzMCwgLy8gMzAgZGF5c1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdC8vIENhY2hlIHByb2R1Y3QgaW1hZ2VzIHdpdGggU3RhbGVXaGlsZVJldmFsaWRhdGUgZm9yIGJldHRlciBVWFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9cXC9maWxlc1xcLy4qXFwuKGpwZ3xqcGVnfHBuZ3xnaWZ8d2VicHxzdmcpJC9pLFxuXHRcdFx0XHRcdFx0aGFuZGxlcjogXCJTdGFsZVdoaWxlUmV2YWxpZGF0ZVwiLFxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRjYWNoZU5hbWU6IFwicHJvZHVjdC1pbWFnZXMtY2FjaGVcIixcblx0XHRcdFx0XHRcdFx0ZXhwaXJhdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRcdG1heEVudHJpZXM6IDIwMCwgLy8gQ2FjaGUgdXAgdG8gMjAwIHByb2R1Y3QgaW1hZ2VzXG5cdFx0XHRcdFx0XHRcdFx0bWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogNywgLy8gNyBkYXlzXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGNhY2hlYWJsZVJlc3BvbnNlOiB7XG5cdFx0XHRcdFx0XHRcdFx0c3RhdHVzZXM6IFswLCAyMDBdLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9cXC9hcGlcXC8uKi9pLFxuXHRcdFx0XHRcdFx0aGFuZGxlcjogXCJOZXR3b3JrRmlyc3RcIixcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0Y2FjaGVOYW1lOiBcImFwaS1jYWNoZVwiLFxuXHRcdFx0XHRcdFx0XHRuZXR3b3JrVGltZW91dFNlY29uZHM6IDEwLFxuXHRcdFx0XHRcdFx0XHRleHBpcmF0aW9uOiB7XG5cdFx0XHRcdFx0XHRcdFx0bWF4RW50cmllczogMTAwLFxuXHRcdFx0XHRcdFx0XHRcdG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCwgLy8gMjQgaG91cnNcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0Y2FjaGVhYmxlUmVzcG9uc2U6IHtcblx0XHRcdFx0XHRcdFx0XHRzdGF0dXNlczogWzAsIDIwMF0sXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dXJsUGF0dGVybjogKHsgcmVxdWVzdCwgdXJsIH0pID0+XG5cdFx0XHRcdFx0XHRcdHJlcXVlc3QubW9kZSA9PT0gXCJuYXZpZ2F0ZVwiICYmIHVybC5wYXRobmFtZS5zdGFydHNXaXRoKFwiL3Bvc1wiKSxcblx0XHRcdFx0XHRcdGhhbmRsZXI6IFwiTmV0d29ya0ZpcnN0XCIsXG5cdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdGNhY2hlTmFtZTogXCJwb3MtcGFnZS1jYWNoZVwiLFxuXHRcdFx0XHRcdFx0XHRuZXR3b3JrVGltZW91dFNlY29uZHM6IDMsXG5cdFx0XHRcdFx0XHRcdGV4cGlyYXRpb246IHtcblx0XHRcdFx0XHRcdFx0XHRtYXhFbnRyaWVzOiAxLFxuXHRcdFx0XHRcdFx0XHRcdG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCwgLy8gMjQgaG91cnNcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdFx0Y2xlYW51cE91dGRhdGVkQ2FjaGVzOiB0cnVlLFxuXHRcdFx0XHRza2lwV2FpdGluZzogdHJ1ZSxcblx0XHRcdFx0Y2xpZW50c0NsYWltOiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdGRldk9wdGlvbnM6IHtcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0dHlwZTogXCJtb2R1bGVcIixcblx0XHRcdH0sXG5cdFx0fSksXG5cdF0sXG5cdGJ1aWxkOiB7XG5cdFx0Y2h1bmtTaXplV2FybmluZ0xpbWl0OiAxNTAwLFxuXHRcdG91dERpcjogXCIuLi9wb3NfbmV4dC9wdWJsaWMvcG9zXCIsXG5cdFx0ZW1wdHlPdXREaXI6IHRydWUsXG5cdFx0dGFyZ2V0OiBcImVzMjAxNVwiLFxuXHRcdHNvdXJjZW1hcDogZW5hYmxlU291cmNlTWFwLFxuXHR9LFxuXHR3b3JrZXI6IHtcblx0XHRmb3JtYXQ6IFwiZXNcIixcblx0XHRyb2xsdXBPcHRpb25zOiB7XG5cdFx0XHRvdXRwdXQ6IHtcblx0XHRcdFx0Zm9ybWF0OiBcImVzXCIsXG5cdFx0XHR9LFxuXHRcdH0sXG5cdH0sXG5cdHJlc29sdmU6IHtcblx0XHRhbGlhczoge1xuXHRcdFx0XCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwic3JjXCIpLFxuXHRcdFx0XCJ0YWlsd2luZC5jb25maWcuanNcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJ0YWlsd2luZC5jb25maWcuanNcIiksXG5cdFx0fSxcblx0fSxcblx0ZGVmaW5lOiB7XG5cdFx0X19CVUlMRF9WRVJTSU9OX186IEpTT04uc3RyaW5naWZ5KGJ1aWxkVmVyc2lvbiksXG5cdH0sXG5cdG9wdGltaXplRGVwczoge1xuXHRcdGluY2x1ZGU6IFtcblx0XHRcdFwiZmVhdGhlci1pY29uc1wiLFxuXHRcdFx0XCJzaG93ZG93blwiLFxuXHRcdFx0XCJoaWdobGlnaHQuanMvbGliL2NvcmVcIixcblx0XHRcdFwiaW50ZXJhY3Rqc1wiLFxuXHRcdF0sXG5cdH0sXG5cdHNlcnZlcjoge1xuXHRcdGFsbG93ZWRIb3N0czogdHJ1ZSxcblx0XHRwb3J0OiA4MDgwLFxuXHRcdHByb3h5OiB7XG5cdFx0XHRcIl4vKGFwcHxhcGl8YXNzZXRzfGZpbGVzfHByaW50dmlldylcIjoge1xuXHRcdFx0XHR0YXJnZXQ6IFwiaHR0cDovLzEyNy4wLjAuMTo4MDAwXCIsXG5cdFx0XHRcdHdzOiB0cnVlLFxuXHRcdFx0XHRjaGFuZ2VPcmlnaW46IHRydWUsXG5cdFx0XHRcdHNlY3VyZTogZmFsc2UsXG5cdFx0XHRcdGNvb2tpZURvbWFpblJld3JpdGU6IFwibG9jYWxob3N0XCIsXG5cdFx0XHRcdHJvdXRlcjogKHJlcSkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHNpdGVfbmFtZSA9IHJlcS5oZWFkZXJzLmhvc3Quc3BsaXQoXCI6XCIpWzBdXG5cdFx0XHRcdFx0Ly8gU3VwcG9ydCBib3RoIGxvY2FsaG9zdCBhbmQgMTI3LjAuMC4xXG5cdFx0XHRcdFx0Y29uc3QgaXNMb2NhbGhvc3QgPVxuXHRcdFx0XHRcdFx0c2l0ZV9uYW1lID09PSBcImxvY2FsaG9zdFwiIHx8IHNpdGVfbmFtZSA9PT0gXCIxMjcuMC4wLjFcIlxuXHRcdFx0XHRcdGNvbnN0IHRhcmdldEhvc3QgPSBpc0xvY2FsaG9zdCA/IFwiMTI3LjAuMC4xXCIgOiBzaXRlX25hbWVcblx0XHRcdFx0XHRyZXR1cm4gYGh0dHA6Ly8ke3RhcmdldEhvc3R9OjgwMDBgXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdH0sXG5cdH0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFpWCxPQUFPLFVBQVU7QUFDbFksU0FBUyxZQUFZLFVBQVU7QUFDL0IsT0FBTyxTQUFTO0FBQ2hCLE9BQU8sY0FBYztBQUNyQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxzQkFBc0I7QUFOL0IsSUFBTSxtQ0FBbUM7QUFTekMsSUFBTSxlQUFlLFFBQVEsSUFBSSwwQkFBMEIsS0FBSyxJQUFJLEVBQUUsU0FBUztBQUMvRSxJQUFNLGtCQUFrQixRQUFRLElBQUksOEJBQThCO0FBTWxFLFNBQVMsMEJBQTBCLFNBQVM7QUFDM0MsU0FBTztBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsTUFBTSxjQUFjO0FBQ25CLFlBQU0sY0FBYyxLQUFLLFFBQVEsa0NBQVcscUNBQXFDO0FBQ2pGLFlBQU0sR0FBRyxNQUFNLEtBQUssUUFBUSxXQUFXLEdBQUcsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUM3RCxZQUFNLEdBQUc7QUFBQSxRQUNSO0FBQUEsUUFDQSxLQUFLO0FBQUEsVUFDSjtBQUFBLFlBQ0M7QUFBQSxZQUNBLFlBQVcsb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFBQSxZQUNsQyxZQUFX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
