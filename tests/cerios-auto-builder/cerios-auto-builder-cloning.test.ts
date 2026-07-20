import { describe, expect, it } from "vitest";

import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";

type Person = {
	name: string;
	age: number;
	hobbies?: string[];
	address?: { street: string; city: string };
};

class PersonBuilder extends CeriosAutoBuilder<Person>() {
	static create(): PersonBuilder {
		return new PersonBuilder({});
	}
}

describe("CeriosAutoBuilder - clone", () => {
	it("returns an instance of the concrete subclass", () => {
		expect(PersonBuilder.create().name("John").clone()).toBeInstanceOf(PersonBuilder);
	});

	it("deep-clones nested objects, so mutating the clone does not affect the original", () => {
		const original = PersonBuilder.create().name("John").address({ street: "Main St", city: "Springfield" });
		const cloned = original.clone();

		const clonedAddress = cloned.buildPartial().address;
		if (clonedAddress) {
			clonedAddress.city = "Shelbyville";
		}

		expect(original.buildPartial().address?.city).toBe("Springfield");
	});

	it("deep-clones arrays", () => {
		const original = PersonBuilder.create().name("John").hobbies(["chess"]);
		const cloned = original.clone();

		cloned.buildPartial().hobbies?.push("running");

		expect(original.buildPartial().hobbies).toEqual(["chess"]);
	});

	it("preserves validators", () => {
		const cloned = PersonBuilder.create()
			.addValidator((p) => (p.age !== undefined && p.age >= 18 ? true : "Age must be 18 or older"))
			.name("John")
			.age(16)
			.clone();

		expect(() => cloned.build()).toThrow("Validation failed: Age must be 18 or older");
	});

	it("preserves instance-level required fields", () => {
		const cloned = PersonBuilder.create().setRequiredFields(["name", "age"]).name("John").clone();

		expect(() => cloned.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: age");
	});
});

describe("CeriosAutoBuilder - from", () => {
	it("returns the concrete subclass, not the base runtime", () => {
		expect(PersonBuilder.from({ name: "John", age: 30 })).toBeInstanceOf(PersonBuilder);
	});

	it("deep-clones the source, so building cannot reach back into it", () => {
		const source: Person = { name: "John", age: 30, address: { street: "Main St", city: "Springfield" } };
		const built = PersonBuilder.from(source).build();

		if (built.address) {
			built.address.city = "Shelbyville";
		}

		expect(source.address?.city).toBe("Springfield");
	});

	it("produces a builder that is immediately buildable", () => {
		expect(PersonBuilder.from({ name: "John", age: 30 }).build()).toEqual({ name: "John", age: 30 });
	});
});

describe("CeriosAutoBuilder - buildPartial isolation", () => {
	// buildPartial() returns a copy; returning the live internal object would let callers
	// mutate a builder that is supposed to be immutable.
	it("returns a copy, so mutating it cannot reach the builder", () => {
		const builder = PersonBuilder.create().name("John");
		const partial = builder.buildPartial();
		partial.name = "mutated";

		expect(builder.buildPartial().name).toBe("John");
	});
});
