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
	// keep last: turns off every rule that would fight prettier
	prettier,
)
