import { describe, expect, expectTypeOf, it } from "vitest";

import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";
import { ClassBuilderStep } from "../../src/cerios-class-builder";

class Person {
	name!: string;
	age!: number;
	email?: string;

	constructor(data?: Partial<Person>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	greet(): string {
		return `Hi, ${this.name}`;
	}

	// Method WITH parameters - the DataPropertiesOnly fix must strip it.
	rename(next: string): void {
		this.name = next;
	}
}

class PersonBuilder extends CeriosClassAutoBuilder(Person) {
	static create(): PersonBuilder {
		return new PersonBuilder();
	}
}

describe("CeriosClassAutoBuilder - compile-time safety", () => {
	it("allows build() only once all required data properties are set", () => {
		const complete = PersonBuilder.create().name("John").age(30);
		expectTypeOf(complete.build()).toEqualTypeOf<Person>();

		// @ts-expect-error - age not set
		PersonBuilder.create().name("John").build();
		// @ts-expect-error - nothing set
		PersonBuilder.create().build();

		expect(complete.build().greet()).toBe("Hi, John");
	});

	it("does not generate setters for private or protected members", () => {
		class Secretive {
			name!: string;
			private secret = "s3cret";
			protected internalCode = 7;

			revealSecret(): string {
				return this.secret;
			}

			revealCode(): number {
				return this.internalCode;
			}
		}

		class SecretiveBuilder extends CeriosClassAutoBuilder(Secretive) {
			static create(): SecretiveBuilder {
				return new SecretiveBuilder();
			}
		}

		// `keyof` only surfaces public members, so non-public properties get no setter and
		// do not count toward the build gate; the class's own field initializers still run.
		const builder = SecretiveBuilder.create().name("n");
		// @ts-expect-error - secret is private, no setter exists
		void builder.secret;
		// @ts-expect-error - internalCode is protected, no setter exists
		void builder.internalCode;

		const built = builder.build();
		expect(built.revealSecret()).toBe("s3cret");
		expect(built.revealCode()).toBe(7);
	});

	it("does not generate a setter for readonly fields; they are seeded through the constructor", () => {
		class Entity {
			readonly id!: string;
			name!: string;

			constructor(data?: Partial<Entity>) {
				if (data) {
					Object.assign(this, data);
				}
			}
		}

		class EntityBuilder extends CeriosClassAutoBuilder(Entity) {
			static create(data?: Partial<Entity>): EntityBuilder {
				return new EntityBuilder(data);
			}
		}

		// A readonly field belongs to the class - external code must not write it, so no
		// setter is generated and the gate does not demand it. It is established through the
		// class's own constructor via seed data or from().
		// @ts-expect-error - id is readonly, no setter is generated
		EntityBuilder.create().id("1");

		const built = EntityBuilder.create().name("n").build();
		expect(built.name).toBe("n");

		// Seeding the readonly field through the constructor carries it into the instance.
		const seeded = EntityBuilder.create({ id: "1" }).name("n").build();
		expect(seeded.id).toBe("1");

		const fromInstance = EntityBuilder.from(new Entity({ id: "2", name: "n" })).build();
		expect(fromInstance.id).toBe("2");
	});

	it("does not generate setters for methods (with or without parameters)", () => {
		// @ts-expect-error - greet is a method, not a data property
		PersonBuilder.create().greet(() => "x");
		// @ts-expect-error - rename is a parameterized method, not a data property
		PersonBuilder.create().rename("x");

		expect(PersonBuilder.create().name("n").age(1).build()).toBeInstanceOf(Person);
	});

	it("does not require methods or optional properties to build", () => {
		const person = PersonBuilder.create().name("John").age(30).build();
		expect(person.email).toBeUndefined();
	});

	it("enforces setter value types", () => {
		// @ts-expect-error - age must be a number
		const wrong = PersonBuilder.create().age("thirty");
		// @ts-expect-error - unknown property
		PersonBuilder.create().unknownProp("x");

		expect(wrong.buildPartial()).toEqual({ age: "thirty" });
	});

	it("gates compile-time-validated build variants until complete", () => {
		const incomplete = PersonBuilder.create().name("John");

		// @ts-expect-error - age missing
		incomplete.buildWithoutRuntimeValidation();
		// @ts-expect-error - age missing
		incomplete.buildFrozen();

		expect(incomplete.buildPartial()).toEqual({ name: "John" });
	});

	it("makes builders seeded with from immediately buildable", () => {
		const existing = new Person({ name: "John", age: 30 });
		const person = PersonBuilder.from(existing).build();
		expect(person).toBeInstanceOf(Person);
	});

	it("gates every compile-time-validated build variant", () => {
		const incomplete = PersonBuilder.create().name("John");

		// @ts-expect-error - age missing
		incomplete.build();
		// @ts-expect-error - age missing
		incomplete.buildWithoutRuntimeValidation();
		// @ts-expect-error - age missing
		incomplete.buildFrozen();
		// @ts-expect-error - age missing
		incomplete.buildDeepFrozen();
		// @ts-expect-error - age missing
		incomplete.buildSealed();
		// @ts-expect-error - age missing
		incomplete.buildDeepSealed();

		// The unvalidated variants stay callable at any point.
		expect(incomplete.buildUnsafe()).toBeInstanceOf(Person);
		expect(incomplete.buildPartial()).toEqual({ name: "John" });
	});

	it("hides the protected setProperty and setProperties helpers", () => {
		// @ts-expect-error - setProperty is not part of the class auto-builder API
		const viaSetProperty = PersonBuilder.create().setProperty("name", "John");
		// @ts-expect-error - setProperties is not part of the class auto-builder API
		const viaSetProperties = PersonBuilder.create().setProperties({ name: "John" });

		// Hidden at compile time only - the protected members still exist at runtime.
		expect(viaSetProperty).toBeDefined();
		expect(viaSetProperties).toBeDefined();
	});

	it("keeps a fully-set builder assignable to the plain subclass type", () => {
		const complete: PersonBuilder = PersonBuilder.create().name("John").age(30);

		expect(complete.buildPartial()).toEqual({ name: "John", age: 30 });
	});

	it("supports custom logic through distinctly-named methods delegating to auto setters", () => {
		class TrimmedBuilder extends CeriosClassAutoBuilder(Person) {
			static create(): TrimmedBuilder {
				return new TrimmedBuilder();
			}

			trimmedName(value: string): ClassBuilderStep<this, Person, "name"> {
				return this.name(value.trim());
			}
		}

		expect(TrimmedBuilder.create().trimmedName("  John  ").age(30).build().name).toBe("John");
	});

	it("takes exactly one argument - the excluded-keys parameter is gone", () => {
		// @ts-expect-error - the factory no longer takes an excluded-keys argument
		const base = CeriosClassAutoBuilder(Person, ["name"]);
		expect(base).toBeDefined();
	});

	it("builds an all-optional class without any setter call", () => {
		class Settings {
			theme?: string;
			locale?: string;

			constructor(data?: Partial<Settings>) {
				if (data) {
					Object.assign(this, data);
				}
			}
		}

		class SettingsBuilder extends CeriosClassAutoBuilder(Settings) {
			static create(): SettingsBuilder {
				return new SettingsBuilder();
			}
		}

		// No required data properties: the build gate dissolves and a fresh builder builds.
		expect(SettingsBuilder.create().build()).toBeInstanceOf(Settings);
		expect(SettingsBuilder.create().theme("dark").build().theme).toBe("dark");
	});
});
