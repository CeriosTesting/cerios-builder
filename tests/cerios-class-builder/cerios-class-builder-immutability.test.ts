import { describe, expect, it } from "vitest";

import { CeriosClassBuilder, ClassBuilderStep, ClassConstructor } from "../../src/cerios-class-builder";
import type { DeepReadonly } from "../../src/types";

class Address {
	public street!: string;
	public city!: string;
	public zipCode!: string;
	public country!: string;
}

class PersonClass {
	public name!: string;
	public age!: number;
	public address!: Address;
	public hobbies?: string[];
}

class AddressBuilder extends CeriosClassBuilder<Address> {
	constructor(classConstructor: ClassConstructor<Address> = Address, data: Partial<Address> = {}) {
		super(classConstructor, data);
	}

	static create(): AddressBuilder {
		return new AddressBuilder();
	}

	street(street: string): ClassBuilderStep<this, Address, "street"> {
		return this.setProperty("street", street);
	}

	city(city: string): ClassBuilderStep<this, Address, "city"> {
		return this.setProperty("city", city);
	}

	zipCode(zipCode: string): ClassBuilderStep<this, Address, "zipCode"> {
		return this.setProperty("zipCode", zipCode);
	}

	country(country: string): ClassBuilderStep<this, Address, "country"> {
		return this.setProperty("country", country);
	}
}

class PersonBuilder extends CeriosClassBuilder<PersonClass> {
	constructor(classConstructor: ClassConstructor<PersonClass> = PersonClass, data: Partial<PersonClass> = {}) {
		super(classConstructor, data);
	}

	static create(): PersonBuilder {
		return new PersonBuilder();
	}

	name(name: string): ClassBuilderStep<this, PersonClass, "name"> {
		return this.setProperty("name", name);
	}

	age(age: number): ClassBuilderStep<this, PersonClass, "age"> {
		return this.setProperty("age", age);
	}

	address(address: Address): ClassBuilderStep<this, PersonClass, "address"> {
		return this.setProperty("address", address);
	}

	addHobby(hobby: string): ClassBuilderStep<this, PersonClass, "hobbies"> {
		return this.addToArrayProperty("hobbies", hobby);
	}
}

