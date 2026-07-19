import { describe, expect, it } from "vitest";

import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";

type Person = {
	name: string;
	age: number;
	email?: string;
};

// Required fields and validators are declared once, in the subclass constructor.
class PersonBuilder extends CeriosAutoBuilder<Person>() {
	constructor(data?: Partial<Person>) {
		super(data, {
			requiredFields: ["name", "age"],
			validators: [(p): boolean | string => (p.age !== undefined && p.age >= 18 ? true : "Age must be 18 or older")],
		});
	}

	static create(): PersonBuilder {
		return new PersonBuilder();
	}
}

describe("CeriosAutoBuilder - constructor options", () => {
	it("applies required fields passed through super()", () => {
		const builder = PersonBuilder.create().name("John");

		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: age");
	});

	it("applies validators passed through super()", () => {
		const builder = PersonBuilder.create().name("John").age(16);

		expect(() => builder.build()).toThrow("Validation failed: Age must be 18 or older");
	});

	it("applies seed data passed through super()", () => {
		expect(new PersonBuilder({ name: "Seeded" }).buildPartial().name).toBe("Seeded");
	});

	it("carries required fields and validators through copy-on-write setters", () => {
		const builder = PersonBuilder.create().name("John").email("j@x.io").age(16);

		expect(() => builder.build()).toThrow("Validation failed: Age must be 18 or older");
	});

	it("carries required fields and validators through clone()", () => {
		const builder = PersonBuilder.create().name("John").clone();

		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: age");
	});

	// Copy-on-write bypasses the subclass constructor, so a later setRequiredFields() is not
	// reverted to the constructor's hardcoded list by the next setter call.
	it("does not let the subclass constructor override a later setRequiredFields()", () => {
		const builder = PersonBuilder.create().setRequiredFields(["name"]).age(30).name("John");

		expect(() => builder.buildWithoutCompileTimeValidation()).not.toThrow();
	});

	it("accepts an exhaustive required-fields record instead of a path array", () => {
		class RecordBuilder extends CeriosAutoBuilder<Person>() {
			constructor(data?: Partial<Person>) {
				// The record must name every required property of Person; adding a new
				// required property makes this line fail to compile.
				super(data, { requiredFields: { name: true, age: true } });
			}

			static create(): RecordBuilder {
				return new RecordBuilder();
			}
		}

		const builder = RecordBuilder.create().name("John");
		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: age");
	});
});
