import { CeriosClassBuilder, ClassConstructor } from "../../src/cerios-class-builder";

class Person {
	name!: string;
	age!: number;
	email?: string;
	salary?: number;

	constructor(data?: Partial<Person>) {
		if (data) Object.assign(this, data);
	}

	greet() {
		return `Hello, I'm ${this.name}`;
	}
}

class PersonBuilder extends CeriosClassBuilder<Person> {
	constructor(
		classConstructor: ClassConstructor<Person> = Person,
		data: Partial<Person> = {},
		validators?: Array<(obj: Partial<Person>) => boolean | string>
	) {
		super(classConstructor, data, validators);
	}

	static create() {
		return new PersonBuilder();
	}

	setProperty<K extends "name" | "age" | "email" | "salary">(key: K, value: any) {
		return super.setProperty(key, value);
	}
}

describe("CeriosClassBuilder - Custom Validators", () => {
	describe("addValidator()", () => {
		it("should accept a validator that returns true", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 25)
				.addValidator(obj => obj.age !== undefined && obj.age >= 18);

			expect(() => builder.build()).not.toThrow();
		});

		it("should throw error when validator returns false", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 15)
				.addValidator(obj => obj.age !== undefined && obj.age >= 18);

			expect(() => builder.build()).toThrow("Validation failed");
		});

		it("should throw custom error message when validator returns string", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 15)
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older");

			expect(() => builder.build()).toThrow("Age must be 18 or older");
		});

		it("should run multiple validators", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 20)
				.setProperty("email", "invalid-email")
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.addValidator(obj => (obj.email?.includes("@") ?? true) || "Invalid email format");

			expect(() => builder.build()).toThrow("Invalid email format");
		});

		it("should pass all validators when all are valid", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 25)
				.setProperty("email", "john@example.com")
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.addValidator(obj => (obj.email?.includes("@") ?? true) || "Invalid email format");

			expect(() => builder.build()).not.toThrow();
			const person = builder.build();
			expect(person.age).toBe(25);
		});

		it("should collect all validation errors", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 15)
				.setProperty("email", "invalid-email")
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.addValidator(obj => (obj.email?.includes("@") ?? true) || "Invalid email format");

			try {
				builder.build();
				fail("Should have thrown validation error");
			} catch (error: any) {
				expect(error.message).toContain("Age must be 18 or older");
				expect(error.message).toContain("Invalid email format");
			}
		});

		it("should work with complex validations", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 25)
				.setProperty("salary", 50000)
				.addValidator(obj => {
					if (!obj.name) return "Name is required";
					if (obj.name.length < 2) return "Name must be at least 2 characters";
					return true;
				})
				.addValidator(obj => {
					if (obj.salary !== undefined && obj.salary < 0) return "Salary cannot be negative";
					return true;
				});

			expect(() => builder.build()).not.toThrow();
		});

		it("should preserve validators across builder chain", () => {
			const builder1 = PersonBuilder.create().addValidator(
				obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older"
			);

			const builder2 = builder1.setProperty("name", "John").setProperty("age", 20);

			const builder3 = builder2.setProperty("email", "john@example.com");

			expect(() => builder3.build()).not.toThrow();
		});

		it("should fail when modified value violates validator", () => {
			const builder1 = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 25)
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older");

			const builder2 = builder1.setProperty("age", 15);

			expect(() => builder2.build()).toThrow("Age must be 18 or older");
		});

		it("should not run validators in buildUnsafe", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 15)
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older");

			expect(() => builder.buildUnsafe()).not.toThrow();
			const person = builder.buildUnsafe();
			expect(person.age).toBe(15);
		});

		it("should run validators in buildFrozen", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 15)
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older");

			expect(() => builder.buildFrozen()).toThrow("Age must be 18 or older");
		});

		it("should preserve validators when cloning", () => {
			const builder1 = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 25)
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older");

			const builder2 = builder1.clone().setProperty("age", 15);

			expect(() => builder2.build()).toThrow("Age must be 18 or older");
		});

		it("should allow validators that check multiple fields", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 25)
				.setProperty("email", "john@example.com")
				.setProperty("salary", 100000)
				.addValidator(obj => {
					if (obj.age && obj.salary) {
						const minSalary = obj.age * 1000;
						if (obj.salary < minSalary) {
							return `Salary should be at least ${minSalary} for age ${obj.age}`;
						}
					}
					return true;
				});

			expect(() => builder.build()).not.toThrow();
		});

		it("should fail when multi-field validation fails", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 25)
				.setProperty("salary", 10000)
				.addValidator(obj => {
					if (obj.age && obj.salary) {
						const minSalary = obj.age * 1000;
						if (obj.salary < minSalary) {
							return `Salary should be at least ${minSalary} for age ${obj.age}`;
						}
					}
					return true;
				});

			expect(() => builder.build()).toThrow("Salary should be at least 25000 for age 25");
		});

		it("should preserve class methods after validation", () => {
			const builder = PersonBuilder.create()
				.setProperty("name", "John")
				.setProperty("age", 25)
				.addValidator(obj => obj.name !== undefined && obj.name.length > 0);

			const person = builder.build();
			expect(person.greet).toBeDefined();
			expect(typeof person.greet).toBe("function");
			expect(person.greet()).toBe("Hello, I'm John");
		});
	});
});
