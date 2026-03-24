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
 * Helper type to extract optional keys from a type.
 * Returns keys where the property can be undefined.
 *
 * @template T - The type to extract optional keys from
 */
export type OptionalKeys<T> = {
	[K in keyof T]-?: undefined extends T[K] ? K : never;
}[keyof T];

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
