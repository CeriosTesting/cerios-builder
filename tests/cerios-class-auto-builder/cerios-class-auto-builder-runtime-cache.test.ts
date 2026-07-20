import { describe, expect, expectTypeOf, it } from "vitest";

import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";

class Person {
	name!: string;
	age?: number;

	constructor(data?: Partial<Person>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	greet(): string {
		return `hi ${this.name}`;
	}
}

class Other {
	label!: string;

	constructor(data?: Partial<Other>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}

// The factory memoises one runtime class per target class. Before that, every call minted a
// new class, so `instanceof` silently failed across two calls and every call added a
// distinct object shape.
describe("CeriosClassAutoBuilder - runtime class identity", () => {
	it("returns the same runtime class for the same target class", () => {
		expect(CeriosClassAutoBuilder(Person)).toBe(CeriosClassAutoBuilder(Person));
	});

	it("returns different runtime classes for different target classes", () => {
		expect(CeriosClassAutoBuilder(Person)).not.toBe(CeriosClassAutoBuilder(Other));
	});

	it("keeps instanceof working across separate factory calls", () => {
		class Sub extends CeriosClassAutoBuilder(Person) {}

		expect(new Sub() instanceof CeriosClassAutoBuilder(Person)).toBe(true);
	});

	it("builds the correct class from two subclasses sharing a runtime class", () => {
		class First extends CeriosClassAutoBuilder(Person) {}
		class Second extends CeriosClassAutoBuilder(Person) {}

		expect(new First().name("a").build()).toBeInstanceOf(Person);
		expect(new Second().name("b").build().greet()).toBe("hi b");
	});
});

// Sharing one runtime class means anything written to it is shared. Per-subclass statics
// stay isolated because the required-field lookup reads `this.constructor`.
describe("CeriosClassAutoBuilder - static isolation between consumers", () => {
	it("keeps a subclass required-field list off its siblings", () => {
		class Strict extends CeriosClassAutoBuilder(Person) {
			static requiredDataProperties: ReadonlyArray<string> = ["name"];
		}
		class Loose extends CeriosClassAutoBuilder(Person) {}

		expect(() => new Strict().age(1).buildWithoutCompileTimeValidation()).toThrow("Missing required fields: name");
		expect(() => new Loose().age(1).buildWithoutCompileTimeValidation()).not.toThrow();
	});

	it("does not expose a settable required-fields static on the shared base", () => {
		const Base = CeriosClassAutoBuilder(Person);

		// Memoisation means this object is shared by every consumer of `Person`, so writing
		// a static onto it would be visible to all of them. The deprecated static is no
		// longer part of the returned constructor type, so the supported path is blocked at
		// compile time. It is deliberately not locked at runtime: `target: es2019` gives
		// class static fields `[[Set]]` semantics, and a non-writable base property would
		// then break a subclass declaring its own `static requiredDataProperties`.
		// This assertion is compile-time only - no runtime write, which would leak into
		// every later test in this file.
		expectTypeOf(Base).not.toHaveProperty("requiredDataProperties");
	});

	it("keeps each subclass's own validators and required fields separate", () => {
		class WithValidator extends CeriosClassAutoBuilder(Person) {
			constructor(data?: Partial<Person>) {
				super(data, { validators: [(p): boolean | string => (p.name === "bad" ? "nope" : true)] });
			}
		}
		class Plain extends CeriosClassAutoBuilder(Person) {}

		expect(() => new WithValidator().name("bad").build()).toThrow("nope");
		expect(() => new Plain().name("bad").build()).not.toThrow();
	});
});
