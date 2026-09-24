import js from "@eslint/js"
import { defineConfig, globalIgnores } from "eslint/config"
import prettier from "eslint-config-prettier"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"
import tseslint from "typescript-eslint"

export default defineConfig(
	globalIgnores([
		"dist",
		"node_modules",
		"src/routeTree.gen.ts",
		"playwright-report",
		"test-results",
	]),
	js.configs.recommended,
	tseslint.configs.recommended,
	reactHooks.configs.flat["recommended-latest"],
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
		rules: {
			"no-console": "warn",
			"prefer-template": "warn",
		},
	},
	// the solar system's camera has one owner (docs/ARCHITECTURE.md, "Navigation"):
	// features ask the store for a view instead of creating controls of their own
	{
		files: ["src/features/solarSystem/**/*.{ts,tsx}"],
		ignores: ["src/features/solarSystem/camera/**"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "@react-three/drei",
							importNames: [
								"CameraControls",
								"CameraControlsImpl",
								"OrbitControls",
								"MapControls",
								"TrackballControls",
								"ArcballControls",
								"FlyControls",
								"FirstPersonControls",
								"PointerLockControls",
								"PresentationControls",
								"Bounds",
							],
							message:
								"The camera has one owner (features/solarSystem/camera). Ask the store for a view instead: focus(id), overview(), goTo(view).",
						},
					],
				},
			],
		},
	},
	// keep last: turns off every rule that would fight prettier
	prettier,
)
