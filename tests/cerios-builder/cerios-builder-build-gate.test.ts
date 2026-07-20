import { describe, expect, expectTypeOf, it } from "vitest";

import { BuilderStep, CeriosBuilder } from "../../src/cerios-builder";

type Prefs = {
	theme?: string;
	locale?: string;
};

class PrefsBuilder extends CeriosBuilder<Prefs> {
	static create(): PrefsBuilder {
		return new PrefsBuilder({});
	}

	theme(value: string): BuilderStep<this, Prefs, "theme"> {
		return this.setProperty("theme", value);
	}

	locale(value: string): BuilderStep<this, Prefs, "locale"> {
		return this.setProperty("locale", value);
	}
}

type Account = {
	id: string;
	nickname?: string;
};

class AccountBuilder extends CeriosBuilder<Account> {
	static create(): AccountBuilder {
		return new AccountBuilder({});
	}

	id(value: string): BuilderStep<this, Account, "id"> {
		return this.setProperty("id", value);
	}

	nickname(value: string): BuilderStep<this, Account, "nickname"> {
		return this.setProperty("nickname", value);
	}
}

// The build gate dissolves when the target type has no required keys: an all-optional type
// builds without a single setter call. A type with any required key keeps the strict gate.
describe("CeriosBuilder - build gate on all-optional types", () => {
	it("builds an all-optional type without any setter call", () => {
		expectTypeOf(PrefsBuilder.create().build()).toEqualTypeOf<Prefs>();
		expect(PrefsBuilder.create().build()).toEqual({});
	});

	it("keeps every compile-time-validated variant available on a fresh builder", () => {
		expect(PrefsBuilder.create().buildWithoutRuntimeValidation()).toEqual({});
		expect(PrefsBuilder.create().buildFrozen()).toEqual({});
		expect(Object.isFrozen(PrefsBuilder.create().buildFrozen())).toBe(true);
		expect(PrefsBuilder.create().buildDeepFrozen()).toEqual({});
		expect(PrefsBuilder.create().buildSealed()).toEqual({});
		expect(PrefsBuilder.create().buildDeepSealed()).toEqual({});
	});

	it("still builds after setting and removing optional properties", () => {
		expect(PrefsBuilder.create().theme("dark").build()).toEqual({ theme: "dark" });
		expect(PrefsBuilder.create().theme("dark").removeOptionalProperty("theme").build()).toEqual({});
		expect(PrefsBuilder.create().theme("dark").locale("nl").clearOptionalProperties().build()).toEqual({});
	});

	it("keeps the strict gate for a type with required keys", () => {
		// @ts-expect-error - id is required and not set
		AccountBuilder.create().build();
		// @ts-expect-error - setting only an optional key does not satisfy the gate
		AccountBuilder.create().nickname("x").build();

		expect(AccountBuilder.create().id("1").build()).toEqual({ id: "1" });
	});

	it("still runs runtime validation when configured", () => {
		const builder = PrefsBuilder.create().setRequiredFields(["theme"]);

		expect(() => builder.build()).toThrow("Missing required fields: theme");
		expect(builder.theme("dark").build()).toEqual({ theme: "dark" });
	});

	it("reports a required field whose key exists but whose value is null or undefined", () => {
		const builder = PrefsBuilder.create().setRequiredFields(["theme"]);

		expect(() => builder.theme(null as unknown as string).build()).toThrow("Missing required fields: theme");
		expect(() => builder.theme(undefined as unknown as string).build()).toThrow("Missing required fields: theme");
	});
});
