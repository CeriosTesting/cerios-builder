import { CeriosBuilder } from "../../src/cerios-builder";

interface Person {
	name: string;
	age: number;
	email?: string;
	salary?: number;
}

class PersonBuilder extends CeriosBuilder<Person> {
	constructor(
		data: Partial<Person> = {},
		requiredFields?: ReadonlyArray<string>,
		validators?: Array<(obj: Partial<Person>) => boolean | string>
	) {
		super(data, requiredFields as any, validators);
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

	setSalary(value: number) {
		return this.setProperty("salary", value);
	}
}

describe("CeriosBuilder - Custom Validators", () => {
	describe("addValidator()", () => {
		it("should accept a validator that returns true", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(25)
				.addValidator(obj => obj.age !== undefined && obj.age >= 18);

			expect(() => builder.build()).not.toThrow();
		});

		it("should throw error when validator returns false", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(15)
				.addValidator(obj => obj.age !== undefined && obj.age >= 18);

			expect(() => builder.build()).toThrow("Validation failed");
		});

		it("should throw custom error message when validator returns string", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(15)
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older");

			expect(() => builder.build()).toThrow("Age must be 18 or older");
		});

		it("should run multiple validators", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(20)
				.setEmail("invalid-email")
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.addValidator(obj => (obj.email?.includes("@") ?? true) || "Invalid email format");

			expect(() => builder.build()).toThrow("Invalid email format");
		});

		it("should pass all validators when all are valid", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(25)
				.setEmail("john@example.com")
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.addValidator(obj => (obj.email?.includes("@") ?? true) || "Invalid email format");

			expect(() => builder.build()).not.toThrow();
			const person = builder.build();
			expect(person.age).toBe(25);
		});

		it("should collect all validation errors", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(15)
				.setEmail("invalid-email")
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
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(25)
				.setSalary(50000)
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
			const builder1 = new PersonBuilder().addValidator(
				obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older"
			);

			const builder2 = builder1.setName("John").setAge(20);

			const builder3 = builder2.setEmail("john@example.com");

			expect(() => builder3.build()).not.toThrow();
		});

		it("should fail when modified value violates validator", () => {
			const builder1 = new PersonBuilder()
				.setName("John")
				.setAge(25)
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older");

			const builder2 = builder1.setAge(15);

			expect(() => builder2.build()).toThrow("Age must be 18 or older");
		});

		it("should not run validators in buildUnsafe", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(15)
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older");

			expect(() => builder.buildUnsafe()).not.toThrow();
			const person = builder.buildUnsafe();
			expect(person.age).toBe(15);
		});

		it("should run validators in buildWithoutCompileTimeValidation", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(15)
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older");

			expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Age must be 18 or older");
		});

		it("should preserve validators when cloning", () => {
			const builder1 = new PersonBuilder()
				.setName("John")
				.setAge(25)
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older");

			const builder2 = builder1.clone().setAge(15);

			expect(() => builder2.build()).toThrow("Age must be 18 or older");
		});

		it("should allow validators that check multiple fields", () => {
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(25)
				.setEmail("john@example.com")
				.setSalary(100000)
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
			const builder = new PersonBuilder()
				.setName("John")
				.setAge(25)
				.setSalary(10000)
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
	});
});
