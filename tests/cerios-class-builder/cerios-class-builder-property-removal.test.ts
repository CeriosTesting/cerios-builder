import { describe, expect, it } from "vitest";

import { CeriosClassBuilder, ClassBuilderStep, ClassConstructor } from "../../src/cerios-class-builder";

class Person {
	name!: string;
	age!: number;
	email?: string;
	phone?: string;
	address?: string;

	constructor(data?: Partial<Person>) {
		if (data) Object.assign(this, data);
	}

	greet(): string {
		return `Hello, I'm ${this.name}`;
	}
}

class PersonBuilder extends CeriosClassBuilder<Person> {
	static requiredDataProperties = ["name", "age"] as const;

	constructor(
		classConstructor: ClassConstructor<Person> = Person,
		data: Partial<Person> = {},
		validators?: Array<(obj: Partial<Person>) => boolean | string>,
	) {
		super(classConstructor, data, validators);
	}

	static create(): PersonBuilder {
		return new PersonBuilder();
	}

	setProperty<K extends "name" | "age" | "email" | "phone" | "address">(
		key: K,
		value: unknown,
	): ClassBuilderStep<this, Person, K> {
		return super.setProperty(key as never, value as never) as ClassBuilderStep<this, Person, K>;
	}

	removeEmail(): this {
		return this.removeOptionalProperty("email");
	}

	removePhone(): this {
		return this.removeOptionalProperty("phone");
	}

	removeAddress(): this {
		return this.removeOptionalProperty("address");
	}
}

class ConstructorRequiredPersonBuilder extends CeriosClassBuilder<Person> {
	constructor(
		classConstructor: ClassConstructor<Person> = Person,
		data: Partial<Person> = {},
		validators?: Array<(obj: Partial<Person>) => boolean | string>,
		requiredFields: ReadonlyArray<"name" | "age"> = ["name", "age"],
	) {
		super(classConstructor, data, validators, requiredFields);
	}

	static create(): ConstructorRequiredPersonBuilder {
		return new ConstructorRequiredPersonBuilder();
	}

	setProperty<K extends "name" | "age" | "email" | "phone" | "address">(
		key: K,
		value: unknown,
	): ClassBuilderStep<this, Person, K> {
		return super.setProperty(key as never, value as never) as ClassBuilderStep<this, Person, K>;
	}
}

describe("CeriosClassBuilder - Property Removal", () => {
	describe("removeOptionalProperty()", () => {
		it("should remove an optional property", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 30)
				.setProperty("email", "john@example.com")
				.setProperty("phone", "555-1234")
				.removeEmail();

			const person = builder.buildUnsafe();

			expect(person.name).toBe("John");
			expect(person.age).toBe(30);
			expect(person.email).toBeUndefined();
			expect(person.phone).toBe("555-1234");
		});

		it("should maintain immutability when removing property", () => {
			const builder1 = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 30)
				.setProperty("email", "john@example.com");

			const builder2 = builder1.removeEmail();

			const person1 = builder1.buildUnsafe();
			const person2 = builder2.buildUnsafe();

			expect(person1.email).toBe("john@example.com");
			expect(person2.email).toBeUndefined();
		});

		it("should handle removing non-existent property gracefully", () => {
			const builder = PersonBuilder.create().setProperty("name", "John").setProperty("age", 30).removeEmail(); // email was never set

			const person = builder.buildUnsafe();

			expect(person.name).toBe("John");
			expect(person.age).toBe(30);
			expect(person.email).toBeUndefined();
		});

		it("should allow chaining multiple removals", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 30)
				.setProperty("email", "john@example.com")
				.setProperty("phone", "555-1234")
				.setProperty("address", "123 Main St")
				.removeEmail()
				.removePhone();

			const person = builder.buildUnsafe();

			expect(person.name).toBe("John");
			expect(person.age).toBe(30);
			expect(person.email).toBeUndefined();
			expect(person.phone).toBeUndefined();
			expect(person.address).toBe("123 Main St");
		});

		it("should preserve validators when removing property", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 15)
				.setProperty("email", "john@example.com")
				.addValidator((obj) => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.removeEmail();

			expect(() => builder.build()).toThrow("Age must be 18 or older");
		});

		it("should preserve class methods after removing property", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 30)
				.setProperty("email", "john@example.com")
				.removeEmail();

			const person = builder.buildUnsafe();

			expect("greet" in person).toBe(true);
			expect(typeof person.greet).toBe("function");
			expect(person.greet()).toBe("Hello, I'm John");
		});
	});

	describe("clearOptionalProperties()", () => {
		it("should remove all optional properties", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 30)
				.setProperty("email", "john@example.com")
				.setProperty("phone", "555-1234")
				.setProperty("address", "123 Main St")
				.clearOptionalProperties();

			const person = builder.buildUnsafe();

			expect(person.name).toBe("John");
			expect(person.age).toBe(30);
			expect(person.email).toBeUndefined();
			expect(person.phone).toBeUndefined();
			expect(person.address).toBeUndefined();
		});

		it("should keep required properties when clearing optionals", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "Jane")
				.setProperty("age", 25)
				.setProperty("email", "jane@example.com")
				.clearOptionalProperties();

			const person = builder.buildUnsafe();

			expect(person.name).toBe("Jane");
			expect(person.age).toBe(25);
		});

		it("should maintain immutability when clearing properties", () => {
			const builder1 = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 30)
				.setProperty("email", "john@example.com")
				.setProperty("phone", "555-1234");

			const builder2 = builder1.clearOptionalProperties();

			const person1 = builder1.buildUnsafe();
			const person2 = builder2.buildUnsafe();

			expect(person1.email).toBe("john@example.com");
			expect(person1.phone).toBe("555-1234");
			expect(person2.email).toBeUndefined();
			expect(person2.phone).toBeUndefined();
		});

		it("should work when no optional properties are set", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 30)
				.clearOptionalProperties();

			const person = builder.buildUnsafe();

			expect(person.name).toBe("John");
			expect(person.age).toBe(30);
		});

		it("should preserve validators when clearing properties", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 15)
				.setProperty("email", "john@example.com")
				.addValidator((obj) => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.clearOptionalProperties();

			expect(() => builder.build()).toThrow("Age must be 18 or older");
		});

		it("should allow setting optional properties after clearing", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 30)
				.setProperty("email", "old@example.com")
				.setProperty("phone", "555-1234")
				.clearOptionalProperties()
				.setProperty("email", "new@example.com");

			const person = builder.buildUnsafe();

			expect(person.email).toBe("new@example.com");
			expect(person.phone).toBeUndefined();
		});

		it("should preserve class methods after clearing properties", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 30)
				.setProperty("email", "john@example.com")
				.clearOptionalProperties();

			const person = builder.buildUnsafe();

			expect("greet" in person).toBe(true);
			expect(typeof person.greet).toBe("function");
			expect(person.greet()).toBe("Hello, I'm John");
		});

		it("should preserve constructor-defined required fields", () => {
			const builder = ConstructorRequiredPersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 30)
				.setProperty("email", "john@example.com")
				.clearOptionalProperties();

			const person = builder.build();

			expect(person.name).toBe("John");
			expect(person.age).toBe(30);
			expect(person.email).toBeUndefined();
		});
	});
});
