/**
 * Unique symbol used internally to brand types and track which properties have been set in the builder's type.
 *
 * @internal
 */
declare const __brand: unique symbol;

/**
 * Type utility for branding builder types with information about which properties have been set.
 * This is used to enforce compile-time safety for required fields in the builder pattern.
 *
 * @template T - The type representing the set of properties that have been set
 * @internal
 */
export type CeriosBrand<T> = { [__brand]: T };

/**
 * Abstract base class for creating type-safe builders with automatic property setters and compile-time validation of required fields.
 *
 * This class is intended to be extended by concrete builder implementations for your own types.
 * It provides utility methods for setting properties and building the final object, ensuring that all required fields are set at compile time.
 *
 * Example usage:
 * ```typescript
 * interface MyType { foo: string; bar: number[]; }
 * class MyTypeBuilder extends CeriosBuilder<MyType> {
 *   setFoo(value: string) { return this.setProperty('foo', value); }
 *   addBar(value: number) { return this.addToArrayProperty('bar', value); }
 * }
 * // Usage:
 * const obj = new MyTypeBuilder({})
 *   .setFoo('hello')
 *   .addBar(42)
 *   .build();
 * ```
 *
 * @template T - The complete type being built
 */
export abstract class CeriosBuilder<T extends object> {
	/**
	 * Creates a new builder instance. Intended to be called by subclasses.
	 *
	 * @param _actual - The current partial state of the object being built
	 * @protected
	 */
	protected constructor(protected readonly _actual: Partial<T>) {}

	/**
	 * Sets a property value and returns a new builder instance with updated type state.
	 * This method is intended to be wrapped by concrete builder methods in subclasses.
	 *
	 * @template K - The property key being set
	 * @param key - The property key to set
	 * @param value - The value to assign to the property
	 * @returns A new builder instance with the property set and type state updated
	 * @protected
	 */
	protected setProperty<K extends keyof T>(key: K, value: T[K]): this & CeriosBrand<Pick<T, K>> {
		const BuilderClass = this.constructor as new (data: any) => any;
		return new BuilderClass({
			...this._actual,
			[key]: value,
		}) as this & CeriosBrand<Pick<T, K>>;
	}

	/**
	 * Sets multiple property values at once and returns a new builder instance with updated type state.
	 * @param props - An object with one or more properties to set.
	 * @returns A new builder instance with the properties set and type state updated.
	 * @protected
	 */
	protected setProperties<K extends keyof T>(props: Pick<T, K>): this & CeriosBrand<Pick<T, K>> {
		const BuilderClass = this.constructor as new (data: any) => any;
		return new BuilderClass({
			...this._actual,
			...props,
		}) as this & CeriosBrand<Pick<T, K>>;
	}

	/**
	 * Adds a value to an array property and returns a new builder instance with updated type state.
	 * This method is intended to be wrapped by concrete builder methods in subclasses for array properties.
	 *
	 * @template K - The property key (must be an array property)
	 * @template V - The type of the array element
	 * @param key - The array property key to add to
	 * @param value - The value to add to the array
	 * @returns A new builder instance with the array property updated and type state updated
	 * @protected
	 */
	protected addToArrayProperty<
		K extends { [P in keyof T]: NonNullable<T[P]> extends Array<any> ? P : never }[keyof T],
		V extends T[K] extends Array<infer U> ? U : T[K] extends Array<infer U> | undefined ? U : never,
	>(key: K, value: V): this & CeriosBrand<Pick<T, K>> {
		const BuilderClass = this.constructor as new (data: any) => any;
		const currentArray = (this._actual[key] as Array<V> | undefined) ?? [];
		return new BuilderClass({
			...this._actual,
			[key]: [...currentArray, value],
		}) as this & CeriosBrand<Pick<T, K>>;
	}

	/**
	 * Builds the final object. This method uses TypeScript's contextual typing to ensure
	 * all required fields are set before allowing build() to be called.
	 *
	 * The type constraint checks that all required properties are present.
	 *
	 * @returns The fully built object of type T
	 * @throws {TypeError} If called without all required fields set (compile-time error)
	 */
	build(this: this & CeriosBrand<T>): T {
		return this._actual as T;
	}

	/**
	 * Builds a partial object, which may not have all required fields set.
	 * This is useful for scenarios where you want to inspect or validate the current state before finalizing.
	 *
	 * @returns The partially built object
	 */
	buildPartial(): Partial<T> {
		return this._actual as Partial<T>;
	}
}
