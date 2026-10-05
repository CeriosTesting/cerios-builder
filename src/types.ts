/**
 * Helper type to extract the builder type from a builder instance.
 * This is useful when you want to accept a builder with some fields already set
 * without manually specifying which fields are set.
 *
 * @deprecated Prefer `BuilderComposerFromFactory` (or `ClassBuilderComposerFromFactory`)
 * for callback-based APIs. This alias remains for backward compatibility.
 *
 * @template B - A builder instance type
 *
 * @example
 * ```typescript
 * import { BuilderComposerFromFactory } from "@cerios/cerios-builder";
 *
 * // Preferred modern pattern:
 * function withAddressDefaults(
 *   builderFn: BuilderComposerFromFactory<typeof AddressBuilder.createWithDefaults>
 * ) { ... }
 * ```
 */
export type BuilderType<B> = B;

/**
 * Unique symbol keying the phantom "what does this builder build" marker.
 * Never present at runtime - the property is declared optional and never assigned.
 * @internal
 */
declare const __target: unique symbol;

/**
 * Phantom marker carried by every builder, recording the type it builds.
 *
 * This exists so `BuilderWith`/`ClassBuilderWith` can read the target type through an
 * *indexed access* (`B[typeof __target]`) rather than a conditional type. Conditional
 * types stay deferred when applied to the polymorphic `this` type, which would make
 * `BuilderWith<this, "name">` unusable inside a builder method; an indexed access
 * resolves against `this`'s constraint and works.
 *
 * @internal
 */
export interface BuilderTargetMarker<T> {
	readonly [__target]?: T;
}

/**
 * Reads the target type out of a builder type by indexed access. Uses `& {}` (an
 * intersection, which resolves on `this`) rather than `NonNullable`'s conditional form.
 * @internal
 */
export type TargetOfMarker<B extends BuilderTargetMarker<object>> = B[typeof __target] & {};

/**
 * Unique symbol keying the phantom "removed required properties" marker.
 * @internal
 */
declare const __removed: unique symbol;

/**
 * Unique symbols branding the two members of {@link MissingRequiredProperties}.
 * @internal
 */
declare const __missingRequiredProperties: unique symbol;
declare const __unbuildable: unique symbol;

/**
 * Phantom marker added by `removeRequiredProperty(key)`, recording which required
 * properties were removed. A builder carrying it cannot use the compile-time-validated
 * build variants until it is rebuilt from a builder that still has the property.
 *
 * The removed keys are carried as object keys rather than as a union, so removing two
 * properties in a row (an intersection of two markers) keeps both keys instead of
 * collapsing to `never`.
 *
 * Never present at runtime - the property is declared optional and never assigned.
 *
 * @template K - The removed required property keys
 */
export interface RemovedRequiredProperties<K extends PropertyKey> {
	readonly [__removed]?: { readonly [P in K]: true };
}

/**
 * Satisfied only by builders that never removed a required property.
 * @internal
 */
export interface NoRemovedRequiredProperties {
	readonly [__removed]?: never;
}

/**
 * The required property keys removed from a builder via `removeRequiredProperty`.
 * @internal
 */
export type RemovedKeysOf<B> = [B] extends [{ readonly [__removed]?: infer R }] ? keyof (R & {}) : never;

/**
 * The `this` type a validated build variant (`build()`, `buildFrozen()`, ...) demands while
 * required properties are still missing. It surfaces in the compile error:
 *
 * ```text
 * The 'this' context of type 'UserBuilder & ...' is not assignable to method's 'this' of
 * type 'MissingRequiredProperties<"name" | "role">'.
 * ```
 *
 * To fix it, set the listed properties before building. If a property is listed because
 * `removeRequiredProperty` removed it, build from an earlier builder instead (builders are
 * immutable, so the one before the removal is unaffected), or use `buildUnsafe()` /
 * `buildPartial()` when the incomplete object is intended - for example in a negative test.
 *
 * Deliberately a union of two branded copies of the keys rather than an object type: no
 * builder can ever be assignable to it, and TypeScript then reports the error in a single
 * line. An object type adds a "Property ... is missing" line that repeats the whole builder
 * type, and a single branded key adds a "... is not assignable to type '"name"'" line; a union
 * target is not elaborated, so the second brand keeps it a union even for one key.
 *
 * @template K - The required property keys that are not set yet
 */
