import { CeriosBrand, CeriosBuilder } from "../src/cerios-builder";

type Address = {
	street: string;
	city: string;
	country: string;
	zipCode?: string;
};

type Customer = {
	id: string;
	name: string;
	address: Address;
	phoneNumber?: string;
	addressHistory?: Address[];
};

class AddressBuilder extends CeriosBuilder<Address> {
	static create() {
		return new AddressBuilder({});
	}

	static createWithDefaults() {
		return this.create().city("Othertown").country("United States");
	}

	street(value: string) {
		return this.setProperty("street", value);
	}

	city(value: string) {
		return this.setProperty("city", value);
	}

	country(value: string) {
		return this.setProperty("country", value);
	}

	zipCode(value: string) {
		return this.setProperty("zipCode", value);
	}

	// Preset addresses
	asUSAddress() {
		return this.country("United States");
	}
}

class CustomerBuilder extends CeriosBuilder<Customer> {
	static create() {
		return new CustomerBuilder({});
	}

	id(value: string) {
		return this.setProperty("id", value);
	}

	name(value: string) {
		return this.setProperty("name", value);
	}

	address(value: Address) {
		return this.setProperty("address", value);
	}

	phoneNumber(value: string) {
		return this.setProperty("phoneNumber", value);
	}

	// Build address inline
	withAddress(builderFn: (builder: AddressBuilder) => AddressBuilder & CeriosBrand<Address>) {
		const address = builderFn(AddressBuilder.create()).build();
		return this.setProperty("address", address);
	}

	withAddressDefaults(
		builderFn: (
			builder: AddressBuilder & CeriosBrand<Pick<Address, "city" | "country">>
		) => AddressBuilder & CeriosBrand<Address>
	) {
		const address = builderFn(AddressBuilder.createWithDefaults()).build();
		return this.setProperty("address", address);
	}

	addAddressHistory(builderFn: (builder: AddressBuilder) => AddressBuilder & CeriosBrand<Address>) {
		const address = builderFn(AddressBuilder.create()).build();
		const currentHistory = this._actual.addressHistory || [];
		return this.setProperty("addressHistory", [...currentHistory, address]);
	}
}

describe("Cerios Builder Nested", () => {
	test("should build customer with all fields", () => {
		const customer = CustomerBuilder.create()
			.id("123")
			.name("John Doe")
			.withAddress(address => address.street("123 Main St").city("Anytown").country("USA").zipCode("12345"))
			.phoneNumber("555-1234")
			.build();

		expect(customer).toEqual({
			id: "123",
			name: "John Doe",
			address: {
				street: "123 Main St",
				city: "Anytown",
				country: "USA",
				zipCode: "12345",
			},
			phoneNumber: "555-1234",
		});
	});

	test("should build customer with default address", () => {
		const customer = CustomerBuilder.create()
			.id("456")
			.name("Jane Smith")
			.withAddressDefaults(address => address.street("456 Elm St"))
			.build();

		expect(customer).toEqual({
			id: "456",
			name: "Jane Smith",
			address: {
				street: "456 Elm St",
				city: "Othertown",
				country: "United States",
			},
		});
	});

	test("should build customer with address history", () => {
		const customer = CustomerBuilder.create()
			.id("789")
			.name("Alice Johnson")
			.withAddress(address => address.street("789 Oak St").city("Oldtown").country("USA"))
			.addAddressHistory(address => address.street("101 Pine St").city("Newtown").country("USA"))
			.addAddressHistory(address => address.street("202 Maple St").city("Sometown").country("USA"))
			.build();

		expect(customer).toEqual({
			id: "789",
			name: "Alice Johnson",
			address: {
				street: "789 Oak St",
				city: "Oldtown",
				country: "USA",
			},
			addressHistory: [
				{
					street: "101 Pine St",
					city: "Newtown",
					country: "USA",
				},
				{
					street: "202 Maple St",
					city: "Sometown",
					country: "USA",
				},
			],
		});
	});
});
