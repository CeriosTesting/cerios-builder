import { describe, expect, expectTypeOf, it } from "vitest";

import * as api from "../../src/index";
import type {
	AutoBuilderApi,
	BuilderInit,
	CeriosClassBrand,
	ClassAutoBuilderApi,
	DataPropertiesOnly,
	InternalBuilderBrand,
	InternalClassBrand,
	Path,
	RequiredFieldsRecord,
	RequiredKeys,
} from "../../src/index";

type User = { id: string; name: string; age?: number };

class Person {
	name!: string;

	constructor(data?: Partial<Person>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	greet(): string {
		return `Hi, ${this.name}`;
	}
}

// The barrel is the package's only entry point. A type used in a public signature but
// missing here cannot be named by consumers, even though it appears in their editor.
describe("public export surface", () => {
	it("exports both builder factories and both auto-builder factories at runtime", () => {
		// Only these four are values; everything else in the barrel is a type. (Under
		// transpile-only test runs the type names still appear as undefined keys, so this
		// checks the bindings rather than the key list.)
		expect(api.CeriosBuilder).toBeTypeOf("function");
		expect(api.CeriosClassBuilder).toBeTypeOf("function");
		expect(api.CeriosAutoBuilder).toBeTypeOf("function");
		expect(api.CeriosClassAutoBuilder).toBeTypeOf("function");
	});

	it("exports the brands used in every gated build signature", () => {
		// These appear in `from`'s return type and in each `this:` parameter, so consumers
		// need them to write helper functions that return an already-complete builder.
		expectTypeOf<InternalBuilderBrand<User>>().toEqualTypeOf<api.CeriosBrand<User>>();
		expectTypeOf<InternalClassBrand<DataPropertiesOnly<Person>>>().toEqualTypeOf<
			CeriosClassBrand<DataPropertiesOnly<Person>>
		>();
	});

	it("exports the path types used by setRequiredFields and setNestedProperty", () => {
		expectTypeOf<Path<User>>().toEqualTypeOf<"id" | "name" | "age">();
		expectTypeOf<api.ClassPath<Person>>().toEqualTypeOf<"name">();
	});

	it("exports the required-fields helper types", () => {
		expectTypeOf<RequiredKeys<User>>().toEqualTypeOf<"id" | "name">();
		expectTypeOf<RequiredFieldsRecord<User>>().toEqualTypeOf<{ id: true; name: true }>();
	});

	it("exports the constructor options type both auto builders accept", () => {
		expectTypeOf<BuilderInit<User, Path<User>>["requiredFields"]>().toEqualTypeOf<
			ReadonlyArray<Path<User>> | RequiredFieldsRecord<User> | undefined
		>();
	});

	it("exports both auto-builder API interfaces", () => {
		expectTypeOf<AutoBuilderApi<User>["buildUnsafe"]>().toEqualTypeOf<() => User>();
		expectTypeOf<ClassAutoBuilderApi<Person>["buildUnsafe"]>().toEqualTypeOf<() => Person>();
	});

	it("exports the base-builder constraint and extension helper types", () => {
		// The base view exposes NonNullable-valued setters plus buildPartial, so shared
		// logic can be written once against a base type.
		type BaseView = InstanceType<api.AutoBuilderBase<User>>;
		expectTypeOf<Parameters<BaseView["age"]>[0]>().toEqualTypeOf<number>();
		expectTypeOf<ReturnType<BaseView["buildPartial"]>>().toEqualTypeOf<Partial<User>>();

		type ClassBaseView = InstanceType<api.ClassAutoBuilderBase<Person>>;
		expectTypeOf<Parameters<ClassBaseView["name"]>[0]>().toEqualTypeOf<string>();
		expectTypeOf<ReturnType<ClassBaseView["buildPartial"]>>().toEqualTypeOf<Partial<Person>>();

		// BuilderExtension merges the shared instance in and keeps the builder's statics.
		type Extended = api.BuilderExtension<api.AutoBuilderConstructor<User>, { helper(): void }>;
		expectTypeOf<InstanceType<Extended>["helper"]>().toEqualTypeOf<() => void>();
		expectTypeOf<Extended>().toHaveProperty("from");
	});

	it("exports DataPropertiesOnly, which every class-builder signature is expressed in", () => {
		expectTypeOf<keyof DataPropertiesOnly<Person>>().toEqualTypeOf<"name">();
	});
});