export type MissingRequiredProperties<K extends PropertyKey> =
	| (K & { readonly [__missingRequiredProperties]: never })
	| (K & { readonly [__unbuildable]: never });

/**
 * Keys whose `?` modifier is absent, i.e. the keys brand assignability demands.
 *
 * Differs from {@link RequiredKeys} for a required property whose type includes `undefined`
 * (`a: string | undefined`): `RequiredKeys` excludes it, while the build gate still demands it.
 * @internal
 */
export type DemandedKeys<T> = {
	// oxlint-disable-next-line typescript/no-empty-object-type -- `{}` is the probe for an optional key, not a value type
	[K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Helper type to extract optional keys from a type.
 * Returns keys where the property can be undefined.
 *
 * @template T - The type to extract optional keys from
 */
export type OptionalKeys<T> = {
	[K in keyof T]-?: undefined extends T[K] ? K : never;
}[keyof T];

/**
 * Helper type to extract required keys from a type.
 * The complement of {@link OptionalKeys}.
 *
 * @template T - The type to extract required keys from
 */
export type RequiredKeys<T> = {
	[K in keyof T]-?: undefined extends T[K] ? never : K;
}[keyof T];

/**
 * Resolves to A when X and Y are identical types (including modifiers), otherwise B.
 * The function-signature comparison is the only relation TypeScript checks invariantly,
 * which is what makes it able to see the `readonly` modifier that assignability ignores.
 * @internal
 */
type IfEquals<X, Y, A, B> = (<V>() => V extends X ? 1 : 2) extends <V>() => V extends Y ? 1 : 2 ? A : B;

/**
 * Helper type to extract the writable (non-`readonly`) keys of a type.
 *
 * A getter-only class accessor surfaces as a `readonly` property, so this is also the only
 * compile-time signal that a class member cannot be assigned at runtime.
 *
 * @template T - The type to extract writable keys from
 */
export type WritableKeys<T> = {
	[K in keyof T]-?: IfEquals<{ [Q in K]: T[K] }, { -readonly [Q in K]: T[K] }, K, never>;
}[keyof T];

/**
 * An exhaustive map of the required keys of T, used as an alternative to a hand-written
 * array of required-field paths.
 *
 * The array form (`["id", "name"]`) is checked for validity but not for completeness:
 * `build()` compile-gates on every required key of T, while runtime validation only checks
 * the paths you listed, so adding a required property to T silently leaves runtime
 * validation behind. This record form must name every required key, so the same change
 * becomes a compile error at the builder.
 *
 * Full derivation from T alone is impossible - types are erased before runtime, so the
 * key list has to exist as a value somewhere. This is the closest the compiler can enforce.
 *
 * @template T - The type being built
 *
 * @example
 * ```typescript
 * // Adding `email: string` to User makes this line fail to compile.
 * builder.setRequiredFields({ id: true, name: true });
 * ```
 */
export type RequiredFieldsRecord<T> = { [K in RequiredKeys<T>]: true };

/**
 * Converts a union type into an intersection of its members, by putting the union in
 * contravariant position (as a function parameter) and inferring a single parameter type
 * from the resulting union of function types - which collapses to an intersection.
 *
 * Used to build a branded type that matches what chaining single-key builder steps actually
 * produces (an intersection of single-key brands), rather than a brand computed from a
 * `Pick` over the whole key union - the two are structurally equivalent for concrete types,
 * but not when compared against an unresolved polymorphic `this`.
 *
 * @internal
 */
export type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void
	? I
	: never;

/**
 * Recursively makes all properties readonly for deep immutability.
 * Handles arrays, objects, and primitive types.
 *
 * @template T - The type to make deeply readonly
 */
export type DeepReadonly<T> = T extends (infer R)[]
	? DeepReadonlyArray<R>
	: T extends (...args: unknown[]) => unknown
		? T
		: T extends object
			? DeepReadonlyObject<T>
			: T;

/**
 * Helper type for deep readonly arrays
 * @internal
 */
interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

/**
 * Helper type for deep readonly objects
 * @internal
 */
type DeepReadonlyObject<T> = {
	readonly [P in keyof T]: DeepReadonly<T[P]>;
};
