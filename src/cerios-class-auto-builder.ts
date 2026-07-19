// oxlint-disable typescript/no-deprecated -- the runtime class extends the deprecated CeriosClassBuilder until its removal
import {
	BuilderInit,
	CommonAutoBuilderApi,
	SetterName,
	assertBuilderInit,
	autoSetterHandler,
	createBuilderCopy,
	deepClone,
	toRequiredPaths,
} from "./auto-builder-core";
import {
	CeriosClassBuilder,
	ClassBuildGate,
	ClassBuilderStep,
	ClassConstructor,
	ClassPath,
	DataPropertiesOnly,
	InternalClassBrand,
} from "./cerios-class-builder";
import { BuilderTargetMarker } from "./types";

/**
 * Automatic setter methods for class data properties: one bare `<propertyName>`
 * method per data property of T (methods are excluded automatically).
 *
 * Property names that collide with a builder method (e.g. `build`) get a `Prop`
 * suffix; keys that aren't valid identifiers are set with bracket access.
 * Each setter returns a {@link ClassBuilderStep} so brand tracking accumulates.
 *
 * @template T - The class type being built
 */
export type ClassAutoSetters<T extends object> = {
	[K in keyof DataPropertiesOnly<T> & string as SetterName<K>]: <Self>(
		this: Self,
		value: DataPropertiesOnly<T>[K],
	) => ClassBuilderStep<Self, T, K & keyof T>;
};

/**
 * The public API shared by every class auto builder instance.
 *
 * Deliberately omits the protected `setProperty`/`setProperties`/`setNestedProperty`/
 * `addToArrayProperty` helpers: an auto builder sets a whole root data property through
 * its generated setter, and anything finer-grained (nested values, appending to arrays)
 * belongs in a custom method or a director that composes multiple builders.
 *
 * @template T - The class type being built
 */
export interface ClassAutoBuilderApi<T extends object>
	extends
		BuilderTargetMarker<T>,
		CommonAutoBuilderApi<T, DataPropertiesOnly<T> & object, ClassBuildGate<T>, ClassPath<T>> {}

/**
 * The typed abstract constructor returned by {@link CeriosClassAutoBuilder}.
 *
 * @template T - The class type being built
 */
export type ClassAutoBuilderConstructor<T extends object> = (abstract new (
	data?: Partial<DataPropertiesOnly<T>>,
	init?: BuilderInit<T, ClassPath<T>, DataPropertiesOnly<T>>,
) => ClassAutoBuilderApi<T> & ClassAutoSetters<T>) & {
	/**
	 * Creates a builder seeded from an existing instance (deep-cloned).
	 * All data properties count as set, so the builder is immediately buildable.
	 */
	from<R>(
		this: abstract new (data?: Partial<DataPropertiesOnly<T>>) => R,
		instance: T,
	): R & InternalClassBrand<DataPropertiesOnly<T>>;
};

/**
 * Constraint for base-builder functions: any class auto builder whose target class
 * extends TBase.
 *
 * A base-class expression cannot reference the class's own type parameter, so a builder
 * generic over every subclass of TBase cannot be written directly. Instead, write shared
 * logic once in a function constrained on this type and apply it on top of each concrete
 * class auto builder. Inside the function, `this` carries concrete setters for every
 * inherited data property, so shared methods can call them; the derived builder still
 * gets its full setter set from its own `CeriosClassAutoBuilder(Derived)` call.
 *
 * TBase is used purely as a type and may be an abstract class - only the concrete derived
 * classes are ever passed to {@link CeriosClassAutoBuilder}.
 *
 * The view is deliberately narrow, for assignability from every derived builder:
 * - Setter values are `NonNullable`, so a derived class may strengthen an optional base
 *   property to required. A shared method that sets such a strengthened property brands
 *   it as the *base* class's optional flavor, which does not count toward the derived
 *   build gate - set strengthened properties through the derived builder's own setter.
 * - Of the build/state API only `buildPartial` is visible; the other members either gate
 *   on a brand or return `this`, both of which make the full {@link ClassAutoBuilderApi}
 *   contravariant and would reject every derived builder.
 *
 * @example
 * ```typescript
 * abstract class BaseEntity { id!: string; }
 * class Order extends BaseEntity { total!: number; }
 *
 * function BaseEntityBuilder<TBuilder extends ClassAutoBuilderBase<BaseEntity>>(Builder: TBuilder) {
 *   abstract class EntityBuilder extends Builder {
 *     newId() { return this.id(crypto.randomUUID()); }
 *   }
 *   return EntityBuilder as BuilderExtension<TBuilder, EntityBuilder>;
 * }
 *
 * class OrderBuilder extends BaseEntityBuilder(CeriosClassAutoBuilder(Order)) {
 *   static create() { return new OrderBuilder(); }
 * }
 * ```
 *
 * @template TBase - The base class the shared logic is written against
 */
export type ClassAutoBuilderBase<TBase extends object> = abstract new (
	// oxlint-disable-next-line typescript/no-explicit-any -- the canonical mixin constraint; `any[]` keeps every concrete auto-builder constructor assignable
	...args: any[]
) => {
	[K in keyof DataPropertiesOnly<TBase> & string as SetterName<K>]: <Self>(
		this: Self,
		value: NonNullable<DataPropertiesOnly<TBase>[K]>,
	) => ClassBuilderStep<Self, TBase, K & keyof TBase>;
} & BuilderTargetMarker<TBase> &
	Pick<ClassAutoBuilderApi<TBase>, "buildPartial">;

