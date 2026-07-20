import { describe, expect, it } from "vitest";

import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";

class Person {
	name!: string;
	age!: number;
	email?: string;

	constructor(data?: Partial<Person>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}

// Required fields and validators are declared once, in the subclass constructor.
// Before the options object existed there was no supported way to do this: the declared
// constructor accepted only `data`, and the second positional argument was ignored.
class PersonBuilder extends CeriosClassAutoBuilder(Person) {
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

describe("CeriosClassAutoBuilder - constructor options", () => {
	it("applies required fields passed through super()", () => {
		const builder = PersonBuilder.create().name("John");

		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: age");
	});

	it("applies validators passed through super()", () => {
		const builder = PersonBuilder.create().name("John").age(16);

		expect(() => builder.build()).toThrow("Validation failed: Age must be 18 or older");
	});

	it("applies seed data passed through super()", () => {
		const builder = new PersonBuilder({ name: "Seeded" });

		expect(builder.buildPartial().name).toBe("Seeded");
	});

	it("carries required fields and validators through copy-on-write setters", () => {
		// Every setter re-creates the builder via the base class's internal constructor
		// path, which must not lose the options supplied by the subclass.
		const builder = PersonBuilder.create().name("John").email("j@x.io").age(16);

		expect(() => builder.build()).toThrow("Validation failed: Age must be 18 or older");
	});

	it("carries required fields and validators through clone()", () => {
		const builder = PersonBuilder.create().name("John").clone();

		expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: age");
	});

	it("accepts the internal (classConstructor, data, ...) shape for base-class compatibility", () => {
		// The base class's copy-on-write contract is `new this.constructor(classConstructor,
		// data, validators, requiredFields)`. The auto builder overrides instantiateBuilder,
		// but the runtime class still honours that shape so code constructing through the
		// base contract cannot land the class constructor in the data slot.
		type MinimalApi = {
			buildPartial(): Partial<Person>;
			age(value: number): MinimalApi;
			buildWithoutCompileTimeValidation(): Person;
		};
		const InternalShape = CeriosClassAutoBuilder(Person) as unknown as new (
			classConstructor: typeof Person,
			data: Partial<Person>,
		) => MinimalApi;
		const builder = new InternalShape(Person, { name: "Internal" });

		expect(builder.buildPartial()).toEqual({ name: "Internal" });
		expect(builder.age(30).buildWithoutCompileTimeValidation()).toBeInstanceOf(Person);
	});

	it("accepts an exhaustive required-fields record instead of a path array", () => {
		class RecordBuilder extends CeriosClassAutoBuilder(Person) {
			constructor(data?: Partial<Person>) {
				// The record must name every required data property of Person; adding a new
				// required property to the class makes this line fail to compile.
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
