import { describe, expect, expectTypeOf, it } from "vitest";

import { BuildableThis } from "../../src/auto-builder-core";
import { AutoSetters, CeriosAutoBuilder } from "../../src/cerios-auto-builder";
import { BuilderStep, BuilderWith, InternalBuilderBrand } from "../../src/cerios-builder";
import { MissingRequiredProperties } from "../../src/types";

type User = {
	id: string;
	name: string;
	role: string;
	age?: number;
	build?: number; // reserved-name property -> setter buildProp
	"content-type"?: string; // non-identifier -> bracket access
};

class UserBuilder extends CeriosAutoBuilder<User>() {
	static create(): UserBuilder {
		return new UserBuilder({});
	}
}

// A builder with custom logic: distinctly-named methods delegating to auto setters.
class AdminUserBuilder extends CeriosAutoBuilder<User>() {
	static create(): AdminUserBuilder {
		return new AdminUserBuilder({});
	}
	asAdmin(): BuilderStep<this, User, "role"> {
		return this.role("admin");
	}

	asNamedAdmin(name: string): BuilderWith<this, "name" | "role"> {
		return this.name(name).role("admin");
	}
}

type OptionalOnly = { a?: string; b?: number };
class OptionalOnlyBuilder extends CeriosAutoBuilder<OptionalOnly>() {
	static create(): OptionalOnlyBuilder {
		return new OptionalOnlyBuilder({});
	}
}

describe("CeriosAutoBuilder - compile-time safety", () => {
	it("allows build() only once every required property is set", () => {
		const complete = UserBuilder.create().id("1").name("n").role("r");
		expectTypeOf(complete.build()).toEqualTypeOf<User>();

		// @ts-expect-error - name and role not set
		UserBuilder.create().id("1").build();
		// @ts-expect-error - nothing set
		UserBuilder.create().build();

		expect(complete.build()).toEqual({ id: "1", name: "n", role: "r" });
	});

	it("generates working setters for readonly properties and keeps the built object readonly", () => {
		// `readonly` forbids reassignment *after* construction, and the builder is the
		// construction - the same reason a literal may initialize a readonly property.
		// Excluding readonly properties would make immutable types unbuildable.
		type ImmutableUser = { readonly id: string; name: string };

		class ImmutableUserBuilder extends CeriosAutoBuilder<ImmutableUser>() {
			static create(): ImmutableUserBuilder {
				return new ImmutableUserBuilder({});
			}
		}

		const built = ImmutableUserBuilder.create().id("1").name("n").build();
		expect(built).toEqual({ id: "1", name: "n" });
		expectTypeOf(built).toEqualTypeOf<ImmutableUser>();

		// The built object keeps its readonly typing.
		// @ts-expect-error - id is readonly once built
		built.id = "2";
	});

	it("gates all compile-time-validated build variants", () => {
		const incomplete = UserBuilder.create().id("1");

		// @ts-expect-error - required properties missing
		incomplete.buildWithoutRuntimeValidation();
		// @ts-expect-error - required properties missing
		incomplete.buildFrozen();
		// @ts-expect-error - required properties missing
		incomplete.buildDeepFrozen();
		// @ts-expect-error - required properties missing
		incomplete.buildSealed();
		// @ts-expect-error - required properties missing
		incomplete.buildDeepSealed();

		expect(incomplete.buildPartial()).toEqual({ id: "1" });
		expect(incomplete.buildUnsafe()).toEqual({ id: "1" });
	});

	it("enforces setter value types", () => {
		// @ts-expect-error - id must be a string
		const wrong = UserBuilder.create().id(123);
		// @ts-expect-error - unknown property has no setter
		UserBuilder.create().unknownProp("x");

		expect(wrong.buildPartial()).toEqual({ id: 123 });
	});

	it("hides the protected setProperty helper", () => {
		// @ts-expect-error - setProperty is not part of the auto-builder API
		UserBuilder.create().setProperty("id", "1");

		expect(UserBuilder.create().id("1").buildPartial()).toEqual({ id: "1" });
	});

	it("routes reserved-name properties to *Prop and tracks the brand", () => {
		// The `build` property is set via buildProp; build is optional so it isn't required.
		const built = UserBuilder.create().id("1").name("n").role("r").buildProp(5).build();
		expect(built.build).toBe(5);

		// @ts-expect-error - `build` is the method, not a property setter
		UserBuilder.create().build(5);
	});

	it("sets non-identifier keys via bracket access with tracking", () => {
		const built = UserBuilder.create().id("1").name("n").role("r")["content-type"]("application/json").build();
		expect(built["content-type"]).toBe("application/json");
	});

	it("builds an all-optional type without any setter call", () => {
		// With no required keys there is nothing to track, so the build gate dissolves
		// and a fresh builder can build() immediately.
		expectTypeOf(OptionalOnlyBuilder.create().build()).toEqualTypeOf<OptionalOnly>();
		expect(OptionalOnlyBuilder.create().build()).toEqual({});
		expect(OptionalOnlyBuilder.create().buildFrozen()).toEqual({});

		// Setting optional keys keeps working, before and after the gate.
		expectTypeOf(OptionalOnlyBuilder.create().a("x").build()).toEqualTypeOf<OptionalOnly>();
		expect(OptionalOnlyBuilder.create().a("x").build()).toEqual({ a: "x" });
	});

	it("supports custom logic through distinctly-named methods delegating to auto setters", () => {
		const built = AdminUserBuilder.create().id("1").name("n").asAdmin().build();
		expect(built.role).toBe("admin");
	});

	it("allows BuilderWith<this, K1 | K2> for an instance method chaining two setters (issue #10)", () => {
		const built = AdminUserBuilder.create().id("1").asNamedAdmin("Alice").build();
		expect(built).toEqual({ id: "1", name: "Alice", role: "admin" });
	});

	it("takes exactly one type argument - the excluded-keys parameter is gone", () => {
		// @ts-expect-error - the factory has no second (excluded keys) type parameter
		const base = CeriosAutoBuilder<User, "role">();
		expect(base).toBeDefined();
	});

	it("keeps a fully-set builder assignable to the plain subclass type", () => {
		const plain: UserBuilder = UserBuilder.create().id("1").name("n").role("r");
		expect(plain.buildPartial().id).toBe("1");
	});
});

