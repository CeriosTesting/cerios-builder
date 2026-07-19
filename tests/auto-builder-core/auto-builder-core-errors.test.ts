import { describe, expect, it } from "vitest";

import { CeriosBuilderError } from "../../src/builder-error";
import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";
import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";

type User = {
	id: string;
	name: string;
	age?: number;
};

class Person {
	id!: string;
	name!: string;

	constructor(data?: Partial<Person>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}

class UserBuilder extends CeriosAutoBuilder<User>() {
	static create(): UserBuilder {
		return new UserBuilder({}, { requiredFields: ["id", "name"] });
	}
}

class PersonBuilder extends CeriosClassAutoBuilder(Person) {
	static create(): PersonBuilder {
		return new PersonBuilder(undefined, { requiredFields: ["id", "name"] });
	}
}

function captureError(fn: () => unknown): unknown {
	try {
		fn();
	} catch (error) {
		return error;
	}
	return expect.unreachable("should have thrown");
}

describe("CeriosBuilderError", () => {
	it("carries the missing fields as data, not just in the message", () => {
		const error = captureError(() => UserBuilder.create().id("1").buildWithoutCompileTimeValidation());

		expect(error).toBeInstanceOf(CeriosBuilderError);
		expect((error as CeriosBuilderError).missingFields).toEqual(["name"]);
		expect((error as CeriosBuilderError).validationErrors).toEqual([]);
	});

	it("carries validator failures as data", () => {
		const error = captureError(() =>
			UserBuilder.create()
				.id("1")
				.name("n")
				.addValidator(() => "too short")
				.buildWithoutCompileTimeValidation(),
		);

		expect((error as CeriosBuilderError).validationErrors).toEqual(["too short"]);
		expect((error as CeriosBuilderError).missingFields).toEqual([]);
	});

	it("is still an Error, so existing catch blocks keep working", () => {
		expect(() => UserBuilder.create().buildWithoutCompileTimeValidation()).toThrow(Error);
	});

	it("names the build variant that was actually called", () => {
		const incomplete = UserBuilder.create().id("1");
		const unsafe = incomplete as unknown as { buildDeepSealed: () => User };

		// This used to advise "before calling build." no matter which variant threw.
		expect(() => unsafe.buildDeepSealed()).toThrow("before calling buildDeepSealed.");
	});

	it("reports the same way from the class auto builder", () => {
		const error = captureError(() => PersonBuilder.create().id("1").buildWithoutCompileTimeValidation());

		expect(error).toBeInstanceOf(CeriosBuilderError);
		expect((error as CeriosBuilderError).missingFields).toEqual(["name"]);
	});
});

describe("validator result handling", () => {
	it("identifies which validator returned false", () => {
		const builder = UserBuilder.create()
			.id("1")
			.name("n")
			.addValidator(function tooYoung() {
				return false;
			})
			.addValidator(function tooOld() {
				return false;
			});

		// Previously this was "Validation failed: Validation failed; Validation failed" -
		// three failing validators were indistinguishable.
		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("tooYoung");
		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("tooOld");
	});

	it("falls back to the index for an anonymous validator", () => {
		const builder = UserBuilder.create()
			.id("1")
			.name("n")
			.addValidator(() => false);

		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Validator #0");
	});

	it("treats a validator returning undefined as a failure, not a pass", () => {
		// Forgetting to return is easy; silently accepting invalid data is the worse outcome.
		const builder = UserBuilder.create()
			.id("1")
			.name("n")
			.addValidator(() => undefined as unknown as boolean);

		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("expected true, false, or a non-empty");
	});

	it("treats an empty-string return as a failure rather than an empty message", () => {
		const builder = UserBuilder.create()
			.id("1")
			.name("n")
			.addValidator(() => "");

		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("an empty string");
	});

	it("still passes on true and still reports a string message verbatim", () => {
		expect(() =>
			UserBuilder.create()
				.id("1")
				.name("n")
				.addValidator(() => true)
				.buildWithoutCompileTimeValidation(),
		).not.toThrow();

		expect(() =>
			UserBuilder.create()
				.id("1")
				.name("n")
				.addValidator(() => "custom message")
				.buildWithoutCompileTimeValidation(),
		).toThrow("Validation failed: custom message");
	});
});
