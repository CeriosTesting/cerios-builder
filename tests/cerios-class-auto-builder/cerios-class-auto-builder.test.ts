import { describe, expect, it } from "vitest";

import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";
import { ClassBuilderStep } from "../../src/cerios-class-builder";

class Person {
	name!: string;
	age!: number;
	email?: string;
	hobbies?: string[];
	address?: { street: string; city: string };

	constructor(data?: Partial<Person>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	greet(): string {
		return `Hello, my name is ${this.name}`;
	}

	// Method with parameters - must not become a setter and must not block build().
	describe(prefix: string): string {
		return `${prefix}: ${this.name}`;
	}
}

class NoConstructorAssignment {
	label!: string;
	count!: number;
}

class PersonBuilder extends CeriosClassAutoBuilder(Person) {
	static create(): PersonBuilder {
		return new PersonBuilder();
	}

	// Custom method mixing with auto setters; explicit return type.
	adult(): ClassBuilderStep<this, Person, "age"> {
		return this.age(18);
	}
}

describe("CeriosClassAutoBuilder - automatic setters", () => {
	it("builds a real class instance with methods preserved", () => {
		const person = PersonBuilder.create().name("John").age(30).build();

		expect(person).toBeInstanceOf(Person);
		expect(person.greet()).toBe("Hello, my name is John");
		expect(person.describe("Name")).toBe("Name: John");
		expect(person.name).toBe("John");
	});

	it("assigns properties manually when the constructor does not", () => {
		class LabelBuilder extends CeriosClassAutoBuilder(NoConstructorAssignment) {
			static create(): LabelBuilder {
				return new LabelBuilder();
			}
		}

		const instance = LabelBuilder.create().label("a").count(2).build();
		expect(instance).toBeInstanceOf(NoConstructorAssignment);
		expect(instance.label).toBe("a");
		expect(instance.count).toBe(2);
	});

	it("sets optional and nested properties", () => {
		const person = PersonBuilder.create()
			.name("John")
			.age(30)
			.email("j@x.io")
			.address({
				street: "Main St",
				city: "Springfield",
			})
			.build();

		expect(person.email).toBe("j@x.io");
		expect(person.address?.city).toBe("Springfield");
	});

	it("mixes custom methods with auto setters", () => {
		const person = PersonBuilder.create().name("John").adult().build();
		expect(person.age).toBe(18);
	});

	it("is immutable - setters fork independent builders", () => {
		const base = PersonBuilder.create().name("John").age(30);
		const a = base.email("a@x.io").build();
		const b = base.email("b@x.io").build();

		expect(a.email).toBe("a@x.io");
		expect(b.email).toBe("b@x.io");
		expect(base.buildPartial()).toEqual({ name: "John", age: 30 });
	});

	it("preserves the concrete subclass through the chain and clone", () => {
		const builder = PersonBuilder.create().name("John");
		expect(builder).toBeInstanceOf(PersonBuilder);
		expect(builder.clone()).toBeInstanceOf(PersonBuilder);
	});
});

describe("CeriosClassAutoBuilder - runtime validation and options", () => {
	it("validates required data properties at runtime via setRequiredFields", () => {
		const builder = PersonBuilder.create().setRequiredFields(["name", "age"]).name("John");
		const unsafe = builder as unknown as { buildWithoutCompileTimeValidation: () => Person };

		expect(() => unsafe.buildWithoutCompileTimeValidation()).toThrow(
			"Missing required fields: age. Please set these fields before calling buildWithoutCompileTimeValidation.",
		);
	});

	it("runs validators added fluently", () => {
		const builder = PersonBuilder.create()
			.name("John")
			.age(16)
			.addValidator((p) => (p.age !== undefined && p.age >= 18 ? true : "Age must be 18 or older"));

		expect(() => builder.build()).toThrow("Validation failed: Age must be 18 or older");
	});

	it("seeds from an existing instance and is immediately buildable", () => {
		const existing = new Person({ name: "John", age: 30, email: "j@x.io" });
		const person = PersonBuilder.from(existing).age(31).build();

		expect(person).toBeInstanceOf(Person);
		expect(person.greet()).toBe("Hello, my name is John");
		expect(person.age).toBe(31);
		expect(existing.age).toBe(30);
	});
});

describe("CeriosClassAutoBuilder - build variants", () => {
	it("freezes and seals built instances", () => {
		const frozen = PersonBuilder.create().name("John").age(30).buildFrozen();
		expect(Object.isFrozen(frozen)).toBe(true);

		const sealed = PersonBuilder.create().name("John").age(30).buildSealed();
		expect(Object.isSealed(sealed)).toBe(true);
	});

	it("deep-freezes nested objects", () => {
		const person = PersonBuilder.create()
			.name("John")
			.age(30)
			.address({ street: "Main St", city: "Springfield" })
			.buildDeepFrozen();

		expect(Object.isFrozen(person)).toBe(true);
		expect(Object.isFrozen(person.address)).toBe(true);
	});

	it("appends to array properties with the array setter", () => {
		// hobbies is an array property; the auto setter replaces it (arrays set wholesale).
		const person = PersonBuilder.create().name("John").age(30).hobbies(["chess", "running"]).build();
		expect(person.hobbies).toEqual(["chess", "running"]);
	});
});
