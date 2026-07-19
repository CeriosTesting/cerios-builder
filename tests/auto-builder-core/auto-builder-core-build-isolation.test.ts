import { describe, expect, it } from "vitest";

import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";
import { CeriosClassAutoBuilder } from "../../src/cerios-class-auto-builder";

type Config = {
	name: string;
	profile?: { tags: string[] };
};

class Person {
	name!: string;
	address?: { city: string };

	constructor(data?: Partial<Person>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	greet(): string {
		return `hi ${this.name}`;
	}
}

class ConfigBuilder extends CeriosAutoBuilder<Config>() {
	static create(): ConfigBuilder {
		return new ConfigBuilder({});
	}
}

class PersonBuilder extends CeriosClassAutoBuilder(Person) {
	static create(): PersonBuilder {
		return new PersonBuilder();
	}
}

// A build result must be the caller's to keep. Earlier suites only asserted that a build
// result was frozen/sealed and that the builder stayed *usable* - which it does, because
// setters spread into a new object. Neither checked that the result was a copy, so two
// separate aliasing bugs survived. Every variant is covered here, on both builders.
// Both builders are exercised through one shape. The factories are erased to a common
// structural type because the two brand chains are unrelated and would not unify.
type AnyBuilder = {
	build(): object;
	buildUnsafe(): object;
	buildFrozen(): object;
	buildSealed(): object;
	buildDeepFrozen(): object;
	buildDeepSealed(): object;
	buildPartial(): object;
};

describe.each([
	[
		"object",
		(): AnyBuilder =>
			ConfigBuilder.create()
				.name("n")
				.profile({ tags: ["a"] }) as unknown as AnyBuilder,
	],
	["class", (): AnyBuilder => PersonBuilder.create().name("n").address({ city: "R" }) as unknown as AnyBuilder],
] as const)("%s builder - build results are owned by the caller", (_kind, make) => {
	it("returns a distinct object from build()", () => {
		const builder = make();

		expect(builder.build()).not.toBe(builder.build());
	});

	it("returns a distinct object from buildUnsafe()", () => {
		const builder = make();

		expect(builder.buildUnsafe()).not.toBe(builder.buildUnsafe());
	});

	it("returns a distinct object from buildFrozen()", () => {
		const builder = make();

		expect(builder.buildFrozen()).not.toBe(builder.buildFrozen());
	});

	it("returns a distinct object from buildSealed()", () => {
		const builder = make();

		expect(builder.buildSealed()).not.toBe(builder.buildSealed());
	});

	it("does not let a mutated build result reach the builder", () => {
		const builder = make();
		const built = builder.build() as Record<string, { tags?: string[]; city?: string }>;

		if (built.profile?.tags) {
			built.profile.tags.push("MUTATED");
		}
		if (built.address) {
			built.address.city = "MUTATED";
		}

		const rebuilt = builder.build() as Record<string, { tags?: string[]; city?: string }>;
		expect(rebuilt.profile?.tags ?? ["a"]).toEqual(["a"]);
		expect(rebuilt.address?.city ?? "R").toBe("R");
	});

	it("leaves the builder unfrozen after buildFrozen()", () => {
		const builder = make();
		builder.buildFrozen();

		// The builder's own state must not be frozen in place, or later builds silently
		// drop writes.
		expect(Object.isFrozen(builder.buildPartial())).toBe(false);
		expect(builder.buildUnsafe()).toBeDefined();
	});

	it("still produces a mutable result after buildDeepFrozen()", () => {
		const builder = make();
		builder.buildDeepFrozen();

		const after = builder.buildUnsafe() as Record<string, unknown>;
		expect(Object.isFrozen(after)).toBe(false);
		const nested = (after.profile ?? after.address) as object | undefined;
		expect(nested).toBeDefined();
		expect(Object.isFrozen(nested)).toBe(false);
	});

	it("still produces an unsealed result after buildDeepSealed()", () => {
		const builder = make();
		builder.buildDeepSealed();

		expect(Object.isSealed(builder.buildUnsafe())).toBe(false);
	});

	it("does not let buildFrozen() make a later buildSealed() frozen", () => {
		const builder = make();
		builder.buildFrozen();

		// buildSealed promises the result's existing properties stay writable.
		expect(Object.isFrozen(builder.buildSealed())).toBe(false);
	});
});

describe("class builder keeps its prototype and identity", () => {
	it("returns a real instance that does not alias builder state", () => {
		const builder = PersonBuilder.create().name("n").address({ city: "R" });
		const first = builder.build();
		first.address!.city = "MUTATED";

		const second = builder.build();
		expect(second).toBeInstanceOf(Person);
		expect(second.greet()).toBe("hi n");
		expect(second.address?.city).toBe("R");
	});
});
