import { CeriosClassBuilder, ClassConstructor } from "../../src/cerios-class-builder";

describe("CeriosClassBuilder - Nested Properties", () => {
	class Address {
		street!: string;
		city!: string;
		zipCode!: string;

		constructor(data?: Partial<Address>) {
			if (data) Object.assign(this, data);
		}
	}

	class ContactInfo {
		email!: string;
		phone!: string;
	}

	class Person {
		name!: string;
		age!: number;
		address!: Address;
		contactInfo?: ContactInfo;

		greet() {
			return `Hello, I'm ${this.name}`;
		}
	}

	class Company {
		name!: string;
		headquarters!: Address;
		ceo?: Person;

		constructor(data?: Partial<Company>) {
			if (data) Object.assign(this, data);
		}
	}

	class PersonBuilder extends CeriosClassBuilder<Person> {
		constructor(classConstructor: ClassConstructor<Person> = Person, data: Partial<Person> = {}) {
			super(classConstructor, data);
		}

		static create() {
			return new PersonBuilder();
		}

		setProperty<K extends "name" | "age" | "address" | "contactInfo">(key: K, value: any) {
			return super.setProperty(key, value);
		}

		setNestedProperty<P extends import("../../src").ClassPath<Person>>(path: P, value: any) {
			return super.setNestedProperty(path, value);
		}
	}

	class CompanyBuilder extends CeriosClassBuilder<Company> {
		constructor(classConstructor: ClassConstructor<Company> = Company, data: Partial<Company> = {}) {
			super(classConstructor, data);
		}

		static create() {
			return new CompanyBuilder();
		}

		setProperty<K extends "name" | "headquarters" | "ceo">(key: K, value: any) {
			return super.setProperty(key, value);
		}

		setNestedProperty<P extends import("../../src").ClassPath<Company>>(path: P, value: any) {
			return super.setNestedProperty(path, value);
		}
	}

	it("should set nested properties using dot notation", () => {
		const builder = PersonBuilder.create();

		const person = builder
			.setProperty("name", "John Doe")
			.setProperty("age", 30)
			.setNestedProperty("address.street", "123 Main St")
			.setNestedProperty("address.city", "New York")
			.setNestedProperty("address.zipCode", "10001")
			.buildUnsafe();

		expect(person.name).toBe("John Doe");
		expect(person.age).toBe(30);
		expect(person.address).toBeDefined();
		expect(person.address.street).toBe("123 Main St");
		expect(person.address.city).toBe("New York");
		expect(person.address.zipCode).toBe("10001");
	});

	it("should handle optional nested properties", () => {
		const builder = PersonBuilder.create();

		const person = builder
			.setProperty("name", "Jane Doe")
			.setProperty("age", 25)
			.setNestedProperty("address.street", "456 Oak Ave")
			.setNestedProperty("address.city", "Boston")
			.setNestedProperty("address.zipCode", "02101")
			.setNestedProperty("contactInfo.email", "jane@example.com")
			.setNestedProperty("contactInfo.phone", "555-1234")
			.buildUnsafe();

		expect(person.name).toBe("Jane Doe");
		expect(person.contactInfo).toBeDefined();
		expect(person.contactInfo?.email).toBe("jane@example.com");
		expect(person.contactInfo?.phone).toBe("555-1234");
	});

	it("should maintain immutability when setting nested properties", () => {
		const builder1 = PersonBuilder.create()
			.setProperty("name", "John")
			.setProperty("age", 30)
			.setNestedProperty("address.city", "New York");

		const builder2 = builder1.setNestedProperty("address.city", "Boston");

		const person1 = builder1.buildUnsafe();
		const person2 = builder2.buildUnsafe();

		expect(person1.address.city).toBe("New York");
		expect(person2.address.city).toBe("Boston");
	});

	it("should handle deeply nested properties", () => {
		const builder = CompanyBuilder.create();

		const company = builder
			.setProperty("name", "Tech Corp")
			.setNestedProperty("headquarters.street", "100 Tech Drive")
			.setNestedProperty("headquarters.city", "San Francisco")
			.setNestedProperty("headquarters.zipCode", "94102")
			.setNestedProperty("ceo.name", "Alice Smith")
			.setNestedProperty("ceo.age", 45)
			.buildUnsafe();

		expect(company.name).toBe("Tech Corp");
		expect(company.headquarters.street).toBe("100 Tech Drive");
		expect(company.headquarters.city).toBe("San Francisco");
		expect(company.ceo).toBeDefined();
		expect(company.ceo?.name).toBe("Alice Smith");
		expect(company.ceo?.age).toBe(45);
	});

	it("should overwrite existing nested property values", () => {
		const builder = PersonBuilder.create()
			.setProperty("name", "John")
			.setProperty("age", 30)
			.setNestedProperty("address.city", "New York")
			.setNestedProperty("address.street", "123 Main St")
			.setNestedProperty("address.zipCode", "10001");

		const updatedBuilder = builder.setNestedProperty("address.city", "Los Angeles");

		const person = updatedBuilder.buildUnsafe();

		expect(person.address.city).toBe("Los Angeles");
		expect(person.address.street).toBe("123 Main St");
		expect(person.address.zipCode).toBe("10001");
	});

	it("should create intermediate objects when they don't exist", () => {
		const builder = PersonBuilder.create();

		const person = builder
			.setProperty("name", "Bob")
			.setProperty("age", 35)
			.setNestedProperty("address.city", "Chicago")
			.buildUnsafe();

		expect(person.address).toBeDefined();
		expect(person.address.city).toBe("Chicago");
	});

	it("should work with setProperty and setNestedProperty together", () => {
		const address = new Address({ street: "789 Pine St", city: "Seattle", zipCode: "98101" });

		const builder = PersonBuilder.create();

		const person = builder
			.setProperty("name", "Charlie")
			.setProperty("age", 28)
			.setProperty("address", address)
			.setNestedProperty("address.city", "Portland")
			.buildUnsafe();

		expect(person.name).toBe("Charlie");
		expect(person.address.street).toBe("789 Pine St");
		expect(person.address.city).toBe("Portland");
		expect(person.address.zipCode).toBe("98101");

		// Original address should remain unchanged (immutability)
		expect(address.city).toBe("Seattle");
	});

	it("should preserve class methods when using nested properties", () => {
		const builder = PersonBuilder.create();

		const person = builder
			.setProperty("name", "Dave")
			.setProperty("age", 40)
			.setNestedProperty("address.street", "321 Elm St")
			.setNestedProperty("address.city", "Denver")
			.setNestedProperty("address.zipCode", "80202")
			.buildUnsafe();

		expect(person.greet).toBeDefined();
		expect(typeof person.greet).toBe("function");
		expect(person.greet()).toBe("Hello, I'm Dave");
	});
});
