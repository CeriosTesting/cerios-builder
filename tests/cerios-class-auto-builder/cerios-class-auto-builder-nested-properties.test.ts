import { describe, expect, it } from "vitest";

import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";
import { ClassBuilderStep } from "../../src/cerios-class-builder";

class Person {
	name!: string;
	hobbies?: string[];
	address?: { street: string; city: string };

	constructor(data?: Partial<Person>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	greet(): string {
		return `Hello, ${this.name}`;
	}
}

class PersonBuilder extends CeriosClassAutoBuilder(Person) {
	static create(): PersonBuilder {
		return new PersonBuilder();
	}

	// The supported replacement for the removed addToArrayProperty helper: a custom
	// method that rebuilds the array through the root setter.
	addHobby(hobby: string): ClassBuilderStep<this, Person, "hobbies"> {
		return this.hobbies([...(this.buildPartial().hobbies ?? []), hobby]);
	}

	// The supported replacement for the removed setNestedProperty helper: a custom
	// method that replaces the root data property with an updated whole value.
	inCity(city: string): ClassBuilderStep<this, Person, "address"> {
		const address = this.buildPartial().address ?? { street: "", city: "" };
		return this.address({ ...address, city });
	}
}

// A class auto builder exposes only whole-root-property setters. The dot-path and
// array-append helpers of the deprecated base builders are intentionally not part of its
// API: nested structures are composed with custom methods or a director coordinating
// multiple builders.
describe("CeriosClassAutoBuilder - no fine-grained mutation helpers", () => {
	it("hides every fine-grained mutation helper at the type level", () => {
		const builder = PersonBuilder.create().name("John");

		// @ts-expect-error - setNestedProperty is not part of the auto-builder API
		builder.setNestedProperty("address.city", "Springfield");
		// @ts-expect-error - addToArrayProperty is not part of the auto-builder API
		builder.addToArrayProperty("hobbies", "chess");
		// @ts-expect-error - setProperty is not part of the auto-builder API
		builder.setProperty("name", "Jane");
		// @ts-expect-error - setProperties is not part of the auto-builder API
		builder.setProperties({ name: "Jane" });

		// Copy-on-write: even the (runtime-reachable) hidden members left the builder alone.
		expect(builder.buildPartial()).toEqual({ name: "John" });
	});
});

describe("CeriosClassAutoBuilder - custom-method replacements", () => {
	it("appends to an array via a custom method delegating to the root setter", () => {
		const builder = PersonBuilder.create().name("John").addHobby("chess").addHobby("running");

		expect(builder.buildPartial().hobbies).toEqual(["chess", "running"]);
	});

	it("updates a nested value via a custom method replacing the whole root property", () => {
		const builder = PersonBuilder.create()
			.name("John")
			.address({ street: "Main St", city: "Springfield" })
			.inCity("Shelbyville");

		expect(builder.buildPartial().address).toEqual({ street: "Main St", city: "Shelbyville" });
	});

	it("stays copy-on-write: the original builder is left intact", () => {
		const original = PersonBuilder.create().name("John").hobbies(["chess"]);
		original.addHobby("running");
		original.inCity("Shelbyville");

		expect(original.buildPartial().hobbies).toEqual(["chess"]);
		expect(original.buildPartial().address).toBeUndefined();
	});

	it("builds a real instance with methods intact", () => {
		const person = PersonBuilder.create().name("John").addHobby("chess").build();

		expect(person).toBeInstanceOf(Person);
		expect(person.greet()).toBe("Hello, John");
		expect(person.hobbies).toEqual(["chess"]);
	});
});