describe("CeriosAutoBuilder - build() compile error", () => {
	// The `this` type the validated build variants demand from a given builder. When it is
	// MissingRequiredProperties<...>, the compile error reads
	// "... is not assignable to method's 'this' of type 'MissingRequiredProperties<"name" | "role">'".
	type BuildThis<B> = BuildableThis<B, InternalBuilderBrand<User>>;

	it("names exactly the required properties that are not set", () => {
		const nothing = UserBuilder.create();
		const idOnly = UserBuilder.create().id("1");
		const complete = UserBuilder.create().id("1").name("n").role("r");

		expectTypeOf<BuildThis<typeof nothing>>().toEqualTypeOf<MissingRequiredProperties<"id" | "name" | "role">>();
		expectTypeOf<BuildThis<typeof idOnly>>().toEqualTypeOf<MissingRequiredProperties<"name" | "role">>();
		expectTypeOf<BuildThis<typeof complete>>().toEqualTypeOf<typeof complete>();
		expect(complete.build()).toEqual({ id: "1", name: "n", role: "r" });
	});

	it("keeps build() working on `this` inside a builder's own method", () => {
		class DefaultUserBuilder extends CeriosAutoBuilder<User>() {
			static create(): DefaultUserBuilder {
				return new DefaultUserBuilder({});
			}

			buildDefault(): User {
				return this.id("1").name("Default").role("user").build();
			}
		}

		expect(DefaultUserBuilder.create().buildDefault()).toEqual({ id: "1", name: "Default", role: "user" });
	});

	it("keeps build() working in a generic helper", () => {
		function finish<B extends UserBuilder>(builder: B & InternalBuilderBrand<User>): User {
			return builder.build();
		}

		expect(finish(UserBuilder.create().id("1").name("n").role("r"))).toEqual({ id: "1", name: "n", role: "r" });
	});

	it("keeps build() overridable and its return type readable", () => {
		class LoggingUserBuilder extends CeriosAutoBuilder<User>() {
			static create(): LoggingUserBuilder {
				return new LoggingUserBuilder({});
			}

			override build(): User {
				return { ...this.buildUnsafe(), name: "overridden" };
			}
		}

		expectTypeOf<ReturnType<UserBuilder["build"]>>().toEqualTypeOf<User>();
		expect(LoggingUserBuilder.create().id("1").build().name).toBe("overridden");
	});
});

describe("CeriosAutoBuilder - generated setter shape", () => {
	it("gives optional properties a callable setter", () => {
		type Setters = AutoSetters<{ required: string; optional?: number; readonly fixed: string }>;

		expectTypeOf<keyof Setters>().toEqualTypeOf<"required" | "optional" | "fixed">();
		expectTypeOf<Parameters<Setters["optional"]>[0]>().toEqualTypeOf<number | undefined>();
		expectTypeOf<Parameters<Setters["fixed"]>[0]>().toEqualTypeOf<string>();
	});

	it("keeps reserved and non-identifier names unchanged", () => {
		expectTypeOf<keyof AutoSetters<User>>().toEqualTypeOf<
			"id" | "name" | "role" | "age" | "buildProp" | "content-type"
		>();
	});

	it("generates no setter for numeric or symbol keys", () => {
		const tag = Symbol("tag");
		type Odd = { 0: string; [tag]: string; label: string };

		expectTypeOf<keyof AutoSetters<Odd>>().toEqualTypeOf<"label">();
	});

	it("supports a union target, with setters for the common keys", () => {
		type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number };

		class ShapeBuilder extends CeriosAutoBuilder<Shape>() {
			static create(): ShapeBuilder {
				return new ShapeBuilder({});
			}
		}

		expectTypeOf<keyof AutoSetters<Shape>>().toEqualTypeOf<"kind">();
		expect(ShapeBuilder.create().kind("circle").buildPartial()).toEqual({ kind: "circle" });
	});
});
