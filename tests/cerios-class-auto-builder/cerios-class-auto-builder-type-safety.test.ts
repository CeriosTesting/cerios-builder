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
