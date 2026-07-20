import { describe, expect, it } from "vitest";

import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";
import { BuilderComposerFromFactory, BuilderWith } from "../../src/cerios-builder";

// The deep structure the deprecated builders addressed with setNestedProperty dot-paths.
// With auto builders, each level gets its own small builder and a director owns the recipe
// for assembling them - same end result, but every level is compile-time checked and
// reusable on its own. This file is the runnable version of the director example in
// README.md / MIGRATION.md.

type Address = {
	street: string;
	city: string;
	country: string;
	postalCode?: string;
};

type OrderDetails = {
	customerId: string;
	totalAmount: number;
	status: string;
	shippingAddress: Address;
	orderNumber?: string;
};

type OrderRequest = {
	order: { details?: OrderDetails };
};

class AddressBuilder extends CeriosAutoBuilder<Address>() {
	static create(): AddressBuilder {
		return new AddressBuilder({});
	}

	static createDomestic(): BuilderWith<AddressBuilder, "country"> {
		return AddressBuilder.create().country("USA");
	}
}

class OrderDetailsBuilder extends CeriosAutoBuilder<OrderDetails>() {
	static create(): OrderDetailsBuilder {
		return new OrderDetailsBuilder({});
	}

	static createPending(): BuilderWith<OrderDetailsBuilder, "status"> {
		return OrderDetailsBuilder.create().status("pending");
	}
}

class OrderRequestBuilder extends CeriosAutoBuilder<OrderRequest>() {
	static create(): OrderRequestBuilder {
		return new OrderRequestBuilder({});
	}
}

/**
 * The director: one place that knows how a complete OrderRequest is put together.
 * Each level is built by its own builder, so the compiler still proves every required
 * field of every level, and the child builders stay independently reusable.
 */
class OrderRequestDirector {
	static standardOrder(input: { customerId: string; totalAmount: number; street: string; city: string }): OrderRequest {
		const shippingAddress = AddressBuilder.createDomestic().street(input.street).city(input.city).build();

		const details = OrderDetailsBuilder.createPending()
			.customerId(input.customerId)
			.totalAmount(input.totalAmount)
			.shippingAddress(shippingAddress)
			.build();

		return OrderRequestBuilder.create().order({ details }).build();
	}

	// Callback variant: the caller customises the address without the director losing
	// control of the recipe. The composer type forces the callback to return a
	// fully-set address builder.
	static orderShippedTo(
		input: { customerId: string; totalAmount: number },
		composeAddress: BuilderComposerFromFactory<typeof AddressBuilder.createDomestic>,
	): OrderRequest {
		const shippingAddress = composeAddress(AddressBuilder.createDomestic()).build();

		const details = OrderDetailsBuilder.createPending()
			.customerId(input.customerId)
			.totalAmount(input.totalAmount)
			.shippingAddress(shippingAddress)
			.build();

		return OrderRequestBuilder.create().order({ details }).build();
	}
}

describe("Director pattern - composing nested objects from multiple auto builders", () => {
	it("assembles a deep structure without setNestedProperty", () => {
		const order = OrderRequestDirector.standardOrder({
			customerId: "CUST-001",
			totalAmount: 299.99,
			street: "123 Main St",
			city: "New York",
		});

		expect(order).toEqual({
			order: {
				details: {
					customerId: "CUST-001",
					totalAmount: 299.99,
					status: "pending",
					shippingAddress: { street: "123 Main St", city: "New York", country: "USA" },
				},
			},
		});
	});

	it("lets callers customise one level through a composer callback", () => {
		const order = OrderRequestDirector.orderShippedTo({ customerId: "CUST-002", totalAmount: 50 }, (address) =>
			address.street("456 Oak Ave").city("Boston").postalCode("02101"),
		);

		expect(order.order.details?.shippingAddress).toEqual({
			street: "456 Oak Ave",
			city: "Boston",
			country: "USA",
			postalCode: "02101",
		});
	});

	it("keeps compile-time checking at every level", () => {
		// @ts-expect-error - the callback must return a fully-set address builder (city missing)
		OrderRequestDirector.orderShippedTo({ customerId: "C", totalAmount: 1 }, (address) => address.street("x"));

		// @ts-expect-error - the child builder alone still gates build() until complete
		AddressBuilder.createDomestic().street("only street").build();

		expect(true).toBe(true);
	});
});
