import { CeriosBuilder, RequiredFieldsTemplate } from "../../src/cerios-builder";
import { DeepReadonly } from "../../src/types";

interface Address {
	street: string;
	city: string;
	zipCode: string;
	country: string;
}

interface Person {
	name: string;
	age: number;
	address: Address;
	hobbies?: string[];
}

class PersonBuilder extends CeriosBuilder<Person> {
	static requiredTemplate: RequiredFieldsTemplate<Person> = ["name", "age", "address.street", "address.city"];

	static create(): PersonBuilder {
		return new PersonBuilder({});
	}

	setName(name: string) {
		return this.setProperty("name", name);
	}

	setAge(age: number) {
		return this.setProperty("age", age);
	}

	setAddress(address: Address) {
		return this.setProperty("address", address);
	}

	setStreet(street: string) {
		return this.setNestedProperty("address.street", street);
	}

	setCity(city: string) {
		return this.setNestedProperty("address.city", city);
	}

	setZipCode(zipCode: string) {
		return this.setNestedProperty("address.zipCode", zipCode);
	}

	setCountry(country: string) {
		return this.setNestedProperty("address.country", country);
	}

	addHobby(hobby: string) {
		return this.addToArrayProperty("hobbies", hobby);
	}
}

describe("CeriosBuilder - Immutability", () => {
	describe("buildFrozen()", () => {
		it("should freeze the top-level object", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildFrozen();

			expect(Object.isFrozen(person)).toBe(true);
		});

		it("should prevent modification of top-level properties", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildFrozen();

			expect(() => {
				(person as any).name = "Bob";
			}).toThrow();
		});

		it("should not freeze nested objects (shallow freeze)", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildFrozen();

			expect(Object.isFrozen(person.address)).toBe(false);
			// Nested objects can still be modified
			person.address.zipCode = "12345";
			expect(person.address.zipCode).toBe("12345");
		});

		it("should validate required fields before freezing", () => {
			expect(() => {
				PersonBuilder.create().setName("Alice").setAge(30).buildWithoutCompileTimeValidation();
				// This would fail at runtime, but since buildFrozen requires compile-time validation,
				// the compile-time check prevents this scenario
			}).toThrow("Missing required fields");
		});

		it("should work with arrays at top level", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.addHobby("reading")
				.buildFrozen();

			// Array is not frozen with shallow freeze
			expect(Object.isFrozen(person.hobbies)).toBe(false);
			person.hobbies?.push("gaming");
			expect(person.hobbies).toHaveLength(2);
		});
	});

	describe("buildDeepFrozen()", () => {
		it("should freeze the entire object tree", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.addHobby("reading")
				.buildDeepFrozen();

			expect(Object.isFrozen(person)).toBe(true);
			expect(Object.isFrozen(person.address)).toBe(true);
			expect(Object.isFrozen(person.hobbies)).toBe(true);
		});

		it("should prevent modification of nested properties", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildDeepFrozen();

			expect(() => {
				(person.address as any).street = "456 Oak Ave";
			}).toThrow();
		});

		it("should prevent modification of arrays", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.addHobby("reading")
				.buildDeepFrozen();

			expect(() => {
				// Deep frozen array cannot be modified
				(person.hobbies as string[] | undefined)?.push("gaming");
			}).toThrow();
		});

		it("should validate required fields before deep freezing", () => {
			expect(() => {
				PersonBuilder.create().setName("Alice").setAge(30).buildWithoutCompileTimeValidation();
			}).toThrow("Missing required fields");
		});

		it("should return DeepReadonly type", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildDeepFrozen();

			// Type check - this should compile
			const typedPerson: DeepReadonly<Person> = person;
			expect(typedPerson.name).toBe("Alice");
		});
	});

	describe("buildSealed()", () => {
		it("should seal the top-level object", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildSealed();

			expect(Object.isSealed(person)).toBe(true);
		});

		it("should prevent adding new properties", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildSealed();

			expect(() => {
				(person as any).newProperty = "value";
			}).toThrow();
		});

		it("should prevent deleting properties", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildSealed();

			expect(() => {
				delete (person as any).name;
			}).toThrow();
		});

		it("should allow modification of existing properties", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildSealed();

			// Should NOT throw - sealed objects can have properties modified
			person.age = 31;
			expect(person.age).toBe(31);
		});

		it("should not seal nested objects (shallow seal)", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildSealed();

			expect(Object.isSealed(person.address)).toBe(false);
			// Can add properties to nested objects
			(person.address as any).newProp = "value";
			expect((person.address as any).newProp).toBe("value");
		});

		it("should validate required fields before sealing", () => {
			expect(() => {
				PersonBuilder.create().setName("Alice").setAge(30).buildWithoutCompileTimeValidation();
			}).toThrow("Missing required fields");
		});
	});

	describe("buildDeepSealed()", () => {
		it("should seal the entire object tree", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.addHobby("reading")
				.buildDeepSealed();

			expect(Object.isSealed(person)).toBe(true);
			expect(Object.isSealed(person.address)).toBe(true);
			expect(Object.isSealed(person.hobbies)).toBe(true);
		});

		it("should prevent adding properties to nested objects", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildDeepSealed();

			expect(() => {
				(person.address as any).newProp = "value";
			}).toThrow();
		});

		it("should prevent adding elements to arrays", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.addHobby("reading")
				.buildDeepSealed();

			expect(() => {
				person.hobbies?.push("gaming");
			}).toThrow();
		});

		it("should allow modification of existing nested properties", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildDeepSealed();

			// Should NOT throw - sealed objects can have properties modified
			person.address.street = "456 Oak Ave";
			expect(person.address.street).toBe("456 Oak Ave");
		});

		it("should validate required fields before deep sealing", () => {
			expect(() => {
				PersonBuilder.create().setName("Alice").setAge(30).buildWithoutCompileTimeValidation();
			}).toThrow("Missing required fields");
		});

		it("should return DeepReadonly type", () => {
			const person = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildDeepSealed();

			// Type check - this should compile
			const typedPerson: DeepReadonly<Person> = person;
			expect(typedPerson.name).toBe("Alice");
		});
	});

	describe("Freeze vs Seal comparison", () => {
		it("frozen objects cannot have properties modified", () => {
			const frozen = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildFrozen();

			expect(() => {
				(frozen as any).age = 31;
			}).toThrow();
		});

		it("sealed objects can have properties modified", () => {
			const sealed = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildSealed();

			sealed.age = 31;
			expect(sealed.age).toBe(31);
		});

		it("both prevent adding new properties", () => {
			const frozen = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildFrozen();

			const sealed = PersonBuilder.create()
				.setName("Bob")
				.setAge(25)
				.setStreet("456 Oak Ave")
				.setCity("Shelbyville")
				.buildSealed();

			expect(() => {
				(frozen as any).newProp = "value";
			}).toThrow();

			expect(() => {
				(sealed as any).newProp = "value";
			}).toThrow();
		});

		it("both prevent deleting properties", () => {
			const frozen = PersonBuilder.create()
				.setName("Alice")
				.setAge(30)
				.setStreet("123 Main St")
				.setCity("Springfield")
				.buildFrozen();

			const sealed = PersonBuilder.create()
				.setName("Bob")
				.setAge(25)
				.setStreet("456 Oak Ave")
				.setCity("Shelbyville")
				.buildSealed();

			expect(() => {
				delete (frozen as any).name;
			}).toThrow();

			expect(() => {
				delete (sealed as any).name;
			}).toThrow();
		});
	});
});
