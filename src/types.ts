/**
 * Helper type to extract the builder type from a builder instance.
 * This is useful when you want to accept a builder with some fields already set
 * without manually specifying which fields are set.
 *
 * @template B - A builder instance type
 *
 * @example
 * ```typescript
 * // Instead of:
 * function withAddress(
 *   builder: AddressBuilder & CeriosBrand<Pick<Address, "city" | "country">>
 * ) { ... }
 *
 * // You can write:
 * function withAddress(builder: BuilderType<ReturnType<typeof AddressBuilder.createWithDefaults>>) { ... }
 * ```
 */
export type BuilderType<B> = B;

/**
 * Recursively makes all properties readonly for deep immutability.
 * Handles arrays, objects, and primitive types.
 *
 * @template T - The type to make deeply readonly
 */
export type DeepReadonly<T> = T extends (infer R)[]
	? DeepReadonlyArray<R>
	: T extends (...args: any[]) => any
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
