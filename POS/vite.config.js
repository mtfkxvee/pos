import path from "node:path"
import { promises as fs } from "node:fs"
import vue from "@vitejs/plugin-vue"
import frappeui from "frappe-ui/vite"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { viteStaticCopy } from "vite-plugin-static-copy"

// Get build version from environment or use timestamp
const buildVersion = process.env.POS_NEXT_BUILD_VERSION || Date.now().toString()
const enableSourceMap = process.env.POS_NEXT_ENABLE_SOURCEMAP === "true"

/**
 * Vite plugin to write build version to version.json file
 * This enables cache busting and version tracking
 */
function posNextBuildVersionPlugin(version) {
	return {
		name: "pos-next-build-version",
		apply: "build",
		async writeBundle() {
			const versionFile = path.resolve(
				__dirname,
				"../pos_next/public/pos/version.json",
			)
			await fs.mkdir(path.dirname(versionFile), { recursive: true })
			await fs.writeFile(
				versionFile,
				JSON.stringify(
					{
						version,
						timestamp: new Date().toISOString(),
						buildDate: new Date().toLocaleDateString("en-US", {
							year: "numeric",
							month: "long",
							day: "numeric",
						}),
					},
					null,
					2,
				),
				"utf8",
			)
			console.log(`\n✓ Build version written: ${version}`)
		},
	}
}

// https://vitejs.dev/config/
export default defineConfig({
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
				sourcemap: enableSourceMap,
			},
		}),
		vue(),
		viteStaticCopy({
			targets: [
				{
					src: "src/workers",
					dest: ".",
				},
			],
		}),
		VitePWA({
			registerType: "autoUpdate",
			strategies: "injectManifest",
			srcDir: "src",
			filename: "sw.js",
			scope: "/",
			injectRegister: null,
			injectManifest: {
				// html is intentionally excluded: pos_next/public/pos/index.html is a
				// Jinja template (frappe-ui jinjaBootData: true).  Precaching it raw
				// causes "Unexpected token '%'" when the SW serves it without Frappe's
				// Jinja rendering — blank white screen.  Instead, sw.js caches the
				// server-rendered version at runtime (see RENDERED_SHELL_CACHE logic).
				globPatterns: ["**/*.{js,css,ico,png,svg,woff,woff2}"],
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
			},
			includeAssets: ["favicon.png", "icon.svg", "icon-maskable.svg"],
			manifest: {
				name: "POSNext",
				short_name: "POSNext",
				description:
					"Point of Sale system with real-time billing, stock management, and offline support",
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
						purpose: "any",
					},
					{
						src: "/assets/pos_next/pos/icon.svg",
						sizes: "512x512",
						type: "image/svg+xml",
						purpose: "any",
					},
					{
						src: "/assets/pos_next/pos/icon-maskable.svg",
						sizes: "192x192",
						type: "image/svg+xml",
						purpose: "maskable",
					},
					{
						src: "/assets/pos_next/pos/icon-maskable.svg",
						sizes: "512x512",
						type: "image/svg+xml",
						purpose: "maskable",
					},
				],
			},
			devOptions: {
				enabled: true,
				type: "module",
			},
		}),
	],
	build: {
		chunkSizeWarningLimit: 1500,
		outDir: "../pos_next/public/pos",
		emptyOutDir: true,
		target: "es2015",
		sourcemap: enableSourceMap,
	},
	worker: {
		format: "es",
		rollupOptions: {
			output: {
				format: "es",
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
			"tailwind.config.js": path.resolve(__dirname, "tailwind.config.js"),
		},
	},
	define: {
		__BUILD_VERSION__: JSON.stringify(buildVersion),
	},
	optimizeDeps: {
		include: [
			"feather-icons",
			"showdown",
			"highlight.js/lib/core",
			"interactjs",
		],
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
					const site_name = req.headers.host.split(":")[0]
					// Support both localhost and 127.0.0.1
					const isLocalhost =
						site_name === "localhost" || site_name === "127.0.0.1"
					const targetHost = isLocalhost ? "127.0.0.1" : site_name
					return `http://${targetHost}:8000`
				},
			},
		},
	},
})
