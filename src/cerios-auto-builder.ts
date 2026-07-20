// oxlint-disable typescript/no-deprecated -- the runtime class extends the deprecated CeriosBuilder until its removal
import {
	BuilderInit,
	CommonAutoBuilderApi,
	SetterName,
	assertBuilderInit,
	autoSetterHandler,
	createBuilderCopy,
	toRequiredPaths,
} from "./auto-builder-core";
import {
	BuildGate,
	BuilderStep,
	CeriosBuilder,
	InternalBuilderBrand,
	Path,
	RequiredFieldsTemplate,
} from "./cerios-builder";
import { BuilderTargetMarker } from "./types";

/**
 * Automatic setter methods: one bare `<propertyName>` method per property of T.
 *
 * Property names that collide with a builder method (e.g. `build`) get a `Prop`
 * suffix (`buildProp`); the real method keeps its name. Keys that aren't valid
 * identifiers (e.g. `"content-type"`) are set with bracket access
 * (`builder["content-type"](value)`).
 *
 * Each setter returns a {@link BuilderStep} so the phantom-brand compile-time
 * tracking accumulates exactly like a hand-written setter.
 *
 * @template T - The type being built
 */
export type AutoSetters<T extends object> = {
	[K in keyof T & string as SetterName<K>]: <Self>(this: Self, value: T[K]) => BuilderStep<Self, T, K & keyof T>;
};

/**
 * The public API shared by every auto builder instance.
 *
 * Deliberately omits the protected `setProperty`/`setProperties`/`setNestedProperty`/
 * `addToArrayProperty` helpers: an auto builder sets a whole root property through its
 * generated setter, and anything finer-grained (nested values, appending to arrays)
 * belongs in a custom method or a director that composes multiple builders.
 *
 * @template T - The type being built
 */
export interface AutoBuilderApi<T extends object>
	extends BuilderTargetMarker<T>, CommonAutoBuilderApi<T, T, BuildGate<T>, Path<T>> {}

/**
 * The typed abstract constructor returned by {@link CeriosAutoBuilder}. Instances
 * expose {@link AutoBuilderApi} plus {@link AutoSetters}; the static `from` and
 * `requiredTemplate` are inherited from {@link CeriosBuilder}.
 *
 * @template T - The type being built
 */
export type AutoBuilderConstructor<T extends object> = (abstract new (
	data?: Partial<T>,
	init?: BuilderInit<T, Path<T>>,
) => AutoBuilderApi<T> & AutoSetters<T>) & {
	/**
	 * Creates a builder seeded from an existing object (deep-cloned).
	 * All properties count as set, so the builder is immediately buildable.
	 */
	from<R>(this: new (data?: Partial<T>) => R, instance: T): R & InternalBuilderBrand<T>;

	/**
	 * Optional static list of required field paths validated at runtime.
	 * @deprecated Prefer passing required fields via the constructor or `setRequiredFields()`.
	 */
	requiredTemplate?: ReadonlyArray<string>;
};

/**
 * Constraint for base-builder functions: any auto builder whose target extends TBase.
 *
 * A base-class expression cannot reference the class's own type parameter, so the
 * standard-builder pattern `class B<T extends Base> extends CeriosAutoBuilder<T>()` is
 * illegal. Instead, write shared logic once in a function constrained on this type and
 * apply it on top of each concrete auto builder. Inside the function, `this` carries
 * concrete setters for every base property, so shared methods can call them; the derived
 * builder still gets its full setter set (base and derived properties alike) from its own
 * `CeriosAutoBuilder<Derived>()` call.
 *
 * The view is deliberately narrow, for assignability from every derived builder:
 * - Setter values are `NonNullable`, so a derived type may strengthen an optional base
 *   property to required (the same convention a hand-written base builder uses). A shared
 *   method that sets such a strengthened property brands it as the *base* type's optional
 *   flavor, which does not count toward the derived build gate - set strengthened
 *   properties through the derived builder's own setter instead.
 * - Of the build/state API only the brand-free members whose types are covariant in TBase
 *   are visible: `buildPartial`, `buildUnsafe`, `buildWithoutCompileTimeValidation`, and
 *   `clone`/`addValidator` (in the same generic-`Self` shape the setters use, so they keep
 *   returning the concrete builder type). The validated build variants gate on a brand the
 *   base view cannot know, and members like `setRequiredFields` take types contravariant in
 *   TBase; either would reject every derived builder.
 *
 * @example
 * ```typescript
 * type BasePostRequest = { postId: string; tags?: string[] };
 * type CreatePostRequest = BasePostRequest & { authorId: string };
 *
 * function BasePostRequestBuilder<TBuilder extends AutoBuilderBase<BasePostRequest>>(Builder: TBuilder) {
 *   abstract class PostRequestBuilder extends Builder {
 *     addTag(tag: string) {
 *       return this.tags([...(this.buildPartial().tags ?? []), tag]);
 *     }
 *   }
 *   return PostRequestBuilder as BuilderExtension<TBuilder, PostRequestBuilder>;
 * }
 *
 * class CreatePostRequestBuilder extends BasePostRequestBuilder(CeriosAutoBuilder<CreatePostRequest>()) {
 *   static create() { return new CreatePostRequestBuilder(); }
 * }
 * ```
 *
 * @template TBase - The base type the shared logic is written against
 */
