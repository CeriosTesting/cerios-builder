import { CeriosBuilder } from "../../src/cerios-builder";

interface Address {
	street: string;
	city: string;
	zipCode?: string;
}

interface Person {
	name: string;
	age: number;
	email?: string;
	address?: Address;
	hobbies?: string[];
}

class PersonBuilder extends CeriosBuilder<Person> {
	constructor(data: Partial<Person> = {}) {
		super(data);
	}

	setName(value: string) {
		return this.setProperty("name", value);
	}

	setAge(value: number) {
		return this.setProperty("age", value);
	}

	setEmail(value: string) {
		return this.setProperty("email", value);
	}

	setAddress(value: Address) {
		return this.setProperty("address", value);
	}

	setAddressCity(value: string) {
		return this.setNestedProperty("address.city", value);
	}

	addHobby(value: string) {
		return this.addToArrayProperty("hobbies", value);
	}
}

describe("CeriosBuilder - Cloning", () => {
	describe("clone()", () => {
		it("should create an independent copy of the builder", () => {
			const builder1 = new PersonBuilder().setName("John Doe").setAge(30).setEmail("john@example.com");

			const builder2 = builder1.clone();

			const person1 = builder1.buildUnsafe();
			const person2 = builder2.buildUnsafe();

			expect(person1).toEqual(person2);
			expect(person1).not.toBe(person2);
		});

		it("should allow independent modifications after cloning", () => {
			const builder1 = new PersonBuilder().setName("John").setAge(30);

			const builder2 = builder1.clone().setAge(25);

			const person1 = builder1.buildUnsafe();
			const person2 = builder2.buildUnsafe();

			expect(person1.age).toBe(30);
			expect(person2.age).toBe(25);
		});

		it("should deeply clone nested objects", () => {
			const builder1 = new PersonBuilder()
				.setName("John")
				.setAge(30)
				.setAddress({ street: "123 Main St", city: "New York" });

			const builder2 = builder1.clone();
			const builder3 = builder2.setAddressCity("Boston");

			const person1 = builder1.buildUnsafe();
			const person3 = builder3.buildUnsafe();

			expect(person1.address?.city).toBe("New York");
			expect(person3.address?.city).toBe("Boston");
		});

		it("should deeply clone arrays", () => {
			const builder1 = new PersonBuilder().setName("John").setAge(30).addHobby("reading").addHobby("swimming");

			const builder2 = builder1.clone().addHobby("coding");

			const person1 = builder1.buildUnsafe();
			const person2 = builder2.buildUnsafe();

			expect(person1.hobbies).toEqual(["reading", "swimming"]);
			expect(person2.hobbies).toEqual(["reading", "swimming", "coding"]);
		});

		it("should preserve required fields when cloning", () => {
			class PersonWithRequiredBuilder extends CeriosBuilder<Person> {
				static requiredTemplate = ["name", "age"] as const;

				constructor(data: Partial<Person> = {}) {
					super(data);
				}

				setName(value: string) {
					return this.setProperty("name", value);
				}

				setAge(value: number) {
					return this.setProperty("age", value);
				}
			}

			const builder1 = new PersonWithRequiredBuilder().setName("John").setAge(30);

			const builder2 = builder1.clone();

			// Should not throw because required fields are preserved
			expect(() => builder2.buildWithoutCompileTimeValidation()).not.toThrow();

			const person = builder2.buildWithoutCompileTimeValidation();
			expect(person.name).toBe("John");
			expect(person.age).toBe(30);
		});

		it("should preserve instance-level required fields when cloning", () => {
			const builder1 = new PersonBuilder().setRequiredFields(["name", "age"]).setName("John").setAge(30);

			const builder2 = builder1.clone();

			// Should not throw because required fields are preserved
			expect(() => builder2.buildWithoutCompileTimeValidation()).not.toThrow();

			// Remove a required field in builder2
			const builder3 = new PersonBuilder(builder2.buildPartial()).setRequiredFields(["name", "age"]);

			expect(() => builder3.buildWithoutCompileTimeValidation()).not.toThrow();
		});
	});

	describe("from()", () => {
		it("should create a builder from an existing object", () => {
			const existingPerson: Person = {
				name: "John Doe",
				age: 30,
				email: "john@example.com",
			};

			const builder = PersonBuilder.from(existingPerson);
			const person = builder.buildUnsafe();

			expect(person).toEqual(existingPerson);
			expect(person).not.toBe(existingPerson);
		});

		it("should allow modifications to the builder created from an existing object", () => {
			const existingPerson: Person = {
				name: "John Doe",
				age: 30,
			};

			const builder = PersonBuilder.from(existingPerson);
			const updatedPerson = builder.setAge(31).setEmail("john@example.com").buildUnsafe();

			expect(updatedPerson.name).toBe("John Doe");
			expect(updatedPerson.age).toBe(31);
			expect(updatedPerson.email).toBe("john@example.com");
		});

		it("should not modify the original object when using from()", () => {
			const existingPerson: Person = {
				name: "John Doe",
				age: 30,
				address: { street: "123 Main St", city: "New York" },
			};

			const builder = PersonBuilder.from(existingPerson);
			const updatedPerson = builder.setAddressCity("Boston").buildUnsafe();

			expect(existingPerson.address?.city).toBe("New York");
			expect(updatedPerson.address?.city).toBe("Boston");
		});

		it("should deeply clone nested objects when using from()", () => {
			const existingPerson: Person = {
				name: "John Doe",
				age: 30,
				address: { street: "123 Main St", city: "New York", zipCode: "10001" },
			};

			const builder = PersonBuilder.from(existingPerson);
			const person = builder.buildUnsafe();

			// Modify nested object in built person
			if (person.address) {
				person.address.city = "Modified";
			}

			// Original should be unchanged
			expect(existingPerson.address?.city).toBe("New York");
		});

		it("should deeply clone arrays when using from()", () => {
			const existingPerson: Person = {
				name: "John Doe",
				age: 30,
				hobbies: ["reading", "swimming"],
			};

			const builder = PersonBuilder.from(existingPerson);
			const updatedPerson = builder.addHobby("coding").buildUnsafe();

			expect(existingPerson.hobbies).toEqual(["reading", "swimming"]);
			expect(updatedPerson.hobbies).toEqual(["reading", "swimming", "coding"]);
		});

		it("should work with empty objects", () => {
			const emptyPerson: Partial<Person> = {};

			const builder = PersonBuilder.from(emptyPerson as Person);
			const person = builder.setName("New Person").setAge(25).buildUnsafe();

			expect(person.name).toBe("New Person");
			expect(person.age).toBe(25);
		});
	});
});
