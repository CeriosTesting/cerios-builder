import { CeriosClassBuilder, ClassConstructor } from "../../src/cerios-class-builder";

class Address {
	street!: string;
	city!: string;
	zipCode?: string;

	constructor(data?: Partial<Address>) {
		if (data) Object.assign(this, data);
	}
}

class Person {
	name!: string;
	age!: number;
	email?: string;
	address?: Address;
	hobbies?: string[];

	constructor(data?: Partial<Person>) {
		if (data) Object.assign(this, data);
	}

	greet() {
		return `Hello, I'm ${this.name}`;
	}

	getAge() {
		return this.age;
	}
}

class PersonBuilder extends CeriosClassBuilder<Person> {
	constructor(classConstructor: ClassConstructor<Person> = Person, data: Partial<Person> = {}) {
		super(classConstructor, data);
	}

	static create() {
		return new PersonBuilder();
	}

	static fromInstance(instance: Person) {
		return PersonBuilder.from(Person, instance);
	}

	setProperty<K extends "name" | "age" | "email" | "address" | "hobbies">(key: K, value: any) {
		return super.setProperty(key, value);
	}

	setNestedProperty<P extends import("../../src").ClassPath<Person>>(path: P, value: any) {
		return super.setNestedProperty(path, value);
	}
}

describe("CeriosClassBuilder - Cloning", () => {
	describe("clone()", () => {
		it("should create an independent copy of the builder", () => {
			const builder1 = PersonBuilder.create()
				.setProperty("name", "John Doe")
				.setProperty("age", 30)
				.setProperty("email", "john@example.com");

			const builder2 = builder1.clone();

			const person1 = builder1.buildUnsafe();
			const person2 = builder2.buildUnsafe();

			expect(person1).toEqual(person2);
			expect(person1).not.toBe(person2);
		});

		it("should allow independent modifications after cloning", () => {
			const builder1 = PersonBuilder.create().setProperty("name", "John").setProperty("age", 30);

			const builder2 = builder1.clone().setProperty("age", 25);

			const person1 = builder1.buildUnsafe();
			const person2 = builder2.buildUnsafe();

			expect(person1.age).toBe(30);
			expect(person2.age).toBe(25);
		});

		it("should deeply clone nested objects", () => {
			const address = new Address({ street: "123 Main St", city: "New York" });

			const builder1 = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 30)
				.setProperty("address", address);

			const builder2 = builder1.clone();
			const builder3 = builder2.setNestedProperty("address.city", "Boston");

			const person1 = builder1.buildUnsafe();
			const person3 = builder3.buildUnsafe();

			expect(person1.address?.city).toBe("New York");
			expect(person3.address?.city).toBe("Boston");
		});

		it("should deeply clone arrays", () => {
			const builder1 = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 30)
				.addToArrayProperty("hobbies", "reading")
				.addToArrayProperty("hobbies", "swimming");

			const builder2 = builder1.clone().addToArrayProperty("hobbies", "coding");

			const person1 = builder1.buildUnsafe();
			const person2 = builder2.buildUnsafe();

			expect(person1.hobbies).toEqual(["reading", "swimming"]);
			expect(person2.hobbies).toEqual(["reading", "swimming", "coding"]);
		});

		it("should preserve class methods after cloning", () => {
			const builder1 = PersonBuilder.create().setProperty("name", "John").setProperty("age", 30);

			const builder2 = builder1.clone();
			const person = builder2.buildUnsafe();

			expect(person.greet).toBeDefined();
			expect(typeof person.greet).toBe("function");
			expect(person.greet()).toBe("Hello, I'm John");
			expect(person.getAge()).toBe(30);
		});
	});

	describe("from()", () => {
		it("should create a builder from an existing class instance", () => {
			const existingPerson = new Person({
				name: "John Doe",
				age: 30,
				email: "john@example.com",
			});

			const builder = PersonBuilder.fromInstance(existingPerson);
			const person = builder.buildUnsafe();

			expect(person.name).toBe(existingPerson.name);
			expect(person.age).toBe(existingPerson.age);
			expect(person.email).toBe(existingPerson.email);
			expect(person).not.toBe(existingPerson);
		});

		it("should allow modifications to the builder created from an existing instance", () => {
			const existingPerson = new Person({
				name: "John Doe",
				age: 30,
			});

			const builder = PersonBuilder.fromInstance(existingPerson);
			const updatedPerson = builder.setProperty("age", 31).setProperty("email", "john@example.com").buildUnsafe();

			expect(updatedPerson.name).toBe("John Doe");
			expect(updatedPerson.age).toBe(31);
			expect(updatedPerson.email).toBe("john@example.com");
		});

		it("should not modify the original instance when using from()", () => {
			const existingPerson = new Person({
				name: "John Doe",
				age: 30,
				address: new Address({ street: "123 Main St", city: "New York" }),
			});

			const builder = PersonBuilder.fromInstance(existingPerson);
			const updatedPerson = builder.setNestedProperty("address.city", "Boston").buildUnsafe();

			expect(existingPerson.address?.city).toBe("New York");
			expect(updatedPerson.address?.city).toBe("Boston");
		});

		it("should deeply clone nested objects when using from()", () => {
			const existingPerson = new Person({
				name: "John Doe",
				age: 30,
				address: new Address({ street: "123 Main St", city: "New York", zipCode: "10001" }),
			});

			const builder = PersonBuilder.fromInstance(existingPerson);
			const person = builder.buildUnsafe();

			// Modify nested object in built person
			if (person.address) {
				person.address.city = "Modified";
			}

			// Original should be unchanged
			expect(existingPerson.address?.city).toBe("New York");
		});

		it("should deeply clone arrays when using from()", () => {
			const existingPerson = new Person({
				name: "John Doe",
				age: 30,
				hobbies: ["reading", "swimming"],
			});

			const builder = PersonBuilder.fromInstance(existingPerson);
			const updatedPerson = builder.addToArrayProperty("hobbies", "coding").buildUnsafe();

			expect(existingPerson.hobbies).toEqual(["reading", "swimming"]);
			expect(updatedPerson.hobbies).toEqual(["reading", "swimming", "coding"]);
		});

		it("should preserve class methods when using from()", () => {
			const existingPerson = new Person({
				name: "John Doe",
				age: 30,
			});

			const builder = PersonBuilder.fromInstance(existingPerson);
			const person = builder.buildUnsafe();

			expect(person.greet).toBeDefined();
			expect(typeof person.greet).toBe("function");
			expect(person.greet()).toBe("Hello, I'm John Doe");
			expect(person.getAge()).toBe(30);
		});

		it("should work with minimal data", () => {
			const minimalPerson = new Person();

			const builder = PersonBuilder.fromInstance(minimalPerson);
			const person = builder.setProperty("name", "New Person").setProperty("age", 25).buildUnsafe();

			expect(person.name).toBe("New Person");
			expect(person.age).toBe(25);
			expect(person.greet()).toBe("Hello, I'm New Person");
		});
	});
});
