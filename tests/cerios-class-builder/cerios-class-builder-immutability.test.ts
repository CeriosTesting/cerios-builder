import { CeriosClassBuilder, ClassConstructor } from "../../src/cerios-class-builder";
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

	street(street: string) {
		return this.setProperty("street", street);
	}

	city(city: string) {
		return this.setProperty("city", city);
	}

	zipCode(zipCode: string) {
		return this.setProperty("zipCode", zipCode);
	}

	country(country: string) {
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

	name(name: string) {
		return this.setProperty("name", name);
	}

	age(age: number) {
		return this.setProperty("age", age);
	}

	address(address: Address) {
		return this.setProperty("address", address);
	}

	addHobby(hobby: string) {
		return this.addToArrayProperty("hobbies", hobby);
	}
}

describe("CeriosClassBuilder - Immutability", () => {
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
				(person as any).name = "Bob";
			}).toThrow();
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
				(person.address as any).street = "456 Oak Ave";
			}).toThrow();
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
			}).toThrow();
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
				(person as any).newProperty = "value";
			}).toThrow();
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
				delete (person as any).name;
			}).toThrow();
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
			(person.address as any).newProp = "value";
			expect((person.address as any).newProp).toBe("value");
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
				(person.address as any).newProp = "value";
			}).toThrow();
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
			}).toThrow();
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
				(frozen as any).age = 31;
			}).toThrow();
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
				(frozen as any).newProp = "value";
			}).toThrow();

			expect(() => {
				(sealed as any).newProp = "value";
			}).toThrow();
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
				delete (frozen as any).name;
			}).toThrow();

			expect(() => {
				delete (sealed as any).name;
			}).toThrow();
		});
	});
});
