import { CeriosBuilder } from "../src/cerios-builder";

type Address = {
	Street: string;
	City: string;
	PostalCode?: string;
	Country: string;
};

type OrderItem = {
	ProductId: string;
	Quantity: number;
	Price: number;
	Discount?: number;
};

type OrderItems = {
	Items: OrderItem[];
};

type OrderDetails = {
	OrderNumber?: string;
	CustomerId: string;
	Status: string;
	TotalAmount: number;
	Notes?: string;
	ShippingAddress: Address;
};

type Order = {
	Details: OrderDetails;
	Items?: OrderItems;
};

type OrderRequest = {
	Order: Order;
};

class OrderRequestBuilder extends CeriosBuilder<OrderRequest> {
	static create() {
		return new OrderRequestBuilder({}, [
			"Order.Details.CustomerId",
			"Order.Details.Status",
			"Order.Details.TotalAmount",
			"Order.Details.ShippingAddress.Street",
			"Order.Details.ShippingAddress.City",
			"Order.Details.ShippingAddress.Country",
		]);
	}

	static createWithDefaults() {
		return this.create().status("pending").notes("Standard order");
	}

	orderNumber(value: string) {
		return this.setNestedProperty("Order.Details.OrderNumber", value);
	}

	customerId(value: string) {
		return this.setNestedProperty("Order.Details.CustomerId", value);
	}

	status(value: string) {
		return this.setNestedProperty("Order.Details.Status", value);
	}

	totalAmount(value: number) {
		return this.setNestedProperty("Order.Details.TotalAmount", value);
	}

	notes(value: string) {
		return this.setNestedProperty("Order.Details.Notes", value);
	}

	shippingStreet(value: string) {
		return this.setNestedProperty("Order.Details.ShippingAddress.Street", value);
	}

	shippingCity(value: string) {
		return this.setNestedProperty("Order.Details.ShippingAddress.City", value);
	}

	shippingPostalCode(value: string) {
		return this.setNestedProperty("Order.Details.ShippingAddress.PostalCode", value);
	}

	shippingCountry(value: string) {
		return this.setNestedProperty("Order.Details.ShippingAddress.Country", value);
	}

	items(value: OrderItems) {
		return this.setNestedProperty("Order.Items", value);
	}
}

test("should build order with deeply nested properties", () => {
	const order = OrderRequestBuilder.createWithDefaults()
		.customerId("CUST-001")
		.totalAmount(299.99)
		.orderNumber("ORD-12345")
		.shippingStreet("123 Main St")
		.shippingCity("New York")
		.shippingCountry("USA")
		.shippingPostalCode("10001")
		.build();

	expect(order).toEqual({
		Order: {
			Details: {
				OrderNumber: "ORD-12345",
				CustomerId: "CUST-001",
				Status: "pending",
				TotalAmount: 299.99,
				Notes: "Standard order",
				ShippingAddress: {
					Street: "123 Main St",
					City: "New York",
					PostalCode: "10001",
					Country: "USA",
				},
			},
		},
	});
});

test("should build with runtime validation when all required fields are set", () => {
	const order = OrderRequestBuilder.createWithDefaults()
		.customerId("CUST-001")
		.totalAmount(299.99)
		.shippingStreet("123 Main St")
		.shippingCity("New York")
		.shippingCountry("USA")
		.buildSafe();

	expect(order.Order.Details.CustomerId).toBe("CUST-001");
	expect(order.Order.Details.TotalAmount).toBe(299.99);
	expect(order.Order.Details.Status).toBe("pending");
	expect(order.Order.Details.ShippingAddress.Street).toBe("123 Main St");
});

test("should throw error when required fields are missing with buildSafe", () => {
	expect(() => {
		OrderRequestBuilder.createWithDefaults().buildSafe();
	}).toThrow(
		"Missing required fields: Order.Details.CustomerId, Order.Details.TotalAmount, Order.Details.ShippingAddress.Street, Order.Details.ShippingAddress.City, Order.Details.ShippingAddress.Country"
	);
});

test("should throw error when some required fields are missing", () => {
	expect(() => {
		OrderRequestBuilder.createWithDefaults().customerId("CUST-001").totalAmount(100).buildSafe();
	}).toThrow(
		"Missing required fields: Order.Details.ShippingAddress.Street, Order.Details.ShippingAddress.City, Order.Details.ShippingAddress.Country"
	);
});

test("should allow setting required fields dynamically via setRequiredFields", () => {
	const builder = OrderRequestBuilder.create()
		.setRequiredFields([
			"Order.Details.OrderNumber", // Adding OrderNumber as an additional required field
		])
		// Set the static template fields
		.customerId("CUST-001")
		.status("pending")
		.totalAmount(100)
		.shippingStreet("123 Main St")
		.shippingCity("New York")
		.shippingCountry("USA")
		// And the dynamically added field
		.orderNumber("ORD-001");

	expect(() => builder.buildSafe()).not.toThrow();

	const builderMissing = OrderRequestBuilder.create()
		.setRequiredFields(["Order.Details.OrderNumber"])
		.customerId("CUST-001")
		.status("pending")
		.totalAmount(100)
		.shippingStreet("123 Main St")
		.shippingCity("New York")
		.shippingCountry("USA");
	// Missing OrderNumber

	expect(() => builderMissing.buildSafe()).toThrow("Missing required fields: Order.Details.OrderNumber");
});

test("should combine static template and dynamic required fields", () => {
	const builder = OrderRequestBuilder.create()
		.setRequiredFields(["Order.Details.OrderNumber"])
		.customerId("CUST-001")
		.status("pending")
		.totalAmount(100)
		.shippingStreet("123 Main St")
		.shippingCity("New York")
		.shippingCountry("USA");

	expect(() => builder.buildSafe()).toThrow("Missing required fields: Order.Details.OrderNumber");

	const builderComplete = builder.orderNumber("ORD-001");
	expect(() => builderComplete.buildSafe()).not.toThrow();
});
