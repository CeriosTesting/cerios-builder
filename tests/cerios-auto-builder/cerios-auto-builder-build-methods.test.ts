import { describe, expect, it } from "vitest";

import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";
import { InternalBuilderBrand, RequiredFieldsTemplate } from "../../src/cerios-builder";

type User = {
	id: string;
	name: string;
	email: string;
	age?: number;
	address?: { street: string; city: string };
};

class UserBuilder extends CeriosAutoBuilder<User>() {
	static requiredTemplate: RequiredFieldsTemplate<User> = ["id", "name", "email"];

	static create(): UserBuilder {
		return new UserBuilder({}, { requiredFields: this.requiredTemplate });
	}
}

// The intersection with the brand marks all required properties as set,
// so the returned builder is buildable (id/name/email are the required ones).
function complete(): UserBuilder & InternalBuilderBrand<User> {
	return UserBuilder.create().id("1").name("John").email("john@example.com");
}

describe("CeriosAutoBuilder build methods", () => {
	it("build() returns the object when required fields are set", () => {
		expect(complete().build()).toEqual({ id: "1", name: "John", email: "john@example.com" });
	});

	it("buildWithoutRuntimeValidation() skips the runtime check", () => {
		const builder = UserBuilder.create().id("1");
		const unsafe = builder as unknown as { buildWithoutRuntimeValidation: () => User };
		expect(unsafe.buildWithoutRuntimeValidation()).toEqual({ id: "1" });
	});

	it("buildWithoutCompileTimeValidation() runs the runtime check", () => {
		expect(complete().buildWithoutCompileTimeValidation().email).toBe("john@example.com");

		const builder = UserBuilder.create().id("1");
		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow(
			"Missing required fields: name, email. Please set these fields before calling buildWithoutCompileTimeValidation.",
		);
	});

	it("buildUnsafe() and buildPartial() skip validation", () => {
		expect(UserBuilder.create().id("1").buildUnsafe()).toEqual({ id: "1" });
		expect(UserBuilder.create().id("1").age(30).buildPartial()).toEqual({ id: "1", age: 30 });
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
});
