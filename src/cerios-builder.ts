/**
 * Unique symbol to track which properties have been set in the builder's type
 */
declare const __brand: unique symbol;

/**
 * Brand type to track set properties at the type level
 */
export type CeriosBrand<T> = { [__brand]: T };

/**
 * Base Builder class that provides type-safe building with automatic property setters
 * and compile-time validation of required fields.
 *
 * @template T - The complete type being built
 */
export abstract class CeriosBuilder<T extends object> {
	protected constructor(protected readonly _actual: Partial<T>) {}

	/**
	 * Sets a property value and returns a new builder instance with updated type state.
	 * This method tracks which properties have been set via the type system.
	 */
	protected setProperty<K extends keyof T>(key: K, value: T[K]): this & CeriosBrand<Pick<T, K>> {
		const BuilderClass = this.constructor as new (data: any) => any;
		return new BuilderClass({
			...this._actual,
			[key]: value,
		}) as this & CeriosBrand<Pick<T, K>>;
	}

	/**
	 * Builds the final object. This method uses TypeScript's contextual typing to ensure
	 * all required fields are set before allowing build() to be called.
	 *
	 * The type constraint checks that all required properties are present.
	 */
	build(this: this & CeriosBrand<T>): T {
		return this._actual as T;
	}

	buildPartial(): Partial<T> {
		return this._actual as Partial<T>;
	}
}
