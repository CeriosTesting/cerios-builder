import { describe, expect, expectTypeOf, it } from "vitest";

import { BuilderExtension } from "../../src/auto-builder-core";
import { CeriosClassAutoBuilder, ClassAutoBuilderBase } from "../../src/cerios-class-auto-builder";
import { ClassBuilderWith } from "../../src/cerios-class-builder";

abstract class BaseEntity {
	id!: string;
	createdAt?: Date;

	describe(): string {
		return `${this.constructor.name}#${this.id}`;
	}
}

// Derived class whose own constructor assigns the data it receives.
class Order extends BaseEntity {
	total!: number;
	reference?: string;

	constructor(data?: Partial<Order>) {
		super();
		if (data) {
			Object.assign(this, data);
		}
	}

	summaryText(): string {
		return `${this.describe()}: ${this.total}`;
	}
}

// Derived class without any constructor: building must fall back to assigning the data
// after instantiation.
class Customer extends BaseEntity {
	name!: string;
}

/**
 * Shared builder logic for every entity builder, written once against the abstract base
 * class. BaseEntity is used purely as a type here; only the concrete derived classes are
 * ever passed to CeriosClassAutoBuilder.
 */
// oxlint-disable-next-line typescript/explicit-function-return-type -- the return type names the class declared inside; BuilderExtension is applied in the return statement
function BaseEntityBuilder<TBuilder extends ClassAutoBuilderBase<BaseEntity>>(Builder: TBuilder) {
	abstract class EntityBuilder extends Builder {
		sequentialId(sequence: number): ClassBuilderWith<this, "id"> {
			return this.id(`entity-${sequence}`);
		}

		createdOn(year: number): ClassBuilderWith<this, "createdAt"> {
			return this.createdAt(new Date(Date.UTC(year, 0, 1)));
		}
	}
	return EntityBuilder as BuilderExtension<TBuilder, EntityBuilder>;
}

class OrderBuilder extends BaseEntityBuilder(CeriosClassAutoBuilder(Order)) {
	static create(): OrderBuilder {
		return new OrderBuilder({}, { requiredFields: ["id", "total"] });
	}
}

class CustomerBuilder extends BaseEntityBuilder(CeriosClassAutoBuilder(Customer)) {
	static create(): CustomerBuilder {
		return new CustomerBuilder({}, { requiredFields: ["id", "name"] });
	}
}

describe("CeriosClassAutoBuilder - base class extension", () => {
	it("generates setters for inherited data properties", () => {
		const order = OrderBuilder.create()
			.id("order-1")
			.createdAt(new Date(Date.UTC(2026, 5, 1)))
			.total(99)
			.build();

		expect(order.id).toBe("order-1");
		expect(order.createdAt).toEqual(new Date(Date.UTC(2026, 5, 1)));
		expect(order.total).toBe(99);
	});

	it("builds a real instance of the derived class with the base prototype chain intact", () => {
		const order = OrderBuilder.create().id("order-2").total(150).reference("ref-1").build();

		expect(order).toBeInstanceOf(Order);
		expect(order).toBeInstanceOf(BaseEntity);
		expect(order.describe()).toBe("Order#order-2");
		expect(order.summaryText()).toBe("Order#order-2: 150");
	});

	it("assigns inherited properties even when no constructor accepts the data", () => {
		// Customer declares no constructor, so the builder's post-construction assignment
		// must carry both the inherited and the own data properties onto the instance.
		const customer = CustomerBuilder.create().id("customer-1").name("Ada").build();

		expect(customer).toBeInstanceOf(Customer);
		expect(customer).toBeInstanceOf(BaseEntity);
		expect(customer.id).toBe("customer-1");
		expect(customer.name).toBe("Ada");
		expect(customer.describe()).toBe("Customer#customer-1");
	});

	it("shares custom methods across sibling builders of the same base class", () => {
		const order = OrderBuilder.create().sequentialId(1).createdOn(2026).total(10).build();
		const customer = CustomerBuilder.create().sequentialId(2).name("Grace").build();

		expect(order.id).toBe("entity-1");
		expect(order.createdAt).toEqual(new Date(Date.UTC(2026, 0, 1)));
		expect(customer.id).toBe("entity-2");
	});

	it("counts a shared method's setter brand toward the derived build gate", () => {
		// sequentialId() brands the inherited required id via the base class; the derived
		// gate must accept it just like a direct .id() call.
		const order = OrderBuilder.create().sequentialId(3).total(25).build();

		expectTypeOf(order).toEqualTypeOf<Order>();
		expect(order.id).toBe("entity-3");
	});

	it("gates build() per derived class at compile time", () => {
		expect(() => {
			// @ts-expect-error - total (derived-only, required) not set
			return OrderBuilder.create().id("order-3").build();
		}).toThrow("Missing required fields: total");
		expect(() => {
			// @ts-expect-error - id (inherited, required) not set
			return OrderBuilder.create().total(10).build();
		}).toThrow("Missing required fields: id");
		expect(() => {
			// @ts-expect-error - name (derived-only, required) not set
			return CustomerBuilder.create().id("customer-2").build();
		}).toThrow("Missing required fields: name");
	});

	it("validates required fields per derived builder independently at runtime", () => {
		expect(() => OrderBuilder.create().id("order-4").buildWithoutCompileTimeValidation()).toThrow(
			"Missing required fields: total",
		);
		expect(() => CustomerBuilder.create().name("Edsger").buildWithoutCompileTimeValidation()).toThrow(
			"Missing required fields: id",
		);
	});

	it("clone preserves the concrete builder including shared methods", () => {
		const cloned = OrderBuilder.create().sequentialId(4).total(40).clone().createdOn(2025).total(45);

		const order = cloned.build();
		expect(order).toBeInstanceOf(Order);
		expect(order.id).toBe("entity-4");
		expect(order.total).toBe(45);
		expect(order.createdAt).toEqual(new Date(Date.UTC(2025, 0, 1)));
	});

	it("keeps the static from() available through the base-builder function", () => {
		const existing = new Order({ id: "order-5", total: 75, reference: "ref-2" });

		const order = OrderBuilder.from(existing).reference("ref-3").build();

		expect(order).toBeInstanceOf(Order);
		expect(order.reference).toBe("ref-3");
		// The seed was deep-cloned, not aliased.
		expect(existing.reference).toBe("ref-2");
	});

	it("keeps instanceof stable when another builder hierarchy targets the same class", () => {
		class DirectOrderBuilder extends CeriosClassAutoBuilder(Order) {
			static create(): DirectOrderBuilder {
				return new DirectOrderBuilder();
			}
		}

		const viaBase = OrderBuilder.create().sequentialId(5).total(5).build();
		const direct = DirectOrderBuilder.create().id("order-6").total(6).buildUnsafe();

		expect(viaBase).toBeInstanceOf(Order);
		expect(direct).toBeInstanceOf(Order);
	});
});
