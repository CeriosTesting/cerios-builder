import { describe, expect, it } from "vitest";

import { BuilderStep, CeriosBuilder, RequiredFieldsTemplate } from "../../src/cerios-builder";

type User = {
	id: string;
	name: string;
	email: string;
	age?: number;
};

class UserBuilder extends CeriosBuilder<User> {
	static requiredTemplate: RequiredFieldsTemplate<User> = ["id", "name", "email"];

	static create(): UserBuilder {
		return new UserBuilder({}, this.requiredTemplate);
	}

	id(value: string): BuilderStep<this, User, "id"> {
		return this.setProperty("id", value);
	}

	name(value: string): BuilderStep<this, User, "name"> {
		return this.setProperty("name", value);
	}

	email(value: string): BuilderStep<this, User, "email"> {
		return this.setProperty("email", value);
	}

	age(value: number): BuilderStep<this, User, "age"> {
		return this.setProperty("age", value);
	}
}

describe("CeriosBuilder Build Methods", () => {
	describe("build() - compile-time + runtime validation", () => {
		it("should build successfully when all required fields are set", () => {
			const user = UserBuilder.create().id("1").name("John").email("john@example.com").build();

			expect(user).toEqual({
				id: "1",
				name: "John",
				email: "john@example.com",
			});
		});

		it("should throw error at runtime when required field is missing", () => {
			const builder = UserBuilder.create().id("1").name("John");

			// TypeScript would prevent calling build() here, but we can force it for testing
			const unsafeBuilder = builder as unknown as { build: () => User };
			expect(() => unsafeBuilder.build()).toThrow("Missing required fields: email");
		});
	});

	describe("buildWithoutRuntimeValidation() - only compile-time validation", () => {
		it("should build successfully when all required fields are set (no runtime check)", () => {
			const user = UserBuilder.create().id("2").name("Jane").email("jane@example.com").buildWithoutRuntimeValidation();

			expect(user).toEqual({
				id: "2",
				name: "Jane",
				email: "jane@example.com",
			});
		});

		it("should not throw at runtime even if template validation would fail", () => {
			// This bypasses runtime validation but TypeScript still enforces compile-time
			const user = UserBuilder.create().id("3").name("Bob").email("bob@example.com").buildWithoutRuntimeValidation();

			expect(user.id).toBe("3");
		});
	});

	describe("buildWithoutCompileTimeValidation() - only runtime validation", () => {
		it("should build successfully when all required fields are set", () => {
			const user = UserBuilder.create()
				.id("4")
				.name("Alice")
				.email("alice@example.com")
				.buildWithoutCompileTimeValidation();

			expect(user).toEqual({
				id: "4",
				name: "Alice",
				email: "alice@example.com",
			});
		});

		it("should throw error at runtime when required field is missing", () => {
			const builder = UserBuilder.create().id("5").name("Charlie");

			expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: email");
		});
	});

	describe("buildUnsafe() - no validation at all", () => {
		it("should build successfully with all fields", () => {
			const user = UserBuilder.create().id("6").name("David").email("david@example.com").buildUnsafe();

			expect(user).toEqual({
				id: "6",
				name: "David",
				email: "david@example.com",
			});
		});

		it("should build even when required fields are missing (no validation)", () => {
			const user = UserBuilder.create().id("7").buildUnsafe();

			expect(user).toEqual({
				id: "7",
			});
		});
	});

	describe("buildPartial() - returns Partial<T>", () => {
		it("should build partial object", () => {
			const partial = UserBuilder.create().name("Partial User").buildPartial();

			expect(partial).toEqual({
				name: "Partial User",
			});
		});
	});

	describe("buildWithoutCompileTimeValidation()", () => {
		it("should still work for backward compatibility", () => {
			const user = UserBuilder.create()
				.id("8")
				.name("Legacy")
				.email("legacy@example.com")
				.buildWithoutCompileTimeValidation();

			expect(user).toEqual({
				id: "8",
				name: "Legacy",
				email: "legacy@example.com",
			});
		});

		it("should throw error when required fields are missing", () => {
			const builder = UserBuilder.create().id("9");

			expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: name, email");
		});
	});
});
