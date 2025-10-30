import { CeriosBuilder } from "../src/cerios-builder";

type Person = {
	name: string;
	age: number;
	email?: string;
};

class PersonBuilder extends CeriosBuilder<Person> {
	static create() {
		return new PersonBuilder({});
	}

	name(value: string) {
		return this.setProperty("name", value);
	}

	age(value: number) {
		return this.setProperty("age", value);
	}

	email(value: string) {
		return this.setProperty("email", value);
	}

	withAdultAge() {
		return this.setProperty("age", 18);
	}
}

describe("Cerios Builder", () => {
	test("should build person with all fields", () => {
		const person = PersonBuilder.create().age(25).name("John Doe").email("john.doe@example.com").build();

		expect(person).toEqual({
			name: "John Doe",
			age: 25,
			email: "john.doe@example.com",
		});
	});

	test("should build person without optional email", () => {
		const person = PersonBuilder.create().name("Jane Doe").age(30).build();

		expect(person).toEqual({
			name: "Jane Doe",
			age: 30,
		});
	});

	test("should use custom withAdultAge method", () => {
		const person = PersonBuilder.create()
			.name("Bob Smith")
			.withAdultAge() // Sets age to 18
			.build();

		expect(person).toEqual({
			name: "Bob Smith",
			age: 18,
		});
	});

	test("should allow method chaining in any order", () => {
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

	test("custom method can override previous values", () => {
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
});
