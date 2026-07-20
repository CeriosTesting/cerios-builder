import { describe, expect, it } from "vitest";

import { BuilderStep, CeriosBuilder } from "../../src/cerios-builder";

type User = {
	id: string;
	name: string;
	age?: number;
};

// `from()` requires a public constructor. TypeScript cannot express "constructor may be
// protected" in a `this` constraint, so a subclass that wants `from()` has to widen it.
class UserBuilder extends CeriosBuilder<User> {
	public constructor(data: Partial<User> = {}) {
		super(data);
	}

	static create(): UserBuilder {
		return new UserBuilder({});
	}

	id(value: string): BuilderStep<this, User, "id"> {
		return this.setProperty("id", value);
	}

	name(value: string): BuilderStep<this, User, "name"> {
		return this.setProperty("name", value);
	}
}

describe("CeriosBuilder.from - branded result", () => {
	it("returns a builder that is immediately buildable", () => {
		// Seeding from a complete object means every property is set, so build() must be
		// callable. Before, from() returned an unbranded builder and every call site had to
		// fall back to buildUnsafe() - including the example in from()'s own JSDoc.
		const built = UserBuilder.from({ id: "1", name: "John" }).build();

		expect(built).toEqual({ id: "1", name: "John" });
	});

	it("stays buildable after further setters", () => {
		expect(UserBuilder.from({ id: "1", name: "John" }).name("Renamed").build().name).toBe("Renamed");
	});

	it("returns the concrete subclass", () => {
		expect(UserBuilder.from({ id: "1", name: "John" })).toBeInstanceOf(UserBuilder);
	});

	it("deep-clones the source", () => {
		const source: User = { id: "1", name: "John" };
		const built = UserBuilder.from(source).build();
		built.name = "Mutated";

		expect(source.name).toBe("John");
	});
});