describe("CeriosClassBuilder - Immutability", () => {
	const mutationErrorPattern = /(read only|not extensible|Cannot (add|assign|delete)|object is not extensible)/i;

	describe("buildFrozen()", () => {
		it("should freeze the top-level object", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();

			const person = PersonBuilder.create().name("Alice").age(30).address(address).buildFrozen();

			expect(Object.isFrozen(person)).toBe(true);
		});

		it("should prevent modification of top-level properties", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();

			const person = PersonBuilder.create().name("Alice").age(30).address(address).buildFrozen();

			expect(() => {
				(person as unknown as Record<string, unknown>).name = "Bob";
			}).toThrow(mutationErrorPattern);
		});

		it("should not freeze nested objects (shallow freeze)", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();

			const person = PersonBuilder.create().name("Alice").age(30).address(address).buildFrozen();

			expect(Object.isFrozen(person.address)).toBe(false);
			// Nested objects can still be modified
			person.address.zipCode = "12345";
			expect(person.address.zipCode).toBe("12345");
		});

		it("should work with arrays at top level", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();

			const person = PersonBuilder.create().name("Alice").age(30).address(address).addHobby("reading").buildFrozen();

			// Array is not frozen with shallow freeze
			expect(Object.isFrozen(person.hobbies)).toBe(false);
			person.hobbies?.push("gaming");
			expect(person.hobbies).toHaveLength(2);
		});
	});

	describe("buildDeepFrozen()", () => {
		it("should freeze the entire object tree", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();

			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)
				.addHobby("reading")
				.buildDeepFrozen();

			expect(Object.isFrozen(person)).toBe(true);
			expect(Object.isFrozen(person.address)).toBe(true);
			expect(Object.isFrozen(person.hobbies)).toBe(true);
		});

		it("should prevent modification of nested properties", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();

			const person = PersonBuilder.create().name("Alice").age(30).address(address).buildDeepFrozen();

			expect(() => {
				(person.address as unknown as Record<string, unknown>).street = "456 Oak Ave";
			}).toThrow(mutationErrorPattern);
		});

		it("should prevent modification of arrays", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)
				.addHobby("reading")
				.buildDeepFrozen();

			expect(() => {
				(person.hobbies as string[] | undefined)?.push("gaming");
			}).toThrow(mutationErrorPattern);
		});

		it("should return DeepReadonly type", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.buildDeepFrozen();

			// Type check - this should compile
			const typedPerson: DeepReadonly<PersonClass> = person;
			expect(typedPerson.name).toBe("Alice");
		});
	});

	describe("buildSealed()", () => {
		it("should seal the top-level object", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.buildSealed();

			expect(Object.isSealed(person)).toBe(true);
		});

		it("should prevent adding new properties", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.buildSealed();

			expect(() => {
				(person as unknown as Record<string, unknown>).newProperty = "value";
			}).toThrow(mutationErrorPattern);
		});

		it("should prevent deleting properties", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.buildSealed();

			expect(() => {
				delete (person as unknown as Record<string, unknown>).name;
			}).toThrow(mutationErrorPattern);
		});

		it("should allow modification of existing properties", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.buildSealed();

			// Should NOT throw - sealed objects can have properties modified
			person.age = 31;
			expect(person.age).toBe(31);
		});

		it("should not seal nested objects (shallow seal)", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.buildSealed();

			expect(Object.isSealed(person.address)).toBe(false);
			// Can add properties to nested objects
			(person.address as unknown as Record<string, unknown>).newProp = "value";
			expect((person.address as unknown as Record<string, unknown>).newProp).toBe("value");
		});
	});

	describe("buildDeepSealed()", () => {
		it("should seal the entire object tree", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.addHobby("reading")
				.buildDeepSealed();

			expect(Object.isSealed(person)).toBe(true);
			expect(Object.isSealed(person.address)).toBe(true);
			expect(Object.isSealed(person.hobbies)).toBe(true);
		});

		it("should prevent adding properties to nested objects", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.buildDeepSealed();

			expect(() => {
				(person.address as unknown as Record<string, unknown>).newProp = "value";
			}).toThrow(mutationErrorPattern);
		});

		it("should prevent adding elements to arrays", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.addHobby("reading")
				.buildDeepSealed();

			expect(() => {
				person.hobbies?.push("gaming");
			}).toThrow(mutationErrorPattern);
		});

		it("should allow modification of existing nested properties", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.buildDeepSealed();

			// Should NOT throw - sealed objects can have properties modified
			person.address.street = "456 Oak Ave";
			expect(person.address.street).toBe("456 Oak Ave");
		});

		it("should return DeepReadonly type", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const person = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.buildDeepSealed();

			// Type check - this should compile
			const typedPerson: DeepReadonly<PersonClass> = person;
			expect(typedPerson.name).toBe("Alice");
		});
	});

	describe("Freeze vs Seal comparison", () => {
		it("frozen objects cannot have properties modified", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const frozen = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.buildFrozen();

			expect(() => {
				(frozen as unknown as Record<string, unknown>).age = 31;
			}).toThrow(mutationErrorPattern);
		});

		it("sealed objects can have properties modified", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const sealed = PersonBuilder.create()
				.name("Alice")
				.age(30)
				.address(address)

				.buildSealed();

			sealed.age = 31;
			expect(sealed.age).toBe(31);
		});

		it("both prevent adding new properties", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const builder = PersonBuilder.create().name("Alice").age(30).address(address);

			const frozen = builder.buildFrozen();

			const sealed = builder.buildSealed();

			expect(() => {
				(frozen as unknown as Record<string, unknown>).newProp = "value";
			}).toThrow(mutationErrorPattern);

			expect(() => {
				(sealed as unknown as Record<string, unknown>).newProp = "value";
			}).toThrow(mutationErrorPattern);
		});

		it("both prevent deleting properties", () => {
			const address = AddressBuilder.create()
				.street("123 Main St")
				.city("Springfield")
				.zipCode("11111")
				.country("USA")
				.build();
			const builder = PersonBuilder.create().name("Alice").age(30).address(address);

			const frozen = builder.buildFrozen();

			const sealed = builder.buildSealed();

			expect(() => {
				delete (frozen as unknown as Record<string, unknown>).name;
			}).toThrow(mutationErrorPattern);

			expect(() => {
				delete (sealed as unknown as Record<string, unknown>).name;
			}).toThrow(mutationErrorPattern);
		});
	});
});
