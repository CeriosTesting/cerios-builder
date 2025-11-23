import { CeriosClassBuilder, ClassConstructor } from "../../src/cerios-class-builder";

class User {
	id!: string;
	name!: string;
	email!: string;
	age?: number;
	address?: {
		street: string;
		city: string;
	};

	constructor(data?: Partial<User>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	getFullInfo() {
		return `${this.name} (${this.email})`;
	}
}

class UserBuilder extends CeriosClassBuilder<User> {
	static requiredDataProperties = ["id", "name", "email"] as const;

	constructor(
		classConstructor: ClassConstructor<User> = User,
		data: Partial<User> = {},
		validators?: Array<(obj: Partial<User>) => boolean | string>,
		requiredFields?: Set<string>
	) {
		super(classConstructor, data, validators, requiredFields);
	}

	static create() {
		return new UserBuilder();
	}

	id(value: string) {
		return this.setProperty("id", value);
	}

	name(value: string) {
		return this.setProperty("name", value);
	}

	email(value: string) {
		return this.setProperty("email", value);
	}

	age(value: number) {
		return this.setProperty("age", value);
	}

	address(value: { street: string; city: string }) {
		return this.setProperty("address", value);
	}
}

describe("CeriosClassBuilder Build Methods", () => {
	describe("build() - compile-time + runtime validation", () => {
		test("should build successfully when all required fields are set", () => {
			const user = UserBuilder.create().id("1").name("John").email("john@example.com").build();

			expect(user).toBeInstanceOf(User);
			expect(user.id).toBe("1");
			expect(user.name).toBe("John");
			expect(user.email).toBe("john@example.com");
			expect(user.getFullInfo()).toBe("John (john@example.com)");
		});

		test("should throw error at runtime when required field is missing", () => {
			const builder = UserBuilder.create().id("1").name("John");

			// TypeScript would prevent calling build() here, but we can force it for testing
			expect(() => (builder as any).build()).toThrow("Missing required fields: email");
		});

		test("should build with optional fields", () => {
			const user = UserBuilder.create()
				.id("2")
				.name("Jane")
				.email("jane@example.com")
				.age(25)
				.address({ street: "123 Main St", city: "New York" })
				.build();

			expect(user.age).toBe(25);
			expect(user.address).toEqual({ street: "123 Main St", city: "New York" });
		});

		test("should throw error when multiple required fields are missing", () => {
			const builder = UserBuilder.create().id("3");

			expect(() => (builder as any).build()).toThrow("Missing required fields: name, email");
		});
	});

	describe("buildWithoutRuntimeValidation() - only compile-time validation", () => {
		test("should build successfully when all required fields are set (no runtime check)", () => {
			const user = UserBuilder.create()
				.id("4")
				.name("Alice")
				.email("alice@example.com")
				.buildWithoutRuntimeValidation();

			expect(user).toBeInstanceOf(User);
			expect(user.id).toBe("4");
			expect(user.name).toBe("Alice");
			expect(user.email).toBe("alice@example.com");
		});

		test("should build without runtime validation even when template check would fail", () => {
			// This bypasses runtime validation but TypeScript still enforces compile-time
			const user = UserBuilder.create().id("5").name("Bob").email("bob@example.com").buildWithoutRuntimeValidation();

			expect(user.id).toBe("5");
			expect(user.name).toBe("Bob");
		});

		test("should preserve class methods", () => {
			const user = UserBuilder.create()
				.id("6")
				.name("Charlie")
				.email("charlie@example.com")
				.buildWithoutRuntimeValidation();

			expect(user.getFullInfo()).toBe("Charlie (charlie@example.com)");
		});
	});

	describe("buildWithoutCompileTimeValidation() - only runtime validation", () => {
		test("should build successfully when all required fields are set", () => {
			const user = UserBuilder.create()
				.id("7")
				.name("David")
				.email("david@example.com")
				.buildWithoutCompileTimeValidation();

			expect(user).toBeInstanceOf(User);
			expect(user.id).toBe("7");
			expect(user.name).toBe("David");
			expect(user.email).toBe("david@example.com");
		});

		test("should throw error at runtime when required field is missing", () => {
			const builder = UserBuilder.create().id("8").name("Eve");

			expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: email");
		});

		test("should throw error when multiple required fields are missing", () => {
			const builder = UserBuilder.create().id("9");

			expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: name, email");
		});

		test("should preserve class methods", () => {
			const user = UserBuilder.create()
				.id("10")
				.name("Frank")
				.email("frank@example.com")
				.buildWithoutCompileTimeValidation();

			expect(user.getFullInfo()).toBe("Frank (frank@example.com)");
		});
	});

	describe("buildUnsafe() - no validation at all", () => {
		test("should build successfully with all fields", () => {
			const user = UserBuilder.create().id("11").name("Grace").email("grace@example.com").buildUnsafe();

			expect(user).toBeInstanceOf(User);
			expect(user.id).toBe("11");
			expect(user.name).toBe("Grace");
			expect(user.email).toBe("grace@example.com");
		});

		test("should build even when required fields are missing (no validation)", () => {
			const user = UserBuilder.create().id("12").buildUnsafe();

			expect(user).toBeInstanceOf(User);
			expect(user.id).toBe("12");
			expect(user.name).toBeUndefined();
			expect(user.email).toBeUndefined();
		});

		test("should preserve class methods", () => {
			const user = UserBuilder.create().id("13").name("Henry").email("henry@example.com").buildUnsafe();

			expect(user.getFullInfo()).toBe("Henry (henry@example.com)");
		});
	});

	describe("buildPartial() - returns Partial<T>", () => {
		test("should build partial object", () => {
			const partial = UserBuilder.create().name("Partial User").buildPartial();

			expect(partial).toEqual({
				name: "Partial User",
			});
		});

		test("should build partial object with multiple fields", () => {
			const partial = UserBuilder.create().id("14").name("Isabel").buildPartial();

			expect(partial).toEqual({
				id: "14",
				name: "Isabel",
			});
		});

		test("should build empty partial object", () => {
			const partial = UserBuilder.create().buildPartial();

			expect(partial).toEqual({});
		});
	});

	describe("setRequiredFields() - dynamic required fields", () => {
		test("should validate dynamically set required fields at runtime", () => {
			const builder = UserBuilder.create()
				.setRequiredFields(["id", "name", "email"])
				.id("15")
				.name("Jack")
				.email("jack@example.com");

			expect(() => builder.buildWithoutCompileTimeValidation()).not.toThrow();
		});

		test("should throw error when dynamically required field is missing", () => {
			const builder = UserBuilder.create().id("16").name("Kate").email("kate@example.com").setRequiredFields(["age"]);

			expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields: age");
		});

		test("should combine static and dynamic required fields", () => {
			// Static: id, name, email
			// Dynamic: age
			const builder = UserBuilder.create().setRequiredFields(["age"]).id("17").name("Liam");

			// Both email (static) and age (dynamic) are required and missing
			expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields");
		});

		test("should validate all combined required fields", () => {
			const user = UserBuilder.create()
				.setRequiredFields(["age"])
				.id("18")
				.name("Mia")
				.email("mia@example.com")
				.age(30)
				.buildWithoutCompileTimeValidation();

			expect(user).toBeInstanceOf(User);
			expect(user.id).toBe("18");
			expect(user.age).toBe(30);
		});

		test("should support nested path validation", () => {
			const builder = UserBuilder.create().setRequiredFields(["address.city"]).id("19").name("Noah");

			// Missing both email (static) and address.city (dynamic)
			expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Missing required fields");
		});

		test("should validate nested path successfully when set", () => {
			const user = UserBuilder.create()
				.setRequiredFields(["address.city"])
				.id("20")
				.name("Olivia")
				.email("olivia@example.com")
				.address({ street: "456 Oak Ave", city: "Boston" })
				.buildWithoutCompileTimeValidation();

			expect(user.address?.city).toBe("Boston");
		});
	});

	describe("buildFrozen() - validates and freezes", () => {
		test("should build and freeze object", () => {
			const user = UserBuilder.create().id("21").name("Paul").email("paul@example.com").buildFrozen();

			expect(Object.isFrozen(user)).toBe(true);
			expect(() => {
				(user as any).name = "Changed";
			}).toThrow();
		});

		test("should throw error when required fields are missing", () => {
			const builder = UserBuilder.create().id("22").name("Quinn");

			expect(() => (builder as any).buildFrozen()).toThrow("Missing required fields: email");
		});
	});

	describe("buildDeepFrozen() - validates and deep freezes", () => {
		test("should build and deep freeze object", () => {
			const user = UserBuilder.create()
				.id("23")
				.name("Rachel")
				.email("rachel@example.com")
				.address({ street: "789 Elm St", city: "Chicago" })
				.buildDeepFrozen();

			expect(Object.isFrozen(user)).toBe(true);
			expect(Object.isFrozen(user.address)).toBe(true);
			expect(() => {
				(user.address as any).city = "Changed";
			}).toThrow();
		});

		test("should throw error when required fields are missing", () => {
			const builder = UserBuilder.create().id("24");

			expect(() => (builder as any).buildDeepFrozen()).toThrow("Missing required fields: name, email");
		});
	});

	describe("buildSealed() - validates and seals", () => {
		test("should build and seal object", () => {
			const user = UserBuilder.create().id("25").name("Sam").email("sam@example.com").buildSealed();

			expect(Object.isSealed(user)).toBe(true);
			// Can modify existing properties
			user.name = "Samuel";
			expect(user.name).toBe("Samuel");
			// Cannot add new properties
			expect(() => {
				(user as any).newProp = "value";
			}).toThrow();
		});

		test("should throw error when required fields are missing", () => {
			const builder = UserBuilder.create().id("26").name("Tina");

			expect(() => (builder as any).buildSealed()).toThrow("Missing required fields: email");
		});
	});

	describe("buildDeepSealed() - validates and deep seals", () => {
		test("should build and deep seal object", () => {
			const user = UserBuilder.create()
				.id("27")
				.name("Uma")
				.email("uma@example.com")
				.address({ street: "321 Pine St", city: "Denver" })
				.buildDeepSealed();

			expect(Object.isSealed(user)).toBe(true);
			expect(Object.isSealed(user.address)).toBe(true);
			// Can modify existing properties
			user.name = "Uma Smith";
			if (user.address) {
				user.address.city = "Boulder";
			}
			expect(user.name).toBe("Uma Smith");
			expect(user.address?.city).toBe("Boulder");
		});

		test("should throw error when required fields are missing", () => {
			const builder = UserBuilder.create().name("Victor");

			expect(() => (builder as any).buildDeepSealed()).toThrow("Missing required fields: id, email");
		});
	});

	describe("Validation with custom validators", () => {
		test("build() should run custom validators", () => {
			const builder = UserBuilder.create()
				.id("28")
				.name("Wendy")
				.email("wendy@example.com")
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.age(15);

			expect(() => builder.build()).toThrow("Validation failed: Age must be 18 or older");
		});

		test("buildWithoutCompileTimeValidation() should run custom validators", () => {
			const builder = UserBuilder.create()
				.id("29")
				.name("Xavier")
				.email("xavier@example.com")
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.age(16);

			expect(() => builder.buildWithoutCompileTimeValidation()).toThrow("Validation failed: Age must be 18 or older");
		});

		test("buildWithoutRuntimeValidation() should skip custom validators", () => {
			const user = UserBuilder.create()
				.id("30")
				.name("Yara")
				.email("yara@example.com")
				.age(16)
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.buildWithoutRuntimeValidation();

			expect(user.age).toBe(16); // Should not throw even though age < 18
		});

		test("buildUnsafe() should skip custom validators", () => {
			const user = UserBuilder.create()
				.id("31")
				.name("Zack")
				.email("zack@example.com")
				.age(10)
				.addValidator(obj => (obj.age !== undefined && obj.age >= 18) || "Age must be 18 or older")
				.buildUnsafe();

			expect(user.age).toBe(10); // Should not throw even though age < 18
		});
	});
});
