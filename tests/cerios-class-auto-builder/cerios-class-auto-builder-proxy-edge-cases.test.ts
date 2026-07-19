import { describe, expect, it } from "vitest";

import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";

class Weird {
	id!: string;
	build!: number; // collides with build() -> setter is buildProp
	clone!: string; // collides with clone() -> setter is cloneProp
	then!: string; // collides with then handling -> setter is thenProp
	"content-type"!: string; // not a valid identifier -> bracket access

	constructor(data?: Partial<Weird>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}

class Simple {
	id!: string;
	name!: string;

	constructor(data?: Partial<Simple>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	describe(prefix: string): string {
		return `${prefix}: ${this.name}`;
	}
}

class Base {
	inherited(): string {
		return "base";
	}
}

class Derived extends Base {
	id!: string;

	constructor(data?: Partial<Derived>) {
		super();
		if (data) {
			Object.assign(this, data);
		}
	}
}

class WeirdBuilder extends CeriosClassAutoBuilder(Weird) {
	static create(): WeirdBuilder {
		return new WeirdBuilder();
	}
}

class SimpleBuilder extends CeriosClassAutoBuilder(Simple) {
	static create(): SimpleBuilder {
		return new SimpleBuilder();
	}
}

class DerivedBuilder extends CeriosClassAutoBuilder(Derived) {
	static create(): DerivedBuilder {
		return new DerivedBuilder();
	}
}

describe("CeriosClassAutoBuilder - proxy edge cases", () => {
	it("should resolve immediately when awaited (not a thenable)", async () => {
		const builder = SimpleBuilder.create().id("1");
		// oxlint-disable-next-line await-thenable -- intentionally awaiting a non-thenable
		const resolved = await builder;
		expect(resolved.buildPartial()).toEqual({ id: "1" });
	});

	it("should not throw on JSON.stringify", () => {
		const builder = SimpleBuilder.create().id("1");
		expect(() => JSON.stringify(builder)).not.toThrow();
	});

	it("should not throw on console.log / inspection", () => {
		const builder = SimpleBuilder.create().id("1");
		expect(() => console.log(builder)).not.toThrow();
	});

	it("should expose real methods to the in operator", () => {
		const builder = SimpleBuilder.create();
		expect("build" in builder).toBe(true);
		expect("clone" in builder).toBe(true);
	});

	it("should route reserved-name properties through *Prop setters while keeping the real methods", () => {
		const weird = WeirdBuilder.create()
			.id("1")
			.buildProp(42)
			.cloneProp("c")
			.thenProp("t")
			.buildWithoutCompileTimeValidation();

		expect(weird).toBeInstanceOf(Weird);
		expect(weird.build).toBe(42);
		expect(weird.clone).toBe("c");
		expect(weird.then).toBe("t");
	});

	it("should keep build() and clone() working even when those property names are set", () => {
		const builder = WeirdBuilder.create().id("1").buildProp(42);

		expect(typeof builder.build).toBe("function");
		expect(builder.clone()).toBeInstanceOf(WeirdBuilder);
	});

	it("should set non-identifier keys via bracket access", () => {
		const builder = WeirdBuilder.create().id("1")["content-type"]("application/json");

		expect(builder.buildPartial()["content-type"]).toBe("application/json");
	});

	it("should not generate setters for the class's own methods", () => {
		const builder = SimpleBuilder.create() as unknown as Record<string, unknown>;

		// `describe` is a real method on Simple, not a data property, so it must not become
		// a setter - and the built instance must still carry it.
		expect(SimpleBuilder.create().id("1").name("John").build().describe("Name")).toBe("Name: John");
		expect(builder.describe).toBeTypeOf("function");
	});

	it("should not generate setters for inherited class methods", () => {
		const instance = DerivedBuilder.create().id("1").build();

		expect(instance.inherited()).toBe("base");
	});
});

// Names that are real members of the builder but were historically absent from
// RESERVED_BUILDER_NAMES. The proxy's `prop in target` fallback returned the real method
// while the generated type still advertised a bare setter, so calling one silently ran the
// wrong method - `createBuilder("x")` replaced the whole state with the string "x".
// They now route through `*Prop` like any other reserved name.
describe("CeriosClassAutoBuilder - unreserved member-name collisions", () => {
	const collisions = [
		"setProperty",
		"setProperties",
		"setNestedProperty",
		"addToArrayProperty",
		"createBuilder",
		"getClassConstructor",
		"getRequiredTemplate",
		"validateRequiredFields",
		"runValidators",
		"hasOwnProperty",
	] as const;

	for (const name of collisions) {
		it(`sets a data property named ${name} through ${name}Prop`, () => {
			const builder = WeirdBuilder.create() as unknown as Record<string, (value: unknown) => unknown>;
			const stepped = builder[`${name}Prop`]("x") as { buildPartial(): Record<string, unknown> };

			expect(stepped.buildPartial()).toEqual({ [name]: "x" });
		});

		it(`keeps the real ${name} member reachable under its bare name`, () => {
			const builder = WeirdBuilder.create() as unknown as Record<string, unknown>;

			expect(builder[name]).toBeTypeOf("function");
		});
	}
});
