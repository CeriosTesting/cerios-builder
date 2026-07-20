import { describe, expect, it } from "vitest";

import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";

class Person {
	name!: string;
	age!: number;
	email?: string;
	phone?: string;
	address?: { street: string; city: string };

	constructor(data?: Partial<Person>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}

class PersonBuilder extends CeriosClassAutoBuilder(Person) {
	static create(): PersonBuilder {
		return new PersonBuilder();
	}
}

class StaticRequiredBuilder extends CeriosClassAutoBuilder(Person) {
	static requiredDataProperties: ReadonlyArray<string> = ["name", "address.city"];

	static create(): StaticRequiredBuilder {
		return new StaticRequiredBuilder();
	}
}

describe("CeriosClassAutoBuilder - removeOptionalProperty", () => {
	it("drops a previously set optional data property", () => {
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

describe("CeriosClassAutoBuilder - clearOptionalProperties", () => {
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

	// A required path may point inside a nested object. The root has to survive, otherwise
	// the required leaf is destroyed by the very call that is meant to preserve it.
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

	it("preserves a nested required root supplied via static requiredDataProperties", () => {
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
