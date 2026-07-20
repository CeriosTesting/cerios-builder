import { describe, expect, it } from "vitest";

import { RESERVED_BUILDER_NAMES } from "../../src/auto-builder-core";
import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";
import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";

type Plain = { name: string };

class Instance {
	name!: string;

	constructor(data?: Partial<Instance>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}

class PlainBuilder extends CeriosAutoBuilder<Plain>() {
	static create(): PlainBuilder {
		return new PlainBuilder({});
	}
}

class InstanceBuilder extends CeriosClassAutoBuilder(Instance) {
	static create(): InstanceBuilder {
		return new InstanceBuilder();
	}
}

const RESERVED = new Set<string>(RESERVED_BUILDER_NAMES);

// `then` and `toJSON` are reserved without being real members: the proxy intercepts them so
// `await builder` resolves and `JSON.stringify(builder)` does not serialise a setter.
const RESERVED_WITHOUT_MEMBER = new Set(["then", "toJSON"]);

// `__proto__` is the reverse: a real member that must NOT be reserved. Reserving it
// generated a `__proto__Prop` setter which mapped back to the `__proto__` key and
// re-parented the built object - on the class builder that silently stripped the instance
// of its prototype and every method. It is rejected by `assertSafeKey` instead, and the
// proxy's `prop in target` fallback still returns the real accessor.
const DELIBERATELY_UNRESERVED = new Set(["__proto__"]);

/**
 * Every name reachable on the instance, walking the prototype chain through Object.prototype.
 * This is exactly the set the proxy's `prop in target` check would match.
 */
function reachableNames(instance: object): string[] {
	const found = new Set<string>();
	let current: object | null = instance;
	while (current) {
		for (const name of Object.getOwnPropertyNames(current)) {
			found.add(name);
		}
		current = Object.getPrototypeOf(current) as object | null;
	}
	return [...found];
}

// The auto setters are generated from RESERVED_BUILDER_NAMES, while the proxy falls back to
// `prop in target`. If a real member is missing from the list, the generated type says
// "bare setter" and the runtime hands back the real method instead - a silent mismatch that
// corrupts state rather than raising an error. These tests keep the two in lockstep.
describe("auto builder reserved names", () => {
	it("reserves every runtime member of the object auto builder", () => {
		const missing = reachableNames(PlainBuilder.create() as object).filter(
			(name) => !RESERVED.has(name) && !DELIBERATELY_UNRESERVED.has(name),
		);

		expect(missing).toEqual([]);
	});

	it("reserves every runtime member of the class auto builder", () => {
		const missing = reachableNames(InstanceBuilder.create() as object).filter(
			(name) => !RESERVED.has(name) && !DELIBERATELY_UNRESERVED.has(name),
		);

		expect(missing).toEqual([]);
	});

	it("has no stale entries - every reserved name is a real member of one of the builders", () => {
		const real = new Set([
			...reachableNames(PlainBuilder.create() as object),
			...reachableNames(InstanceBuilder.create() as object),
		]);
		const stale = [...RESERVED].filter((name) => !real.has(name) && !RESERVED_WITHOUT_MEMBER.has(name));

		expect(stale).toEqual([]);
	});

	it("routes every reserved name to a *Prop setter that sets the underlying property", () => {
		for (const name of RESERVED_BUILDER_NAMES) {
			const builder = PlainBuilder.create() as unknown as Record<string, (value: unknown) => unknown>;
			const stepped = builder[`${name}Prop`]("x") as { buildPartial(): Record<string, unknown> };

			expect(stepped.buildPartial()[name]).toBe("x");
		}
	});

	it("returns the real member, never a setter, for a bare reserved name", () => {
		const builder = PlainBuilder.create() as unknown as Record<string, unknown>;
		const memberless = [...RESERVED_BUILDER_NAMES].filter((name) => RESERVED_WITHOUT_MEMBER.has(name));
		const withMember = [...RESERVED_BUILDER_NAMES].filter((name) => !RESERVED_WITHOUT_MEMBER.has(name));

		for (const name of memberless) {
			expect(builder[name]).toBeUndefined();
		}
		for (const name of withMember) {
			// A setter would be a fresh 1-arg arrow function on every access; a real member
			// is stable across accesses.
			expect(builder[name]).toBe(builder[name]);
		}
	});
});
