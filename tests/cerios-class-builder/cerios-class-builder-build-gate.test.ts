import { describe, expect, expectTypeOf, it } from "vitest";

import { CeriosClassBuilder, ClassBuilderStep, ClassConstructor, ClassPath } from "../../src/cerios-class-builder";

class Settings {
	theme?: string;
	locale?: string;

	constructor(data?: Partial<Settings>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	describe(): string {
		return `${this.theme ?? "default"}/${this.locale ?? "default"}`;
	}
}

class SettingsBuilder extends CeriosClassBuilder<Settings> {
	// The internal 4-argument shape must be forwarded, or copy-on-write methods like
	// setRequiredFields() silently lose their state - the exact trap the auto builders fixed.
	constructor(
		classConstructor: ClassConstructor<Settings> = Settings,
		data: Partial<Settings> = {},
		validators?: Array<(obj: Partial<Settings>) => boolean | string>,
		requiredFields?: ReadonlyArray<ClassPath<Settings>> | Set<string>,
	) {
		super(classConstructor, data, validators, requiredFields);
	}

	static create(): SettingsBuilder {
		return new SettingsBuilder();
	}

	theme(value: string): ClassBuilderStep<this, Settings, "theme"> {
		return this.setProperty("theme", value);
	}
}

class Profile {
	name!: string;
	bio?: string;

	constructor(data?: Partial<Profile>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}

class ProfileBuilder extends CeriosClassBuilder<Profile> {
	constructor(classConstructor: ClassConstructor<Profile> = Profile, data: Partial<Profile> = {}) {
		super(classConstructor, data);
	}

	static create(): ProfileBuilder {
		return new ProfileBuilder();
	}

	name(value: string): ClassBuilderStep<this, Profile, "name"> {
		return this.setProperty("name", value);
	}

	bio(value: string): ClassBuilderStep<this, Profile, "bio"> {
		return this.setProperty("bio", value);
	}
}

// The build gate dissolves when the class has no required data properties: an all-optional
// class builds without a single setter call. Methods never count as required.
describe("CeriosClassBuilder - build gate on all-optional classes", () => {
	it("builds an all-optional class without any setter call", () => {
		const settings = SettingsBuilder.create().build();

		expectTypeOf(settings).toEqualTypeOf<Settings>();
		expect(settings).toBeInstanceOf(Settings);
		expect(settings.describe()).toBe("default/default");
	});

	it("keeps every compile-time-validated variant available on a fresh builder", () => {
		expect(SettingsBuilder.create().buildWithoutRuntimeValidation()).toBeInstanceOf(Settings);
		expect(Object.isFrozen(SettingsBuilder.create().buildFrozen())).toBe(true);
		expect(SettingsBuilder.create().buildDeepFrozen()).toBeInstanceOf(Settings);
		expect(SettingsBuilder.create().buildSealed()).toBeInstanceOf(Settings);
		expect(SettingsBuilder.create().buildDeepSealed()).toBeInstanceOf(Settings);
	});

	it("still builds after setting and removing optional properties", () => {
		expect(SettingsBuilder.create().theme("dark").build().theme).toBe("dark");
		expect(SettingsBuilder.create().theme("dark").removeOptionalProperty("theme").build().theme).toBeUndefined();
	});

	it("keeps the strict gate for a class with required data properties", () => {
		// @ts-expect-error - name is required and not set
		ProfileBuilder.create().build();
		// @ts-expect-error - setting only an optional property does not satisfy the gate
		ProfileBuilder.create().bio("hi").build();

		expect(ProfileBuilder.create().name("n").build()).toBeInstanceOf(Profile);
	});

	it("still runs runtime validation when configured", () => {
		const builder = SettingsBuilder.create().setRequiredFields(["theme"]);

		expect(() => builder.build()).toThrow("Missing required fields: theme");
		expect(builder.theme("dark").build().theme).toBe("dark");
	});

	it("reports a required field whose key exists but whose value is null or undefined", () => {
		const builder = SettingsBuilder.create().setRequiredFields(["theme"]);

		expect(() => builder.theme(null as unknown as string).build()).toThrow("Missing required fields: theme");
		expect(() => builder.theme(undefined as unknown as string).build()).toThrow("Missing required fields: theme");
	});
});
