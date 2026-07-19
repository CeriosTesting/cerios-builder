import { describe, expect, it } from "vitest";

import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";
import { BuilderStep, RequiredFieldsTemplate } from "../../src/cerios-builder";

type User = {
	id: string;
	name: string;
	email: string;
	role: string;
	age?: number;
	tags?: string[];
	address?: { street: string; city: string };
};

class UserBuilder extends CeriosAutoBuilder<User>() {
	static requiredTemplate: RequiredFieldsTemplate<User> = ["id", "name", "email", "role"];

	static create(): UserBuilder {
		return new UserBuilder({}, { requiredFields: this.requiredTemplate });
	}

	// Custom method mixing with auto setters; return type inferred (no annotation needed).
	// oxlint-disable-next-line explicit-function-return-type
	asAdmin() {
		return this.role("admin");
	}

	// Explicit BuilderStep return type also works.
	asGuest(): BuilderStep<this, User, "role"> {
		return this.role("guest");
	}
}

describe("CeriosAutoBuilder - automatic setters", () => {
	it("should provide a bare setter for every property", () => {
		const user = UserBuilder.create().id("1").name("John").email("john@example.com").role("user").age(30).build();

		expect(user).toEqual({ id: "1", name: "John", email: "john@example.com", role: "user", age: 30 });
	});

	it("should overwrite a previously set property", () => {
		const user = UserBuilder.create().id("1").name("John").name("Jane").email("e@x.io").role("user").build();

		expect(user.name).toBe("Jane");
	});

	it("should mix custom methods with auto setters", () => {
		const user = UserBuilder.create().id("1").name("John").email("e@x.io").asAdmin().build();

		expect(user.role).toBe("admin");
	});

	it("should support custom methods with an explicit BuilderStep return type", () => {
		const user = UserBuilder.create().id("1").name("John").email("e@x.io").asGuest().build();

		expect(user.role).toBe("guest");
	});

	it("should be immutable - setters fork independent builders", () => {
		const base = UserBuilder.create().id("1").name("John").email("e@x.io");

		const admin = base.role("admin").build();
		const guest = base.role("guest").build();

		expect(admin.role).toBe("admin");
		expect(guest.role).toBe("guest");
	});

	it("should preserve the concrete subclass type through the chain", () => {
		const builder = UserBuilder.create().id("1");

		expect(builder).toBeInstanceOf(UserBuilder);
		expect(builder.clone()).toBeInstanceOf(UserBuilder);
	});
});

describe("CeriosAutoBuilder - runtime validation", () => {
	it("should throw when a required field is missing at runtime", () => {
		const builder = UserBuilder.create().id("1").name("John");

		// TypeScript prevents build() here; force it to exercise runtime validation.
		const unsafe = builder as unknown as { build: () => User };
		expect(() => unsafe.build()).toThrow("Missing required fields: email, role");
	});

	it("should run validators added fluently", () => {
		const builder = UserBuilder.create()
			.id("1")
			.name("John")
			.email("e@x.io")
			.role("user")
			.addValidator((u) => (u.age === undefined || u.age >= 18 ? true : "Age must be 18 or older"))
			.age(16);

		expect(() => builder.build()).toThrow("Validation failed: Age must be 18 or older");
	});
});

describe("CeriosAutoBuilder - static from", () => {
	it("should seed a builder from an existing object and rebuild", () => {
		const existing: User = { id: "1", name: "John", email: "john@example.com", role: "user" };

		const updated = UserBuilder.from(existing).name("Jane").build();

		expect(updated).toEqual({ id: "1", name: "Jane", email: "john@example.com", role: "user" });
		expect(existing.name).toBe("John");
	});
});
