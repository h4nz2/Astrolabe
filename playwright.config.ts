import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.E2E_PORT) || 4173
const baseURL = `http://localhost:${port}`

export default defineConfig({
	testDir: "e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL,
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				launchOptions: {
					// software WebGL so the three.js canvases render on headless CI machines
					args: [
						"--use-gl=angle",
						"--use-angle=swiftshader",
						"--enable-unsafe-swiftshader",
					],
				},
			},
		},
	],
	webServer: {
		// Serves dist/: run `pnpm build` first. Vite is started directly, not through
		// `pnpm preview`: pnpm runs scripts in their own process group, so Playwright's
		// process-group kill misses the server and the run hangs forever at teardown.
		command: `node node_modules/vite/bin/vite.js preview --port ${port} --strictPort`,
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
	},
})
