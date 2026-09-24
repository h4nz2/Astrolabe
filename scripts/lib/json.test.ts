import { describe, expect, it } from "vitest"

import { stringifyPretty, toJsonFile } from "./json"

describe("stringifyPretty", () => {
	it("indents with tabs and keeps key order", () => {
		expect(stringifyPretty({ b: 1, a: [true, null, "x"] })).toBe(
			'{\n\t"b": 1,\n\t"a": [\n\t\ttrue,\n\t\tnull,\n\t\t"x"\n\t]\n}',
		)
		expect(stringifyPretty({})).toBe("{}")
		expect(stringifyPretty([])).toBe("[]")
	})

	it("writes exponents the way prettier does", () => {
		expect(stringifyPretty(1.989e27)).toBe("1.989e27")
		expect(stringifyPretty(1.5e-7)).toBe("1.5e-7")
		expect(stringifyPretty(1476200000000000)).toBe("1476200000000000")
		expect(stringifyPretty(2451545.0)).toBe("2451545")
	})

	it("skips undefined members and refuses non-JSON values", () => {
		expect(stringifyPretty({ a: undefined, b: 2 })).toBe('{\n\t"b": 2\n}')
		expect(() => stringifyPretty(Number.NaN)).toThrow(RangeError)
		expect(() => stringifyPretty(() => 1)).toThrow(TypeError)
	})

	it("round-trips through JSON.parse and ends the file with a newline", () => {
		const value = { id: "sun", massKg: 1.989e30, list: [{ x: -0.5 }], n: null }
		const text = toJsonFile(value)
		expect(text.endsWith("\n")).toBe(true)
		expect(JSON.parse(text)).toEqual(value)
	})
})
