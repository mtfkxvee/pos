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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVc2VyXFxcXERvY3VtZW50c1xcXFxQT1NOZXh0LWRldmVsb3BcXFxcUE9TTmV4dC1kZXZlbG9wXFxcXFBPU1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcVXNlclxcXFxEb2N1bWVudHNcXFxcUE9TTmV4dC1kZXZlbG9wXFxcXFBPU05leHQtZGV2ZWxvcFxcXFxQT1NcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL1VzZXIvRG9jdW1lbnRzL1BPU05leHQtZGV2ZWxvcC9QT1NOZXh0LWRldmVsb3AvUE9TL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiXHJcbmltcG9ydCB7IHByb21pc2VzIGFzIGZzIH0gZnJvbSBcIm5vZGU6ZnNcIlxyXG5pbXBvcnQgdnVlIGZyb20gXCJAdml0ZWpzL3BsdWdpbi12dWVcIlxyXG5pbXBvcnQgZnJhcHBldWkgZnJvbSBcImZyYXBwZS11aS92aXRlXCJcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIlxyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSBcInZpdGUtcGx1Z2luLXB3YVwiXHJcbmltcG9ydCB7IHZpdGVTdGF0aWNDb3B5IH0gZnJvbSBcInZpdGUtcGx1Z2luLXN0YXRpYy1jb3B5XCJcclxuXHJcbi8vIEdldCBidWlsZCB2ZXJzaW9uIGZyb20gZW52aXJvbm1lbnQgb3IgdXNlIHRpbWVzdGFtcFxyXG5jb25zdCBidWlsZFZlcnNpb24gPSBwcm9jZXNzLmVudi5QT1NfTkVYVF9CVUlMRF9WRVJTSU9OIHx8IERhdGUubm93KCkudG9TdHJpbmcoKVxyXG5jb25zdCBlbmFibGVTb3VyY2VNYXAgPSBwcm9jZXNzLmVudi5QT1NfTkVYVF9FTkFCTEVfU09VUkNFTUFQID09PSBcInRydWVcIlxyXG5cclxuLyoqXHJcbiAqIFZpdGUgcGx1Z2luIHRvIHdyaXRlIGJ1aWxkIHZlcnNpb24gdG8gdmVyc2lvbi5qc29uIGZpbGVcclxuICogVGhpcyBlbmFibGVzIGNhY2hlIGJ1c3RpbmcgYW5kIHZlcnNpb24gdHJhY2tpbmdcclxuICovXHJcbmZ1bmN0aW9uIHBvc05leHRCdWlsZFZlcnNpb25QbHVnaW4odmVyc2lvbikge1xyXG5cdHJldHVybiB7XHJcblx0XHRuYW1lOiBcInBvcy1uZXh0LWJ1aWxkLXZlcnNpb25cIixcclxuXHRcdGFwcGx5OiBcImJ1aWxkXCIsXHJcblx0XHRhc3luYyB3cml0ZUJ1bmRsZSgpIHtcclxuXHRcdFx0Y29uc3QgdmVyc2lvbkZpbGUgPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uL3Bvc19uZXh0L3B1YmxpYy9wb3MvdmVyc2lvbi5qc29uXCIpXHJcblx0XHRcdGF3YWl0IGZzLm1rZGlyKHBhdGguZGlybmFtZSh2ZXJzaW9uRmlsZSksIHsgcmVjdXJzaXZlOiB0cnVlIH0pXHJcblx0XHRcdGF3YWl0IGZzLndyaXRlRmlsZShcclxuXHRcdFx0XHR2ZXJzaW9uRmlsZSxcclxuXHRcdFx0XHRKU09OLnN0cmluZ2lmeShcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dmVyc2lvbixcclxuXHRcdFx0XHRcdFx0dGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcblx0XHRcdFx0XHRcdGJ1aWxkRGF0ZTogbmV3IERhdGUoKS50b0xvY2FsZURhdGVTdHJpbmcoXCJlbi1VU1wiLCB7XHJcblx0XHRcdFx0XHRcdFx0eWVhcjogXCJudW1lcmljXCIsXHJcblx0XHRcdFx0XHRcdFx0bW9udGg6IFwibG9uZ1wiLFxyXG5cdFx0XHRcdFx0XHRcdGRheTogXCJudW1lcmljXCIsXHJcblx0XHRcdFx0XHRcdH0pLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdG51bGwsXHJcblx0XHRcdFx0XHQyXHJcblx0XHRcdFx0KSxcclxuXHRcdFx0XHRcInV0ZjhcIlxyXG5cdFx0XHQpXHJcblx0XHRcdGNvbnNvbGUubG9nKGBcXG5cdTI3MTMgQnVpbGQgdmVyc2lvbiB3cml0dGVuOiAke3ZlcnNpb259YClcclxuXHRcdH0sXHJcblx0fVxyXG59XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG5cdHBsdWdpbnM6IFtcclxuXHRcdHBvc05leHRCdWlsZFZlcnNpb25QbHVnaW4oYnVpbGRWZXJzaW9uKSxcclxuXHRcdGZyYXBwZXVpKHtcclxuXHRcdFx0ZnJhcHBlUHJveHk6IHRydWUsXHJcblx0XHRcdGppbmphQm9vdERhdGE6IHRydWUsXHJcblx0XHRcdGx1Y2lkZUljb25zOiB0cnVlLFxyXG5cdFx0XHRidWlsZENvbmZpZzoge1xyXG5cdFx0XHRcdGluZGV4SHRtbFBhdGg6IFwiLi4vcG9zX25leHQvd3d3L3Bvcy5odG1sXCIsXHJcblx0XHRcdFx0b3V0RGlyOiBcIi4uL3Bvc19uZXh0L3B1YmxpYy9wb3NcIixcclxuXHRcdFx0XHRlbXB0eU91dERpcjogdHJ1ZSxcclxuXHRcdFx0XHRzb3VyY2VtYXA6IGVuYWJsZVNvdXJjZU1hcCxcclxuXHRcdFx0fSxcclxuXHRcdH0pLFxyXG5cdFx0dnVlKCksXHJcblx0XHR2aXRlU3RhdGljQ29weSh7XHJcblx0XHRcdHRhcmdldHM6IFtcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRzcmM6IFwic3JjL3dvcmtlcnNcIixcclxuXHRcdFx0XHRcdGRlc3Q6IFwiLlwiLFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdF0sXHJcblx0XHR9KSxcclxuXHRcdFZpdGVQV0Eoe1xyXG5cdFx0XHRyZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxyXG5cdFx0XHRpbmNsdWRlQXNzZXRzOiBbXCJmYXZpY29uLnBuZ1wiLCBcImljb24uc3ZnXCIsIFwiaWNvbi1tYXNrYWJsZS5zdmdcIl0sXHJcblx0XHRcdG1hbmlmZXN0OiB7XHJcblx0XHRcdFx0bmFtZTogXCJQT1NOZXh0XCIsXHJcblx0XHRcdFx0c2hvcnRfbmFtZTogXCJQT1NOZXh0XCIsXHJcblx0XHRcdFx0ZGVzY3JpcHRpb246XHJcblx0XHRcdFx0XHRcIlBvaW50IG9mIFNhbGUgc3lzdGVtIHdpdGggcmVhbC10aW1lIGJpbGxpbmcsIHN0b2NrIG1hbmFnZW1lbnQsIGFuZCBvZmZsaW5lIHN1cHBvcnRcIixcclxuXHRcdFx0XHR0aGVtZV9jb2xvcjogXCIjNEY0NkU1XCIsXHJcblx0XHRcdFx0YmFja2dyb3VuZF9jb2xvcjogXCIjZmZmZmZmXCIsXHJcblx0XHRcdFx0ZGlzcGxheTogXCJzdGFuZGFsb25lXCIsXHJcblx0XHRcdFx0c2NvcGU6IFwiL2Fzc2V0cy9wb3NfbmV4dC9wb3MvXCIsXHJcblx0XHRcdFx0c3RhcnRfdXJsOiBcIi9wb3NcIixcclxuXHRcdFx0XHRpY29uczogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRzcmM6IFwiL2Fzc2V0cy9wb3NfbmV4dC9wb3MvaWNvbi5zdmdcIixcclxuXHRcdFx0XHRcdFx0c2l6ZXM6IFwiMTkyeDE5MlwiLFxyXG5cdFx0XHRcdFx0XHR0eXBlOiBcImltYWdlL3N2Zyt4bWxcIixcclxuXHRcdFx0XHRcdFx0cHVycG9zZTogXCJhbnlcIixcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHNyYzogXCIvYXNzZXRzL3Bvc19uZXh0L3Bvcy9pY29uLnN2Z1wiLFxyXG5cdFx0XHRcdFx0XHRzaXplczogXCI1MTJ4NTEyXCIsXHJcblx0XHRcdFx0XHRcdHR5cGU6IFwiaW1hZ2Uvc3ZnK3htbFwiLFxyXG5cdFx0XHRcdFx0XHRwdXJwb3NlOiBcImFueVwiLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0c3JjOiBcIi9hc3NldHMvcG9zX25leHQvcG9zL2ljb24tbWFza2FibGUuc3ZnXCIsXHJcblx0XHRcdFx0XHRcdHNpemVzOiBcIjE5MngxOTJcIixcclxuXHRcdFx0XHRcdFx0dHlwZTogXCJpbWFnZS9zdmcreG1sXCIsXHJcblx0XHRcdFx0XHRcdHB1cnBvc2U6IFwibWFza2FibGVcIixcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHNyYzogXCIvYXNzZXRzL3Bvc19uZXh0L3Bvcy9pY29uLW1hc2thYmxlLnN2Z1wiLFxyXG5cdFx0XHRcdFx0XHRzaXplczogXCI1MTJ4NTEyXCIsXHJcblx0XHRcdFx0XHRcdHR5cGU6IFwiaW1hZ2Uvc3ZnK3htbFwiLFxyXG5cdFx0XHRcdFx0XHRwdXJwb3NlOiBcIm1hc2thYmxlXCIsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdH0sXHJcblx0XHRcdHdvcmtib3g6IHtcclxuXHRcdFx0XHRnbG9iUGF0dGVybnM6IFtcIioqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLHdvZmYsd29mZjJ9XCJdLFxyXG5cdFx0XHRcdG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiA0ICogMTAyNCAqIDEwMjQsIC8vIDMgTUJcclxuXHRcdFx0XHRuYXZpZ2F0ZUZhbGxiYWNrOiBudWxsLFxyXG5cdFx0XHRcdG5hdmlnYXRlRmFsbGJhY2tEZW55bGlzdDogWy9eXFwvYXBpLywgL15cXC9hcHAvXSxcclxuXHRcdFx0XHRydW50aW1lQ2FjaGluZzogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHR1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2ZvbnRzXFwuZ29vZ2xlYXBpc1xcLmNvbVxcLy4qL2ksXHJcblx0XHRcdFx0XHRcdGhhbmRsZXI6IFwiQ2FjaGVGaXJzdFwiLFxyXG5cdFx0XHRcdFx0XHRvcHRpb25zOiB7XHJcblx0XHRcdFx0XHRcdFx0Y2FjaGVOYW1lOiBcImdvb2dsZS1mb250cy1jYWNoZVwiLFxyXG5cdFx0XHRcdFx0XHRcdGV4cGlyYXRpb246IHtcclxuXHRcdFx0XHRcdFx0XHRcdG1heEVudHJpZXM6IDEwLFxyXG5cdFx0XHRcdFx0XHRcdFx0bWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzY1LCAvLyAxIHllYXJcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdGNhY2hlYWJsZVJlc3BvbnNlOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRzdGF0dXNlczogWzAsIDIwMF0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvZm9udHNcXC5nc3RhdGljXFwuY29tXFwvLiovaSxcclxuXHRcdFx0XHRcdFx0aGFuZGxlcjogXCJDYWNoZUZpcnN0XCIsXHJcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcclxuXHRcdFx0XHRcdFx0XHRjYWNoZU5hbWU6IFwiZ3N0YXRpYy1mb250cy1jYWNoZVwiLFxyXG5cdFx0XHRcdFx0XHRcdGV4cGlyYXRpb246IHtcclxuXHRcdFx0XHRcdFx0XHRcdG1heEVudHJpZXM6IDEwLFxyXG5cdFx0XHRcdFx0XHRcdFx0bWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzY1LCAvLyAxIHllYXJcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdGNhY2hlYWJsZVJlc3BvbnNlOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRzdGF0dXNlczogWzAsIDIwMF0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9cXC9hc3NldHNcXC9wb3NfbmV4dFxcL3Bvc1xcLy4qL2ksXHJcblx0XHRcdFx0XHRcdGhhbmRsZXI6IFwiQ2FjaGVGaXJzdFwiLFxyXG5cdFx0XHRcdFx0XHRvcHRpb25zOiB7XHJcblx0XHRcdFx0XHRcdFx0Y2FjaGVOYW1lOiBcInBvcy1hc3NldHMtY2FjaGVcIixcclxuXHRcdFx0XHRcdFx0XHRleHBpcmF0aW9uOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRtYXhFbnRyaWVzOiA1MDAsXHJcblx0XHRcdFx0XHRcdFx0XHRtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzMCwgLy8gMzAgZGF5c1xyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0Ly8gQ2FjaGUgcHJvZHVjdCBpbWFnZXMgd2l0aCBTdGFsZVdoaWxlUmV2YWxpZGF0ZSBmb3IgYmV0dGVyIFVYXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46IC9cXC9maWxlc1xcLy4qXFwuKGpwZ3xqcGVnfHBuZ3xnaWZ8d2VicHxzdmcpJC9pLFxyXG5cdFx0XHRcdFx0XHRoYW5kbGVyOiBcIlN0YWxlV2hpbGVSZXZhbGlkYXRlXCIsXHJcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcclxuXHRcdFx0XHRcdFx0XHRjYWNoZU5hbWU6IFwicHJvZHVjdC1pbWFnZXMtY2FjaGVcIixcclxuXHRcdFx0XHRcdFx0XHRleHBpcmF0aW9uOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRtYXhFbnRyaWVzOiAyMDAsIC8vIENhY2hlIHVwIHRvIDIwMCBwcm9kdWN0IGltYWdlc1xyXG5cdFx0XHRcdFx0XHRcdFx0bWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogNywgLy8gNyBkYXlzXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRjYWNoZWFibGVSZXNwb25zZToge1xyXG5cdFx0XHRcdFx0XHRcdFx0c3RhdHVzZXM6IFswLCAyMDBdLFxyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHR1cmxQYXR0ZXJuOiAvXFwvYXBpXFwvLiovaSxcclxuXHRcdFx0XHRcdFx0aGFuZGxlcjogXCJOZXR3b3JrRmlyc3RcIixcclxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xyXG5cdFx0XHRcdFx0XHRcdGNhY2hlTmFtZTogXCJhcGktY2FjaGVcIixcclxuXHRcdFx0XHRcdFx0XHRuZXR3b3JrVGltZW91dFNlY29uZHM6IDEwLFxyXG5cdFx0XHRcdFx0XHRcdGV4cGlyYXRpb246IHtcclxuXHRcdFx0XHRcdFx0XHRcdG1heEVudHJpZXM6IDEwMCxcclxuXHRcdFx0XHRcdFx0XHRcdG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCwgLy8gMjQgaG91cnNcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdGNhY2hlYWJsZVJlc3BvbnNlOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRzdGF0dXNlczogWzAsIDIwMF0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHVybFBhdHRlcm46ICh7IHJlcXVlc3QsIHVybCB9KSA9PlxyXG5cdFx0XHRcdFx0XHRcdHJlcXVlc3QubW9kZSA9PT0gXCJuYXZpZ2F0ZVwiICYmIHVybC5wYXRobmFtZS5zdGFydHNXaXRoKFwiL3Bvc1wiKSxcclxuXHRcdFx0XHRcdFx0aGFuZGxlcjogXCJOZXR3b3JrRmlyc3RcIixcclxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xyXG5cdFx0XHRcdFx0XHRcdGNhY2hlTmFtZTogXCJwb3MtcGFnZS1jYWNoZVwiLFxyXG5cdFx0XHRcdFx0XHRcdG5ldHdvcmtUaW1lb3V0U2Vjb25kczogMyxcclxuXHRcdFx0XHRcdFx0XHRleHBpcmF0aW9uOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRtYXhFbnRyaWVzOiAxLFxyXG5cdFx0XHRcdFx0XHRcdFx0bWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0LCAvLyAyNCBob3Vyc1xyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdFx0Y2xlYW51cE91dGRhdGVkQ2FjaGVzOiB0cnVlLFxyXG5cdFx0XHRcdHNraXBXYWl0aW5nOiB0cnVlLFxyXG5cdFx0XHRcdGNsaWVudHNDbGFpbTogdHJ1ZSxcclxuXHRcdFx0fSxcclxuXHRcdFx0ZGV2T3B0aW9uczoge1xyXG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXHJcblx0XHRcdFx0dHlwZTogXCJtb2R1bGVcIixcclxuXHRcdFx0fSxcclxuXHRcdH0pLFxyXG5cdF0sXHJcblx0YnVpbGQ6IHtcclxuXHRcdGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTUwMCxcclxuXHRcdG91dERpcjogXCIuLi9wb3NfbmV4dC9wdWJsaWMvcG9zXCIsXHJcblx0XHRlbXB0eU91dERpcjogdHJ1ZSxcclxuXHRcdHRhcmdldDogXCJlczIwMTVcIixcclxuXHRcdHNvdXJjZW1hcDogZW5hYmxlU291cmNlTWFwLFxyXG5cdH0sXHJcblx0d29ya2VyOiB7XHJcblx0XHRmb3JtYXQ6IFwiZXNcIixcclxuXHRcdHJvbGx1cE9wdGlvbnM6IHtcclxuXHRcdFx0b3V0cHV0OiB7XHJcblx0XHRcdFx0Zm9ybWF0OiBcImVzXCIsXHJcblx0XHRcdH0sXHJcblx0XHR9LFxyXG5cdH0sXHJcblx0cmVzb2x2ZToge1xyXG5cdFx0YWxpYXM6IHtcclxuXHRcdFx0XCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwic3JjXCIpLFxyXG5cdFx0XHRcInRhaWx3aW5kLmNvbmZpZy5qc1wiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInRhaWx3aW5kLmNvbmZpZy5qc1wiKSxcclxuXHRcdH0sXHJcblx0fSxcclxuXHRkZWZpbmU6IHtcclxuXHRcdF9fQlVJTERfVkVSU0lPTl9fOiBKU09OLnN0cmluZ2lmeShidWlsZFZlcnNpb24pLFxyXG5cdH0sXHJcblx0b3B0aW1pemVEZXBzOiB7XHJcblx0XHRpbmNsdWRlOiBbXHJcblx0XHRcdFwiZmVhdGhlci1pY29uc1wiLFxyXG5cdFx0XHRcInNob3dkb3duXCIsXHJcblx0XHRcdFwiaGlnaGxpZ2h0LmpzL2xpYi9jb3JlXCIsXHJcblx0XHRcdFwiaW50ZXJhY3Rqc1wiLFxyXG5cdFx0XSxcclxuXHR9LFxyXG5cdHNlcnZlcjoge1xyXG5cdFx0YWxsb3dlZEhvc3RzOiB0cnVlLFxyXG5cdFx0cG9ydDogODA4MCxcclxuXHRcdHByb3h5OiB7XHJcblx0XHRcdFwiXi8oYXBwfGFwaXxhc3NldHN8ZmlsZXN8cHJpbnR2aWV3KVwiOiB7XHJcblx0XHRcdFx0dGFyZ2V0OiBcImh0dHA6Ly8xMjcuMC4wLjE6ODAwMFwiLFxyXG5cdFx0XHRcdHdzOiB0cnVlLFxyXG5cdFx0XHRcdGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuXHRcdFx0XHRzZWN1cmU6IGZhbHNlLFxyXG5cdFx0XHRcdGNvb2tpZURvbWFpblJld3JpdGU6IFwibG9jYWxob3N0XCIsXHJcblx0XHRcdFx0cm91dGVyOiAocmVxKSA9PiB7XHJcblx0XHRcdFx0XHRjb25zdCBzaXRlX25hbWUgPSByZXEuaGVhZGVycy5ob3N0LnNwbGl0KFwiOlwiKVswXVxyXG5cdFx0XHRcdFx0Ly8gU3VwcG9ydCBib3RoIGxvY2FsaG9zdCBhbmQgMTI3LjAuMC4xXHJcblx0XHRcdFx0XHRjb25zdCBpc0xvY2FsaG9zdCA9XHJcblx0XHRcdFx0XHRcdHNpdGVfbmFtZSA9PT0gXCJsb2NhbGhvc3RcIiB8fCBzaXRlX25hbWUgPT09IFwiMTI3LjAuMC4xXCJcclxuXHRcdFx0XHRcdGNvbnN0IHRhcmdldEhvc3QgPSBpc0xvY2FsaG9zdCA/IFwiMTI3LjAuMC4xXCIgOiBzaXRlX25hbWVcclxuXHRcdFx0XHRcdHJldHVybiBgaHR0cDovLyR7dGFyZ2V0SG9zdH06ODAwMGBcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0fSxcclxuXHR9LFxyXG59KVxyXG4iXSwKICAibWFwcGluZ3MiOiAi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
