/**
 * Deterministic pretty JSON for the generated data files: one tab per level, a trailing
 * newline, and numbers written the way prettier prints them (`1.989e27`, never
 * `1.989e+27`), so `prettier --check` accepts the build output unchanged.
 * Keys keep their insertion order; the build constructs every object in a fixed order.
 */

const formatNumber = (value: number): string => {
	if (!Number.isFinite(value)) {
		throw new RangeError(`cannot serialize ${value} as JSON`)
	}
	return String(value).replace("e+", "e")
}

export const stringifyPretty = (value: unknown, indent = ""): string => {
	if (value === null) return "null"
	switch (typeof value) {
		case "number":
			return formatNumber(value)
		case "string":
		case "boolean":
			return JSON.stringify(value)
		case "object": {
			const inner = `${indent}\t`
			if (Array.isArray(value)) {
				if (value.length === 0) return "[]"
				const items = value.map(
					(item) => `${inner}${stringifyPretty(item, inner)}`,
				)
				return `[\n${items.join(",\n")}\n${indent}]`
			}
			const entries = Object.entries(value as Record<string, unknown>).filter(
				([, item]) => item !== undefined,
			)
			if (entries.length === 0) return "{}"
			const lines = entries.map(
				([key, item]) =>
					`${inner}${JSON.stringify(key)}: ${stringifyPretty(item, inner)}`,
			)
			return `{\n${lines.join(",\n")}\n${indent}}`
		}
		default:
			throw new TypeError(`cannot serialize a ${typeof value} as JSON`)
	}
}

/** Whole-file form: pretty JSON plus the trailing newline every editor expects. */
export const toJsonFile = (value: unknown): string =>
	`${stringifyPretty(value)}\n`
