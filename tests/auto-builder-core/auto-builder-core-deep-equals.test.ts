import { describe, expect, it } from "vitest";

import { deepClone, deepEquals } from "../../src/auto-builder-core";

class Point {
	constructor(
		public x: number,
		public y: number,
	) {}
}

class AlsoAPoint {
	constructor(
		public x: number,
		public y: number,
	) {}
}

// The class builder uses this to tell a field initializer's untouched default apart from a
// value the target constructor derived from the builder's data, so it has to agree with
// `deepClone` on every shape that helper reproduces.
describe("deepEquals - built-in types", () => {
	it("compares primitives by value", () => {
		expect(deepEquals(1, 1)).toBe(true);
		expect(deepEquals("a", "a")).toBe(true);
		expect(deepEquals(1, 2)).toBe(false);
		expect(deepEquals(1, "1")).toBe(false);
		expect(deepEquals(null, undefined)).toBe(false);
	});

	it("treats NaN as equal to itself so a NaN default is not read as a derived value", () => {
		expect(deepEquals(Number.NaN, Number.NaN)).toBe(true);
	});

	it("distinguishes 0 from -0", () => {
		expect(deepEquals(0, -0)).toBe(false);
	});

	it("compares Dates by their time value", () => {
		expect(deepEquals(new Date(0), new Date(0))).toBe(true);
		expect(deepEquals(new Date(0), new Date(1))).toBe(false);
	});

	it("compares RegExps by source and flags", () => {
		expect(deepEquals(/abc/gi, /abc/gi)).toBe(true);
		expect(deepEquals(/abc/gi, /abc/g)).toBe(false);
		expect(deepEquals(/abc/g, /abd/g)).toBe(false);
	});

	it("compares arrays element-wise and by length", () => {
		expect(deepEquals([1, [2, 3]], [1, [2, 3]])).toBe(true);
		expect(deepEquals([1, 2], [1, 2, 3])).toBe(false);
		expect(deepEquals([1, 2], [2, 1])).toBe(false);
	});

	it("compares Maps by size and by value per key", () => {
		expect(deepEquals(new Map([["a", 1]]), new Map([["a", 1]]))).toBe(true);
		expect(deepEquals(new Map([["a", 1]]), new Map([["a", 2]]))).toBe(false);
		expect(deepEquals(new Map([["a", 1]]), new Map([["b", 1]]))).toBe(false);
		expect(
			deepEquals(
				new Map([["a", 1]]),
				new Map([
					["a", 1],
					["b", 2],
				]),
			),
		).toBe(false);
	});

	it("compares Sets by size and membership", () => {
		expect(deepEquals(new Set(["x"]), new Set(["x"]))).toBe(true);
		expect(deepEquals(new Set(["x"]), new Set(["y"]))).toBe(false);
		expect(deepEquals(new Set(["x"]), new Set(["x", "y"]))).toBe(false);
	});
});

describe("deepEquals - objects", () => {
	it("compares nested plain objects structurally", () => {
		expect(deepEquals({ deep: { value: 1 } }, { deep: { value: 1 } })).toBe(true);
		expect(deepEquals({ deep: { value: 1 } }, { deep: { value: 2 } })).toBe(false);
	});

	it("rejects objects whose key sets differ", () => {
		expect(deepEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false);
		expect(deepEquals({ a: 1, b: 2 }, { a: 1 })).toBe(false);
		expect(deepEquals({ a: undefined }, {})).toBe(false);
	});

	it("rejects instances of different classes that share a shape", () => {
		// Without this a rebuilt value could be read as an untouched default purely because it
		// happened to have matching keys.
		expect(deepEquals(new Point(1, 2), new AlsoAPoint(1, 2))).toBe(false);
		expect(deepEquals(new Point(1, 2), { x: 1, y: 2 })).toBe(false);
	});

	it("compares two instances of the same class structurally", () => {
		expect(deepEquals(new Point(1, 2), new Point(1, 2))).toBe(true);
		expect(deepEquals(new Point(1, 2), new Point(1, 3))).toBe(false);
	});

	it("terminates on cyclic structures", () => {
		const left: Record<string, unknown> = { name: "root" };
		left.self = left;
		const right: Record<string, unknown> = { name: "root" };
		right.self = right;

		expect(deepEquals(left, right)).toBe(true);
	});

	it("considers a deep clone equal to its source", () => {
		const source = {
			when: new Date(0),
			pattern: /abc/gi,
			lookup: new Map([["a", 1]]),
			tags: new Set(["x"]),
			nested: { deep: { value: 1 } },
			list: [1, 2, 3],
			point: new Point(1, 2),
		};

		expect(deepEquals(deepClone(source), source)).toBe(true);
	});
});
