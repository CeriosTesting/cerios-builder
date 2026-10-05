import { describe, expect, expectTypeOf, it } from "vitest";

import { BuildableThis } from "../../src/auto-builder-core";
import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";
import { InternalBuilderBrand } from "../../src/cerios-builder";
import { MissingRequiredProperties } from "../../src/types";

type Person = {
	name: string;
	age: number;
	email?: string;
	phone?: string;
	address?: { street: string; city: string };
};

class PersonBuilder extends CeriosAutoBuilder<Person>() {
	static create(): PersonBuilder {
		return new PersonBuilder({});
	}
}

class StaticRequiredBuilder extends CeriosAutoBuilder<Person>() {
	static requiredTemplate: ReadonlyArray<string> = ["name", "address.city"];

	static create(): StaticRequiredBuilder {
		return new StaticRequiredBuilder({});
	}
}

describe("CeriosAutoBuilder - removeOptionalProperty", () => {
	it("drops a previously set optional property", () => {
		const builder = PersonBuilder.create().name("John").age(30).email("j@x.io").removeOptionalProperty("email");

		expect(builder.buildPartial()).toEqual({ name: "John", age: 30 });
	});

	it("returns a new builder, leaving the original intact", () => {
		const withEmail = PersonBuilder.create().name("John").email("j@x.io");
		const without = withEmail.removeOptionalProperty("email");

		expect(withEmail.buildPartial().email).toBe("j@x.io");
		expect(without.buildPartial().email).toBeUndefined();
	});

	it("preserves validators and required fields across the removal", () => {
		const builder = PersonBuilder.create()
			.setRequiredFields(["name", "age"])
			.addValidator((p) => (p.name === "" ? "Name must not be empty" : true))
			.name("John")
			.email("j@x.io")
			.removeOptionalProperty("email");

		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: age");
	});
});

describe("CeriosAutoBuilder - removeRequiredProperty", () => {
	// The `this` type the validated build variants demand from a given builder.
	type BuildThis<B> = BuildableThis<B, InternalBuilderBrand<Person>>;

	// Builders are immutable, so every test can fork from the same complete builder.
	const complete = PersonBuilder.create().name("John").age(30).email("j@x.io");

	it("drops a previously set required property", () => {
		const builder = complete.removeRequiredProperty("name");

		expect(builder.buildPartial()).toEqual({ age: 30, email: "j@x.io" });
		expect(builder.buildUnsafe()).toEqual({ age: 30, email: "j@x.io" });
	});

	it("returns a new builder, leaving the original intact and buildable", () => {
		const original = complete;
		const without = original.removeRequiredProperty("name");

		expect(without.buildPartial().name).toBeUndefined();
		expect(original.build()).toEqual({ name: "John", age: 30, email: "j@x.io" });
	});

	it("blocks every compile-time-validated build variant", () => {
		const without = complete.removeRequiredProperty("name");

		expect(() => {
			// @ts-expect-error - name was removed
			without.build();
			// @ts-expect-error - name was removed
			without.buildWithoutRuntimeValidation();
			// @ts-expect-error - name was removed
			without.buildFrozen();
			// @ts-expect-error - name was removed
			without.buildDeepFrozen();
			// @ts-expect-error - name was removed
			without.buildSealed();
			// @ts-expect-error - name was removed
			without.buildDeepSealed();
		}).not.toThrow(); // no runtime required fields are configured on this builder
	});

	it("names the removed properties in the build error", () => {
		const one = complete.removeRequiredProperty("name");
		const two = complete.removeRequiredProperty("name").removeRequiredProperty("age");

		expectTypeOf<BuildThis<typeof one>>().toEqualTypeOf<MissingRequiredProperties<"name">>();
		expectTypeOf<BuildThis<typeof two>>().toEqualTypeOf<MissingRequiredProperties<"name" | "age">>();
		expect(two.buildPartial()).toEqual({ email: "j@x.io" });
	});

	it("keeps the removal on the builder even if the property is set again; fork from earlier instead", () => {
		const original = complete;
		const reSet = original.removeRequiredProperty("name").name("Jane");

		// @ts-expect-error - the compile-time tracking cannot forget a removal
		reSet.build();
		expect(reSet.buildUnsafe().name).toBe("Jane");

		// Builders are immutable: the builder from before the removal still builds.
		expect(original.name("Jane").build().name).toBe("Jane");
	});

	it("only accepts required keys", () => {
		// @ts-expect-error - email is optional; use removeOptionalProperty
		complete.removeRequiredProperty("email");
		// @ts-expect-error - name is required; use removeRequiredProperty
		complete.removeOptionalProperty("name");

		expect(complete.removeOptionalProperty("email").build().email).toBeUndefined();
	});

	it("keeps validators, required fields, and the removal across clone()", () => {
		const builder = PersonBuilder.create()
			.setRequiredFields(["name", "age"])
			.name("John")
			.age(30)
			.removeRequiredProperty("name")
			.clone();

		// @ts-expect-error - clone() carries the removal
		expect(() => builder.build()).toThrow("Missing required fields: name");
		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: name");
	});
});

describe("CeriosAutoBuilder - clearOptionalProperties", () => {
	it("keeps root required properties and clears the rest", () => {
		const builder = PersonBuilder.create()
			.setRequiredFields(["name", "age"])
			.name("John")
			.age(30)
			.email("j@x.io")
			.phone("555")
			.clearOptionalProperties();

		expect(builder.buildPartial()).toEqual({ name: "John", age: 30 });
	});

	it("clears everything when no required fields are configured", () => {
		const builder = PersonBuilder.create().name("John").email("j@x.io").clearOptionalProperties();

		expect(builder.buildPartial()).toEqual({});
	});

	it("preserves the root object of a nested required path", () => {
		const builder = PersonBuilder.create()
			.setRequiredFields(["name", "address.city"])
			.name("John")
			.address({ street: "Main St", city: "Springfield" })
			.email("j@x.io")
			.clearOptionalProperties();

		expect(builder.buildPartial()).toEqual({
			name: "John",
			address: { street: "Main St", city: "Springfield" },
		});
	});

	it("preserves a nested required root supplied via static requiredTemplate", () => {
		const builder = StaticRequiredBuilder.create()
			.name("John")
			.address({ street: "Main St", city: "Springfield" })
			.email("j@x.io")
			.clearOptionalProperties();

		expect(builder.buildPartial().address?.city).toBe("Springfield");
	});

	it("still satisfies runtime validation of a nested required path afterwards", () => {
		const builder = PersonBuilder.create()
			.setRequiredFields(["name", "address.city"])
			.name("John")
			.address({ street: "Main St", city: "Springfield" })
			.email("j@x.io")
			.clearOptionalProperties();

		expect(() => builder.buildWithoutCompileTimeValidation()).not.toThrow();
	});
});
