import { describe, expect, it } from "vitest";

import { BuilderStep, CeriosBuilder } from "../../src/cerios-builder";

type Person = {
	name: string;
	age: number;
	email?: string;
};

class PersonBuilder extends CeriosBuilder<Person> {
	static create(): PersonBuilder {
		return new PersonBuilder({});
	}

	name(value: string): BuilderStep<this, Person, "name"> {
		return this.setProperty("name", value);
	}

	age(value: number): BuilderStep<this, Person, "age"> {
		return this.setProperty("age", value);
	}

	email(value: string): BuilderStep<this, Person, "email"> {
		return this.setProperty("email", value);
	}

	withAdultAge(): BuilderStep<this, Person, "age"> {
		return this.setProperty("age", 18);
	}

	setNameAndAge(name: string, age: number): BuilderStep<this, Person, "name" | "age"> {
		return this.setProperties({ name, age });
	}

	setAll(name: string, age: number, email: string): BuilderStep<this, Person, "name" | "age" | "email"> {
		return this.setProperties({ name, age, email });
	}
}

describe("Cerios Builder", () => {
	it("should build person with all fields", () => {
		const person = PersonBuilder.create().age(25).name("John Doe").email("john.doe@example.com").build();

		expect(person).toEqual({
			name: "John Doe",
			age: 25,
			email: "john.doe@example.com",
		});
	});

	it("should build person without optional email", () => {
		const person = PersonBuilder.create().name("Jane Doe").age(30).build();

		expect(person).toEqual({
			name: "Jane Doe",
			age: 30,
		});
	});

	it("should use custom withAdultAge method", () => {
		const person = PersonBuilder.create()
			.name("Bob Smith")
			.withAdultAge() // Sets age to 18
			.build();

		expect(person).toEqual({
			name: "Bob Smith",
			age: 18,
		});
	});

	it("should allow method chaining in any order", () => {
		const person = PersonBuilder.create()
			.email("test@example.com")
			// .name("Alice")
			.age(22)
			.buildPartial();

		expect(person).toEqual({
			// name: "Alice",
			age: 22,
			email: "test@example.com",
		});
	});

	it("custom method can override previous values", () => {
		const person = PersonBuilder.create()
			.age(25)
			.name("Charlie")
			.withAdultAge() // Overrides age to 18
			.build();

		expect(person).toEqual({
			name: "Charlie",
			age: 18,
		});
	});

	it("should build person using setNameAndAge(setProperties)", () => {
		const person = PersonBuilder.create().setNameAndAge("Diana", 28).email("diana@example.com").build();

		expect(person).toEqual({
			name: "Diana",
			age: 28,
			email: "diana@example.com",
		});
	});

	it("should build person using setAll(setProperties)", () => {
		const person = PersonBuilder.create().setAll("Eve", 35, "eve@example.com").build();

		expect(person).toEqual({
			name: "Eve",
			age: 35,
			email: "eve@example.com",
		});
	});
});
