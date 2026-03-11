import { describe, expect, it } from "vitest";

import { BuilderComposerFromFactory, BuilderPreset, BuilderStep, CeriosBuilder } from "../../src/cerios-builder";

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
	static create(): AddressBuilder {
		return new AddressBuilder({});
	}

	static createWithDefaults(): BuilderPreset<AddressBuilder, Address, "city" | "country"> {
		return this.create().city("Othertown").country("United States");
	}

	street(value: string): BuilderStep<this, Address, "street"> {
		return this.setProperty("street", value);
	}

	city(value: string): BuilderStep<this, Address, "city"> {
		return this.setProperty("city", value);
	}

	country(value: string): BuilderStep<this, Address, "country"> {
		return this.setProperty("country", value);
	}

	zipCode(value: string): BuilderStep<this, Address, "zipCode"> {
		return this.setProperty("zipCode", value);
	}

	// Preset addresses
	asUSAddress(): BuilderStep<this, Address, "country"> {
		return this.country("United States");
	}
}

class CustomerBuilder extends CeriosBuilder<Customer> {
	static create(): CustomerBuilder {
		return new CustomerBuilder({});
	}

	id(value: string): BuilderStep<this, Customer, "id"> {
		return this.setProperty("id", value);
	}

	name(value: string): BuilderStep<this, Customer, "name"> {
		return this.setProperty("name", value);
	}

	address(value: Address): BuilderStep<this, Customer, "address"> {
		return this.setProperty("address", value);
	}

	phoneNumber(value: string): BuilderStep<this, Customer, "phoneNumber"> {
		return this.setProperty("phoneNumber", value);
	}

	// Build address inline
	withAddress(
		builderFn: BuilderComposerFromFactory<typeof AddressBuilder.create>,
	): BuilderStep<this, Customer, "address"> {
		const address = builderFn(AddressBuilder.create()).build();
		return this.setProperty("address", address);
	}

	withAddressDefaults(
		builderFn: BuilderComposerFromFactory<typeof AddressBuilder.createWithDefaults>,
	): BuilderStep<this, Customer, "address"> {
		const address = builderFn(AddressBuilder.createWithDefaults()).build();
		return this.setProperty("address", address);
	}

	addAddressHistory(
		builderFn: BuilderComposerFromFactory<typeof AddressBuilder.create>,
	): BuilderStep<this, Customer, "addressHistory"> {
		const address = builderFn(AddressBuilder.create()).build();
		const currentHistory = this._actual.addressHistory ?? [];
		return this.setProperty("addressHistory", [...currentHistory, address]);
	}
}

describe("Cerios Builder Nested", () => {
	it("should build customer with all fields", () => {
		const customer = CustomerBuilder.create()
			.id("123")
			.name("John Doe")
			.withAddress((address) => address.street("123 Main St").city("Anytown").country("USA").zipCode("12345"))
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

	it("should build customer with default address", () => {
		const customer = CustomerBuilder.create()
			.id("456")
			.name("Jane Smith")
			.withAddressDefaults((address) => address.street("456 Elm St"))
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

	it("should build customer with address history", () => {
		const customer = CustomerBuilder.create()
			.id("789")
			.name("Alice Johnson")
			.withAddress((address) => address.street("789 Oak St").city("Oldtown").country("USA"))
			.addAddressHistory((address) => address.street("101 Pine St").city("Newtown").country("USA"))
			.addAddressHistory((address) => address.street("202 Maple St").city("Sometown").country("USA"))
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
