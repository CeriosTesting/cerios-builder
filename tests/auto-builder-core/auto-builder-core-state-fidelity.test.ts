import { describe, expect, it } from "vitest";

import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";
import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";

type Payload = {
	when?: Date;
	pattern?: RegExp;
	lookup?: Map<string, number>;
	tags?: Set<string>;
	name?: string;
};

class Address {
	city!: string;

	constructor(data?: Partial<Address>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	label(): string {
		return `city=${this.city}`;
	}
}

class Person {
	name!: string;
	address?: Address;

	constructor(data?: Partial<Person>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}

class PayloadBuilder extends CeriosAutoBuilder<Payload>() {
	static create(): PayloadBuilder {
		return new PayloadBuilder({});
	}
}

class PersonBuilder extends CeriosClassAutoBuilder(Person) {
	static create(): PersonBuilder {
		return new PersonBuilder();
	}
}

// The deep-clone unit tests cover the function directly. These cover the same values
// carried as builder *state* through a real build, which is the path users hit.
describe("built results preserve built-in types", () => {
	it("keeps a Date through build()", () => {
		const built = PayloadBuilder.create().when(new Date(0)).build();

		expect(built.when).toBeInstanceOf(Date);
		expect(built.when?.getTime()).toBe(0);
	});

	it("keeps a Map and a Set through build()", () => {
		const built = PayloadBuilder.create()
			.lookup(new Map([["a", 1]]))
			.tags(new Set(["x"]))
			.build();

		expect(built.lookup).toBeInstanceOf(Map);
		expect(built.lookup?.get("a")).toBe(1);
		expect(built.tags).toBeInstanceOf(Set);
		expect(built.tags?.has("x")).toBe(true);
	});

	it("keeps a RegExp with its flags through build()", () => {
		const built = PayloadBuilder.create().pattern(/abc/gi).build();

		expect(built.pattern).toBeInstanceOf(RegExp);
		expect(built.pattern?.flags).toBe("gi");
	});

	it("does not alias a Map between the builder and the result", () => {
		const builder = PayloadBuilder.create().lookup(new Map([["a", 1]]));
		builder.build().lookup?.set("b", 2);

		expect(builder.build().lookup?.has("b")).toBe(false);
	});
});

// Deep-cloning builder state must not flatten a nested class instance to a plain object -
// that would silently strip its methods.
describe("built results preserve nested class instances", () => {
	it("keeps a nested class instance and its methods", () => {
		const built = PersonBuilder.create()
			.name("a")
			.address(new Address({ city: "Rotterdam" }))
			.build();

		expect(built.address).toBeInstanceOf(Address);
		expect(built.address?.label()).toBe("city=Rotterdam");
	});

	it("keeps nested class instances through clone() and buildFrozen()", () => {
		const builder = PersonBuilder.create()
			.name("a")
			.address(new Address({ city: "R" }));

		expect(builder.clone().build().address).toBeInstanceOf(Address);
		expect(builder.buildFrozen().address).toBeInstanceOf(Address);
	});
});

describe("prototype-unsafe keys are rejected everywhere, not just in paths", () => {
	it("no longer maps a *Prop setter back to the __proto__ key", () => {
		// `__proto__Prop` still resolves to a setter - but now it sets a property literally
		// named "__proto__Prop", which is harmless. Previously `__proto__` was reserved, so
		// this name mapped *back* to the real `__proto__` key and re-parented the result.
		const objectBuilder = PayloadBuilder.create() as unknown as Record<string, (v: unknown) => unknown>;
		const stepped = objectBuilder.__proto__Prop({ polluted: true }) as {
			buildPartial(): Record<string, unknown>;
		};

		const partial = stepped.buildPartial();
		expect(Object.keys(partial)).toEqual(["__proto__Prop"]);
		expect(Object.getPrototypeOf(partial)).toBe(Object.prototype);
	});

	it("keeps a class instance on its prototype even when __proto__Prop is used", () => {
		const classBuilder = PersonBuilder.create().name("a") as unknown as Record<
			string,
			(v: unknown) => { buildUnsafe(): Person }
		>;
		const built = classBuilder.__proto__Prop({ polluted: true }).buildUnsafe();

		// This used to strip the instance of its prototype, so `greet()` vanished.
		expect(built).toBeInstanceOf(Person);
		expect(Object.getPrototypeOf(built)).toBe(Person.prototype);
	});

	it("keeps a built class instance on its own prototype", () => {
		const built = PersonBuilder.create().name("a").build();

		expect(built).toBeInstanceOf(Person);
		expect(Object.getPrototypeOf(built)).toBe(Person.prototype);
	});

	it("rejects __proto__ passed as a plain key", () => {
		const builder = PayloadBuilder.create() as unknown as {
			setProperty: (key: string, value: unknown) => unknown;
		};

		expect(() => builder.setProperty("__proto__", { polluted: true })).toThrow("Unsafe property key");
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});

	it("still allows constructor as an ordinary data key", () => {
		// Only `__proto__` has an inherited setter; `constructor` is a plain writable
		// property, so setting it must keep working.
		const builder = PayloadBuilder.create() as unknown as Record<string, (value: unknown) => unknown>;
		const stepped = builder.constructorProp("x") as { buildPartial(): Record<string, unknown> };

		expect(stepped.buildPartial().constructor).toBe("x");
	});
});