export type AutoBuilderBase<TBase extends object> = abstract new (
	// oxlint-disable-next-line typescript/no-explicit-any -- the canonical mixin constraint; `any[]` keeps every concrete auto-builder constructor assignable
	...args: any[]
) => {
	[K in keyof TBase & string as SetterName<K>]: <Self>(
		this: Self,
		value: NonNullable<TBase[K]>,
	) => BuilderStep<Self, TBase, K & keyof TBase>;
} & BuilderTargetMarker<TBase> &
	Pick<AutoBuilderApi<TBase>, "buildPartial" | "buildUnsafe" | "buildWithoutCompileTimeValidation"> & {
		/** Creates an independent copy of the builder with deep-cloned state. */
		clone<Self>(this: Self): Self;
		/** Adds a custom validator that runs during build. */
		addValidator<Self>(this: Self, validator: (obj: Partial<TBase>) => boolean | string): Self;
	};

/**
 * Concrete runtime backing class for {@link CeriosAutoBuilder}. Extends the real
 * builder so it inherits all build/validation/clone/from machinery, and returns a
 * Proxy from its constructor so bare-name property setters work.
 * @internal
 */
class AutoBuilderRuntime<T extends object> extends CeriosBuilder<T> {
	public constructor(
		data: Partial<T> = {},
		initOrRequiredFields?: BuilderInit<T, Path<T>> | RequiredFieldsTemplate<T>,
		validators?: Array<(obj: Partial<T>) => boolean | string>,
	) {
		// CeriosBuilder's copy-on-write re-creates instances as
		// `new this.constructor(data, requiredFields, validators)`, so an array in the second
		// position is that internal path; anything else is the user-facing `init` object.
		if (initOrRequiredFields !== undefined && !Array.isArray(initOrRequiredFields)) {
			const init = initOrRequiredFields as BuilderInit<T, Path<T>>;
			assertBuilderInit(init);
			const required =
				init.requiredFields === undefined
					? undefined
					: (toRequiredPaths(init.requiredFields) as RequiredFieldsTemplate<T>);
			super(data, required, init.validators);
		} else {
			super(data, initOrRequiredFields as RequiredFieldsTemplate<T> | undefined, validators);
		}
		// The assertion drives Proxy's generic inference to `this`; without it tsc infers
		// `object` from the handler and rejects the constructor return type (TS2409).
		// oxlint-disable-next-line typescript/no-unnecessary-type-assertion
		return new Proxy(this, autoSetterHandler as ProxyHandler<this>);
	}

	/**
	 * Copy-on-write must not go through the subclass constructor. Users write
	 * `constructor(data?) { super(data, { requiredFields: [...] }) }`, which discards the
	 * arguments the base class passes - so a later `setRequiredFields()` would be silently
	 * reverted to whatever the constructor hardcodes. {@link createBuilderCopy} sidesteps
	 * user constructors while still carrying the subclass's own fields across.
	 */
	protected override instantiateBuilder(
		data: Partial<T>,
		requiredFields: RequiredFieldsTemplate<T> | ReadonlySet<string>,
		validators: Array<(obj: Partial<T>) => boolean | string>,
	): this {
		return new Proxy(
			createBuilderCopy(this, {
				_actual: data,
				_requiredFields: new Set<string>(requiredFields as Iterable<string>),
				_validators: [...validators],
			}),
			autoSetterHandler,
		) as this;
	}
}

/**
 * Creates a base class with automatic bare-name setters for every property of T.
 * Extend the returned class; add ordinary methods for any custom logic (they use
 * the auto setters on `this`, and their return types can be left to inference).
 *
 * @example
 * ```typescript
 * interface User { id: string; name: string; role: string; age?: number; }
 *
 * class UserBuilder extends CeriosAutoBuilder<User>() {
 *   static create(): UserBuilder { return new UserBuilder({}); }
 *   asAdmin() { return this.role("admin"); } // inferred BuilderStep<this, User, "role">
 * }
 *
 * const user = UserBuilder.create().id("1").name("Alice").asAdmin().build();
 * // UserBuilder.create().id("1").build(); // compile error: name and role not set
 * ```
 *
 * Custom methods use a name of their own (`asAdmin`, `trimmedName`) and delegate to the
 * generated setter — a custom method cannot reuse a property's exact name, because the
 * method would shadow the setter it needs to call.
 *
 * @template T - The type to build
 * @returns An abstract base class to extend
 */
export function CeriosAutoBuilder<T extends object>(): AutoBuilderConstructor<T> {
	return AutoBuilderRuntime as unknown as AutoBuilderConstructor<T>;
}
