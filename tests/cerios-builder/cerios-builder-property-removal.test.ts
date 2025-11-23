import { CeriosBuilder } from "../../src/cerios-builder";

interface Person {
	name: string;
	age: number;
	email?: string;
	phone?: string;
	address?: string;
}

class PersonBuilder extends CeriosBuilder<Person> {
	constructor(
		data: Partial<Person> = {},
		requiredFields?: ReadonlyArray<string>,
		validators?: Array<(obj: Partial<Person>) => boolean | string>
	) {
		super(data, requiredFields as any, validators);
	}

	static requiredTemplate = ["name", "age"] as const;

	setName(value: string) {
		return this.setProperty("name", value);
	}

	setAge(value: number) {
		return this.setProperty("age", value);
	}

	setEmail(value: string) {
		return this.setProperty("email", value);
	}

	setPhone(value: string) {
		return this.setProperty("phone", value);
	}

	setAddress(value: string) {
		return this.setProperty("address", value);
	}

	removeEmail() {
		return this.removeOptionalProperty("email");
	}

	removePhone() {
		return this.removeOptionalProperty("phone");
	}

	removeAddress() {
		return this.removeOptionalProperty("address");
	}
}

describe("CeriosBuilder - Property Removal", () => {
	describe("removeOptionalProperty()", () => {
		it("should remove an optional property", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(30)
				.setEmail("john@example.com")
				.setPhone("555-1234")
				.removeEmail();

			const person = builder.buildUnsafe();

			expect(person.name).toBe("John");
			expect(person.age).toBe(30);
			expect(person.email).toBeUndefined();
			expect(person.phone).toBe("555-1234");
		});

		it("should maintain immutability when removing property", () => {
			const builder1 = new PersonBuilder().setName("John").setAge(30).setEmail("john@example.com");

			const builder2 = builder1.removeEmail();

			const person1 = builder1.buildUnsafe();
			const person2 = builder2.buildUnsafe();

			expect(person1.email).toBe("john@example.com");
			expect(person2.email).toBeUndefined();
		});

		it("should handle removing non-existent property gracefully", () => {
			const builder = new PersonBuilder().setName("John").setAge(30).removeEmail(); // email was never set

			const person = builder.buildUnsafe();

			expect(person.name).toBe("John");
			expect(person.age).toBe(30);
			expect(person.email).toBeUndefined();
		});

		it("should allow chaining multiple removals", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(30)
				.setEmail("john@example.com")
				.setPhone("555-1234")
				.setAddress("123 Main St")
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
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(15)
				.setEmail("john@example.com")
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.removeEmail();

			expect(() => builder.build()).toThrow("Age must be 18 or older");
		});
	});

	describe("clearOptionalProperties()", () => {
		it("should remove all optional properties", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(30)
				.setEmail("john@example.com")
				.setPhone("555-1234")
				.setAddress("123 Main St")
				.clearOptionalProperties();

			const person = builder.buildUnsafe();

			expect(person.name).toBe("John");
			expect(person.age).toBe(30);
			expect(person.email).toBeUndefined();
			expect(person.phone).toBeUndefined();
			expect(person.address).toBeUndefined();
		});

		it("should keep required properties when clearing optionals", () => {
			const builder = new PersonBuilder()
				.setName("Jane")
				.setAge(25)
				.setEmail("jane@example.com")
				.clearOptionalProperties();

			const person = builder.build();

			expect(person.name).toBe("Jane");
			expect(person.age).toBe(25);
		});

		it("should maintain immutability when clearing properties", () => {
			const builder1 = new PersonBuilder().setName("John").setAge(30).setEmail("john@example.com").setPhone("555-1234");

			const builder2 = builder1.clearOptionalProperties();

			const person1 = builder1.buildUnsafe();
			const person2 = builder2.buildUnsafe();

			expect(person1.email).toBe("john@example.com");
			expect(person1.phone).toBe("555-1234");
			expect(person2.email).toBeUndefined();
			expect(person2.phone).toBeUndefined();
		});

		it("should work when no optional properties are set", () => {
			const builder = new PersonBuilder().setName("John").setAge(30).clearOptionalProperties();

			const person = builder.build();

			expect(person.name).toBe("John");
			expect(person.age).toBe(30);
		});

		it("should preserve validators when clearing properties", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(15)
				.setEmail("john@example.com")
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.clearOptionalProperties();

			expect(() => builder.build()).toThrow("Age must be 18 or older");
		});

		it("should allow setting optional properties after clearing", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(30)
				.setEmail("old@example.com")
				.setPhone("555-1234")
				.clearOptionalProperties()
				.setEmail("new@example.com");

			const person = builder.buildUnsafe();

			expect(person.email).toBe("new@example.com");
			expect(person.phone).toBeUndefined();
		});
	});
});