/**
 * One runtime class per target class, rather than per factory call.
 *
 * Without this, `CeriosClassAutoBuilder(Person) === CeriosClassAutoBuilder(Person)` is
 * false, so `instanceof` silently fails whenever the factory is called twice for the same
 * class, and every call adds a distinct object shape for the engine to track. Caching is
 * only sound because the runtime class captures nothing per call beyond the cache key:
 * `instantiateBuilder` reads `this.getClassConstructor()` rather than the closure.
 *
 * @internal
 */
const RUNTIME_CACHE = new WeakMap<object, ClassAutoBuilderConstructor<object>>();

/**
 * Creates a base class with automatic bare-name setters for every data property
 * of the class T. Building instantiates the real class, so methods, getters, and
 * decorators are preserved. Extend the returned class and add ordinary methods
 * for any custom logic.
 *
 * @example
 * ```typescript
 * class Person {
 *   name!: string;
 *   age!: number;
 *   constructor(data?: Partial<Person>) { if (data) Object.assign(this, data); }
 *   greet(): string { return `Hi, ${this.name}`; }
 * }
 *
 * class PersonBuilder extends CeriosClassAutoBuilder(Person) {
 *   static create(): PersonBuilder { return new PersonBuilder(); }
 * }
 *
 * const person = PersonBuilder.create().name("Alice").age(30).build();
 * person.greet(); // "Hi, Alice"
 * ```
 *
 * Custom methods use a name of their own (`asAdult`, `trimmedName`) and delegate to the
 * generated setter — a custom method cannot reuse a data property's exact name, because
 * the method would shadow the setter it needs to call.
 *
 * @param classConstructor - The class constructor to instantiate on build
 * @template T - The class type to build
 * @returns An abstract base class to extend
 */
export function CeriosClassAutoBuilder<T extends object>(
	classConstructor: ClassConstructor<T>,
): ClassAutoBuilderConstructor<T> {
	const cached = RUNTIME_CACHE.get(classConstructor);
	if (cached) {
		return cached as ClassAutoBuilderConstructor<T>;
	}

	class ClassAutoBuilderRuntime extends CeriosClassBuilder<T> {
		public constructor(
			dataOrConstructor?: Partial<T> | ClassConstructor<T>,
			initOrData?: BuilderInit<T, ClassPath<T>, DataPropertiesOnly<T>> | Partial<T>,
			validators?: Array<(obj: Partial<T>) => boolean | string>,
			requiredFields?: ReadonlyArray<ClassPath<T>> | Set<string>,
		) {
			// The base builder's copy-on-write re-creates instances as
			// `new this.constructor(classConstructor, data, validators, requiredFields)`,
			// so a function first argument is that internal path; anything else is user data.
			if (typeof dataOrConstructor === "function") {
				super(dataOrConstructor, initOrData as Partial<T>, validators, requiredFields);
			} else {
				// User-facing shape is (data, init). Required fields and validators are read
				// by name, so the opposite positional orders of the two base constructors
				// stay an implementation detail rather than a trap.
				const init = (initOrData ?? {}) as BuilderInit<T, ClassPath<T>, DataPropertiesOnly<T>>;
				assertBuilderInit(init);
				const required = init.requiredFields === undefined ? undefined : new Set(toRequiredPaths(init.requiredFields));
				super(classConstructor, dataOrConstructor ?? {}, init.validators, required);
			}
			// The assertion drives Proxy's generic inference to `this`; without it tsc infers
			// `object` from the handler and rejects the constructor return type (TS2409).
			// oxlint-disable-next-line typescript/no-unnecessary-type-assertion
			return new Proxy(this, autoSetterHandler as ProxyHandler<this>);
		}

		/**
		 * Copy-on-write must not go through the subclass constructor. Users write
		 * `constructor(data?) { super(data, { requiredFields: [...] }) }`, which cannot
		 * receive the base class's internal 4-argument shape - forwarding it would land the
		 * class constructor in the data slot and drop the validators and required fields.
		 * {@link createBuilderCopy} sidesteps user constructors while still carrying the
		 * subclass's own fields across.
		 */
		protected override instantiateBuilder(
			data: Partial<T>,
			validators: Array<(obj: Partial<T>) => boolean | string>,
			requiredFields: ReadonlyArray<ClassPath<T>> | Set<string>,
		): this {
			return new Proxy(
				createBuilderCopy(this, {
					// Read from the instance, not the captured `classConstructor`, so the
					// runtime class holds no per-factory-call state and can be memoised.
					_classConstructor: this.getClassConstructor(),
					_actual: data,
					_validators: [...validators],
					_requiredFields: new Set<string>(requiredFields as Iterable<string>),
				}),
				autoSetterHandler,
			) as this;
		}
	}

	const Runtime = ClassAutoBuilderRuntime as unknown as {
		from: <R>(instance: T) => R;
	} & (new (data?: Partial<T>) => unknown);

	Runtime.from = function <R>(this: new (data?: Partial<T>) => R, instance: T): R {
		return new this(deepClone(instance));
	};

	RUNTIME_CACHE.set(classConstructor, ClassAutoBuilderRuntime as unknown as ClassAutoBuilderConstructor<object>);

	return ClassAutoBuilderRuntime as unknown as ClassAutoBuilderConstructor<T>;
}
