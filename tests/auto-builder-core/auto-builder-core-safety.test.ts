import { describe, expect, it } from "vitest";

import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";
import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";

type Config = {
	name: string;
	nested?: { inner: { count: number } };
};

class Person {
	name!: string;

	constructor(data?: Partial<Person>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}

class ConfigBuilder extends CeriosAutoBuilder<Config>() {
	static create(): ConfigBuilder {
		return new ConfigBuilder({});
	}
}

// Handing back `this._actual` let a caller mutate the builder through the built object,
// and buildFrozen() froze the builder's own state in place.
describe("build variants return owned state", () => {
	it("build() does not alias the builder's internal state", () => {
		const builder = ConfigBuilder.create()
			.name("n")
			.nested({ inner: { count: 1 } });

		const first = builder.build();
		first.nested!.inner.count = 99;

		expect(builder.build().nested?.inner.count).toBe(1);
	});

	it("returns a distinct object on each build", () => {
		const builder = ConfigBuilder.create().name("n");

		expect(builder.build()).not.toBe(builder.build());
	});

	it("buildUnsafe() does not alias the builder's internal state", () => {
		const builder = ConfigBuilder.create().name("n");
		builder.buildUnsafe().name = "mutated";

		expect(builder.buildUnsafe().name).toBe("n");
	});

	it("buildPartial() does not leak nested state", () => {
		const builder = ConfigBuilder.create()
			.name("n")
			.nested({ inner: { count: 1 } });

		const partial = builder.buildPartial();
		partial.nested!.inner.count = 99;

		expect(builder.buildPartial().nested?.inner.count).toBe(1);
	});

	it("buildFrozen() freezes the result without freezing the builder", () => {
		const builder = ConfigBuilder.create().name("n");
		const frozen = builder.buildFrozen();

		expect(Object.isFrozen(frozen)).toBe(true);
		// The builder must remain usable; it used to have its own state frozen underneath it.
		expect(builder.name("other").build().name).toBe("other");
	});
});

describe("prototype-unsafe paths are rejected", () => {
	it("refuses __proto__ in a nested path instead of silently swallowing the write", () => {
		const builder = ConfigBuilder.create() as unknown as {
			setNestedProperty: (path: string, value: unknown) => unknown;
		};

		expect(() => builder.setNestedProperty("__proto__.polluted", "yes")).toThrow("Unsafe property path");
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});

	it("refuses constructor and prototype segments", () => {
		const builder = ConfigBuilder.create() as unknown as {
			setNestedProperty: (path: string, value: unknown) => unknown;
		};

		expect(() => builder.setNestedProperty("constructor.x", "y")).toThrow("Unsafe property path");
		expect(() => builder.setNestedProperty("a.prototype.x", "y")).toThrow("Unsafe property path");
	});
});

describe("ambiguous constructor options are rejected", () => {
	it("refuses a bare required-fields record passed positionally", () => {
		// This structurally matches BuilderInit, so it used to be accepted and silently
		// produce a builder with zero required fields.
		expect(() => new (ConfigBuilder as never as new (d: object, i: object) => unknown)({}, { name: true })).toThrow(
			"Invalid builder options",
		);
	});

	it("refuses it on the class auto builder too", () => {
		class PersonBuilder extends CeriosClassAutoBuilder(Person) {}

		expect(() => new (PersonBuilder as never as new (d: object, i: object) => unknown)({}, { name: true })).toThrow(
			"Invalid builder options",
		);
	});

	it("still accepts an empty options object and the correct wrapped form", () => {
		expect(() => new (ConfigBuilder as never as new (d: object, i: object) => unknown)({}, {})).not.toThrow();
		expect(
			() =>
				new (ConfigBuilder as never as new (d: object, i: object) => unknown)({}, { requiredFields: { name: true } }),
		).not.toThrow();
	});
});

describe("class auto builder runtime identity", () => {
	it("returns the same runtime class for the same target class", () => {
		expect(CeriosClassAutoBuilder(Person)).toBe(CeriosClassAutoBuilder(Person));
	});

	it("keeps instanceof working across separate factory calls", () => {
		class BuilderA extends CeriosClassAutoBuilder(Person) {}
		const Base = CeriosClassAutoBuilder(Person);

		expect(new BuilderA() instanceof Base).toBe(true);
	});

	it("keeps separate target classes on separate runtime classes", () => {
		class Other {
			label!: string;

			constructor(data?: Partial<Other>) {
				if (data) {
					Object.assign(this, data);
				}
			}
		}

		expect(CeriosClassAutoBuilder(Person)).not.toBe(CeriosClassAutoBuilder(Other));
	});

	it("builds the right class from two builders sharing one runtime class", () => {
		class First extends CeriosClassAutoBuilder(Person) {}
		class Second extends CeriosClassAutoBuilder(Person) {}

		expect(new First().name("a").build()).toBeInstanceOf(Person);
		expect(new Second().name("b").build()).toBeInstanceOf(Person);
	});
});
