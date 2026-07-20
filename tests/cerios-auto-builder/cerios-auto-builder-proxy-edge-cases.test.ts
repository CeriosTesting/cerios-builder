import { describe, expect, it } from "vitest";

import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";

type Weird = {
	id: string;
	build: number; // collides with build() -> setter is buildProp
	clone: string; // collides with clone() -> setter is cloneProp
	then: string; // collides with then handling -> setter is thenProp
	"content-type": string; // not a valid identifier -> bracket access
};

class WeirdBuilder extends CeriosAutoBuilder<Weird>() {
	static create(): WeirdBuilder {
		return new WeirdBuilder({});
	}
}

class SimpleBuilder extends CeriosAutoBuilder<{ id: string; name: string }>() {
	static create(): SimpleBuilder {
		return new SimpleBuilder({});
	}
}

describe("CeriosAutoBuilder - proxy edge cases", () => {
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

	it("should forward symbol properties to the target instead of minting setters", () => {
		const builder = SimpleBuilder.create().id("1");

		// Symbols can never be property setters; they resolve like on a plain object.
		expect(Reflect.get(builder, Symbol.toStringTag)).toBeUndefined();
		expect(Reflect.get(builder, Symbol.asyncIterator)).toBeUndefined();
	});

	it("should leave symbol-keyed target properties entirely outside the builder's model", () => {
		const kind = Symbol("kind");
		type Tagged = { id: string; [kind]?: string };

		class TaggedBuilder extends CeriosAutoBuilder<Tagged>() {
			static create(): TaggedBuilder {
				return new TaggedBuilder({});
			}
		}

		// AutoSetters keys on `keyof T & string`, so no setter exists for the symbol key -
		// at the type level or at runtime (symbol access forwards to the builder itself).
		const builder = TaggedBuilder.create().id("1");
		expect(Reflect.get(builder, kind)).toBeUndefined();
		expect(builder.build()[kind]).toBeUndefined();

		// A symbol-keyed value in the seed data does not survive either: state snapshots
		// deep-clone via string keys. Symbol-keyed properties cannot be built.
		const seeded = new TaggedBuilder({ id: "2", [kind]: "x" }).buildUnsafe();
		expect(seeded.id).toBe("2");
		expect(seeded[kind]).toBeUndefined();
	});

	it("should expose real methods to the in operator", () => {
		const builder = SimpleBuilder.create();
		expect("build" in builder).toBe(true);
		expect("clone" in builder).toBe(true);
	});

	it("should route reserved-name properties through *Prop setters while keeping the real methods", () => {
		const builder = WeirdBuilder.create()
			.id("1")
			.buildProp(42)
			.cloneProp("c")
			.thenProp("t")
			.buildWithoutCompileTimeValidation();

		expect(builder).toEqual({ id: "1", build: 42, clone: "c", then: "t" });
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
});

// Names that are real members of the builder but were historically absent from
// RESERVED_BUILDER_NAMES. The proxy's `prop in target` fallback returned the real method
// while the generated type still advertised a bare setter, so calling one silently ran the
// wrong method instead of setting the property. They now route through `*Prop`.
describe("CeriosAutoBuilder - unreserved member-name collisions", () => {
	const collisions = [
		"setProperty",
		"setProperties",
		"setNestedProperty",
		"addToArrayProperty",
		"instantiateBuilder",
		"getRequiredTemplate",
		"validateRequiredFields",
		"runValidators",
		"hasOwnProperty",
	] as const;

	for (const name of collisions) {
		it(`sets a property named ${name} through ${name}Prop`, () => {
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
