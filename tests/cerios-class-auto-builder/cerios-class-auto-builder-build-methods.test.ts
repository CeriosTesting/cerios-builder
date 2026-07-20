import { describe, expect, it } from "vitest";

import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";
import { DataPropertiesOnly, InternalClassBrand } from "../../src/cerios-class-builder";

class User {
	id!: string;
	name!: string;
	email!: string;
	age?: number;
	address?: { street: string; city: string };

	constructor(data?: Partial<User>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	greet(): string {
		return `Hello, ${this.name}`;
	}
}

class UserBuilder extends CeriosClassAutoBuilder(User) {
	static requiredDataProperties: ReadonlyArray<string> = ["id", "name", "email"];

	static create(): UserBuilder {
		return new UserBuilder();
	}
}

// The intersection with the brand marks all required data properties as set,
// so the returned builder is buildable (id/name/email are the required ones).
function complete(): UserBuilder & InternalClassBrand<DataPropertiesOnly<User>> {
	return UserBuilder.create().id("1").name("John").email("john@example.com");
}

describe("CeriosClassAutoBuilder build methods", () => {
	it("build() returns a class instance when required fields are set", () => {
		const user = complete().build();

		expect(user).toBeInstanceOf(User);
		expect(user.greet()).toBe("Hello, John");
	});

	it("buildWithoutRuntimeValidation() skips the runtime check", () => {
		const builder = UserBuilder.create().id("1");
		const unsafe = builder as unknown as { buildWithoutRuntimeValidation: () => User };

		expect(unsafe.buildWithoutRuntimeValidation().id).toBe("1");
	});

	it("buildWithoutCompileTimeValidation() runs the runtime check", () => {
		expect(complete().buildWithoutCompileTimeValidation().email).toBe("john@example.com");

		const builder = UserBuilder.create().id("1");
		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow(
			"Missing required fields: name, email. Please set these fields before calling buildWithoutCompileTimeValidation.",
		);
	});

	it("buildUnsafe() skips validation but still returns a real class instance", () => {
		const user = UserBuilder.create().id("1").buildUnsafe();

		expect(user).toBeInstanceOf(User);
		expect(user.id).toBe("1");
	});

	it("buildPartial() returns a plain object, not a class instance", () => {
		const partial = UserBuilder.create().id("1").age(30).buildPartial();

		expect(partial).toEqual({ id: "1", age: 30 });
		expect(partial).not.toBeInstanceOf(User);
	});

	it("buildPartial() returns a copy, so mutating it cannot reach the builder", () => {
		const builder = UserBuilder.create().id("1");
		const partial = builder.buildPartial();
		partial.id = "mutated";

		expect(builder.buildPartial().id).toBe("1");
	});

	it("buildFrozen() and buildDeepFrozen() freeze the result", () => {
		const shallow = complete().address({ street: "Main St", city: "Springfield" }).buildFrozen();
		expect(Object.isFrozen(shallow)).toBe(true);
		expect(Object.isFrozen(shallow.address)).toBe(false);

		const deep = complete().address({ street: "Main St", city: "Springfield" }).buildDeepFrozen();
		expect(Object.isFrozen(deep)).toBe(true);
		expect(Object.isFrozen(deep.address)).toBe(true);
	});

	it("buildSealed() and buildDeepSealed() seal the result", () => {
		const shallow = complete().address({ street: "Main St", city: "Springfield" }).buildSealed();
		expect(Object.isSealed(shallow)).toBe(true);
		expect(Object.isSealed(shallow.address)).toBe(false);

		const deep = complete().address({ street: "Main St", city: "Springfield" }).buildDeepSealed();
		expect(Object.isSealed(deep)).toBe(true);
		expect(Object.isSealed(deep.address)).toBe(true);
	});

	it("frozen build still runs runtime validation", () => {
		const builder = UserBuilder.create().id("1");
		const unsafe = builder as unknown as { buildFrozen: () => User };

		expect(() => unsafe.buildFrozen()).toThrow("Missing required fields: name, email");
	});

	it("honours static requiredDataProperties without calling setRequiredFields", () => {
		// The static list is the only source of required fields here - the builder never
		// calls setRequiredFields().
		const builder = UserBuilder.create().id("1").name("John");

		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: email");
	});
});
