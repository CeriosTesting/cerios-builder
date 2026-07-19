import { describe, expect, it } from "vitest";

import { deepClone, deepHarden } from "../../src/auto-builder-core";
import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";

type Bag = {
	when?: Date;
	pattern?: RegExp;
	lookup?: Map<string, number>;
	tags?: Set<string>;
	nested?: { deep: { value: number } };
	list?: number[];
	// `unknown`, not `any`: a cyclic fixture typed as `any` makes the recursive Path<T>
	// helper expand without bound.
	cyclic?: unknown;
};

class BagBuilder extends CeriosAutoBuilder<Bag>() {
	static create(): BagBuilder {
		return new BagBuilder({});
	}
}

// A plain key-walk turns every one of these into `{}` and overflows the stack on a cycle.
// Both base builders and both auto builders share this one implementation.
describe("deepClone - built-in types", () => {
	it("round-trips a Date as a Date, not an empty object", () => {
		const source = new Date(0);
		const cloned = deepClone({ when: source }).when;

		expect(cloned).toBeInstanceOf(Date);
		expect(cloned.getTime()).toBe(0);
		expect(cloned).not.toBe(source);
	});

	it("round-trips a RegExp with its flags", () => {
		const cloned = deepClone({ pattern: /abc/gi }).pattern;

		expect(cloned).toBeInstanceOf(RegExp);
		expect(cloned.source).toBe("abc");
		expect(cloned.flags).toBe("gi");
	});

	it("round-trips a Map and a Set, deep-cloning their contents", () => {
		const source = { lookup: new Map([["a", 1]]), tags: new Set(["x"]) };
		const cloned = deepClone(source);

		expect(cloned.lookup).toBeInstanceOf(Map);
		expect(cloned.lookup.get("a")).toBe(1);
		expect(cloned.tags).toBeInstanceOf(Set);
		expect(cloned.tags.has("x")).toBe(true);
		expect(cloned.lookup).not.toBe(source.lookup);
	});

	it("preserves an own key literally named __proto__", () => {
		// JSON.parse produces exactly this. Plain assignment hits Object.prototype's setter
		// and drops the key.
		const parsed = JSON.parse('{"__proto__":{"x":1},"a":2}') as Record<string, unknown>;
		const cloned = deepClone({ data: parsed }).data;

		expect(Object.keys(cloned).sort()).toEqual(["__proto__", "a"]);
		expect(({} as Record<string, unknown>).x).toBeUndefined();
	});

	it("terminates on a self-referencing object and preserves the cycle", () => {
		const cyclic: Record<string, unknown> = { n: 1 };
		cyclic.self = cyclic;

		const cloned = deepClone(cyclic);

		expect(cloned.n).toBe(1);
		expect(cloned.self).toBe(cloned);
		expect(cloned).not.toBe(cyclic);
	});

	it("preserves shared references rather than duplicating them", () => {
		const shared = { id: 1 };
		const cloned = deepClone({ a: shared, b: shared });

		expect(cloned.a).toBe(cloned.b);
	});
});

describe("deepHarden - cycles", () => {
	it("freezes a self-referencing object without overflowing the stack", () => {
		const cyclic: Record<string, unknown> = { n: 1 };
		cyclic.self = cyclic;

		expect(() => deepHarden(cyclic, "freeze")).not.toThrow();
		expect(Object.isFrozen(cyclic)).toBe(true);
	});

	it("seals a self-referencing object without overflowing the stack", () => {
		const cyclic: Record<string, unknown> = { n: 1 };
		cyclic.self = cyclic;

		expect(() => deepHarden(cyclic, "seal")).not.toThrow();
		expect(Object.isSealed(cyclic)).toBe(true);
	});
});

describe("builders with awkward data", () => {
	it("seeds from an object holding a Date and keeps it usable", () => {
		const built = BagBuilder.from({ when: new Date(0) }).build();

		expect(built.when).toBeInstanceOf(Date);
	});

	it("clones a builder holding a Date without flattening it", () => {
		const cloned = BagBuilder.create().when(new Date(0)).clone();

		expect(cloned.buildPartial().when).toBeInstanceOf(Date);
	});

	it("deep-freezes cyclic data instead of overflowing the stack", () => {
		const cyclic: Record<string, unknown> = { n: 1 };
		cyclic.self = cyclic;

		expect(() => BagBuilder.create().cyclic(cyclic).buildDeepFrozen()).not.toThrow();
	});
});
