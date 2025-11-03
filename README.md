# @cerios/cerios-builder

A powerful TypeScript builder pattern library that provides **compile-time type safety** for object construction. Build complex objects with method chaining while ensuring all required properties are set at compile time.

## 🚀 Features

- **Type-Safe Building**: Compile-time validation ensures all required properties are set
- **Nested Properties Support**: Build deeply nested objects with dot-notation paths
- **Runtime Validation**: Optional runtime validation with `buildSafe()` and required field templates
- **Dynamic Required Fields**: Add required fields at runtime based on your business logic
- **Method Chaining**: Fluent API for readable object construction
- **Partial Building**: Build incomplete objects when needed
- **Zero Runtime Overhead**: All type checking happens at compile time (unless using `buildSafe()`)
- **Extensible**: Easy to create custom builder methods
- **TypeScript First**: Built with TypeScript, for TypeScript
- **Array Property Helpers**: Easily add values to array properties with type safety

## 📦 Installation

```bash
npm install @cerios/cerios-builder
```

dev install
```bash
npm install --save-dev @cerios/cerios-builder
```

## 🎯 Quick Start

```typescript
import { CeriosBuilder, RequiredFieldsTemplate } from '@cerios/cerios-builder';

// 1. Define your types
type User = {
    id: string;
    name: string;
    email: string;
    age?: number;
};

// 2. Create your builder
class UserBuilder extends CeriosBuilder<User> {
    static create() {
        return new UserBuilder({});
    }

    id(value: string) {
        return this.setProperty('id', value);
    }

    name(value: string) {
        return this.setProperty('name', value);
    }

    email(value: string) {
        return this.setProperty('email', value);
    }

    age(value: number) {
        return this.setProperty('age', value);
    }
}

// 3. Build your object
const user = UserBuilder.create()
    .id('123')
    .name('John Doe')
    .email('john@example.com')
    .age(30)
    .build();
```

## 📖 Feature Overview

| Feature | Method | Use Case |
|---------|--------|----------|
| **Simple Properties** | `setProperty()` | Set flat object properties |
| **Nested Properties** | `setNestedProperty()` | Set deeply nested properties with dot notation |
| **Array Properties** | `addToArrayProperty()` | Add values to array properties |
| **Multiple Properties** | `setProperties()` | Set multiple properties at once |
| **Required Template** | `static requiredTemplate` | Define required fields for runtime validation |
| **Dynamic Requirements** | `setRequiredFields()` | Add required fields at runtime |
| **Compile-Time Build** | `build()` | Build with TypeScript type checking |
| **Runtime Validation** | `buildSafe()` | Build with runtime validation |
| **Partial Build** | `buildPartial()` | Build incomplete objects |

## 🔧 Basic Usage

### 1. Define Your Type and Builder

```typescript
import { CeriosBuilder } from '@cerios/cerios-builder';

// Define your data type
type User = {
    id: string;
    name: string;
    email: string;
    age?: number; // Optional property
    roles?: string[]; // Optional array property
};

// Create your builder class
class UserBuilder extends CeriosBuilder<User> {
    static create() {
        return new UserBuilder({});
    }

    id(value: string) {
        return this.setProperty('id', value);
    }

    name(value: string) {
        return this.setProperty('name', value);
    }

    email(value: string) {
        return this.setProperty('email', value);
    }

    age(value: number) {
        return this.setProperty('age', value);
    }

    // New: Add to array property
    addRole(role: string) {
        return this.addToArrayProperty('roles', role);
    }

    // Custom methods for common patterns
    withRandomId() {
        return this.setProperty('id', crypto.randomUUID());
    }

    withAdminEmail(username: string) {
        return this.setProperty('email', `${username}@admin.company.com`);
    }
}
```

### 2. Build Objects Safely

```typescript
// ✅ This compiles - all required fields are set
const user = UserBuilder.create()
    .id("123")
    .name("John Doe")
    .email("john@example.com")
    .age(30)
    .addRole("admin") // Add to array property
    .addRole("editor")
    .build();

// ✅ Optional fields and arrays can be omitted
const basicUser = UserBuilder.create()
    .id("456")
    .name("Jane Doe")
    .email("jane@example.com")
    .build(); // age and roles are optional

// ❌ This won't compile - missing required 'email' field
const incompleteUser = UserBuilder.create()
    .id("789")
    .name("Bob Smith")
    .build(); // 💥 TypeScript error!
```

### 3. Use Custom Methods

```typescript
const adminUser = UserBuilder.create()
    .withRandomId()
    .name("Admin User")
    .withAdminEmail("admin")
    .addRole("admin")
    .age(25)
    .build();

console.log(adminUser);
// Output: { id: "550e8400-...", name: "Admin User", email: "admin@admin.company.com", roles: ["admin"], age: 25 }
```

## 🎯 Advanced Examples

### Deeply Nested Properties

Build complex nested structures with type-safe dot-notation paths:

```typescript
import { CeriosBuilder, RequiredFieldsTemplate } from '@cerios/cerios-builder';

type Address = {
    Street: string;
    City: string;
    PostalCode?: string;
    Country: string;
};

type OrderDetails = {
    OrderNumber?: string;
    CustomerId: string;
    TotalAmount: number;
    Status: string;
    ShippingAddress: Address;
};

type Order = {
    Details: OrderDetails;
};

type OrderRequest = {
    Order: Order;
};

class OrderRequestBuilder extends CeriosBuilder<OrderRequest> {
    static create() {
        return new OrderRequestBuilder({}, [
            'Order.Details.CustomerId',
            'Order.Details.TotalAmount',
            'Order.Details.Status',
            'Order.Details.ShippingAddress.Street',
            'Order.Details.ShippingAddress.City',
            'Order.Details.ShippingAddress.Country',
        ]);
    }

    static createWithDefaults() {
        return this.create().status('pending');
    }

    orderNumber(value: string) {
        return this.setNestedProperty('Order.Details.OrderNumber', value);
    }

    customerId(value: string) {
        return this.setNestedProperty('Order.Details.CustomerId', value);
    }

    totalAmount(value: number) {
        return this.setNestedProperty('Order.Details.TotalAmount', value);
    }

    status(value: string) {
        return this.setNestedProperty('Order.Details.Status', value);
    }

    shippingStreet(value: string) {
        return this.setNestedProperty('Order.Details.ShippingAddress.Street', value);
    }

    shippingCity(value: string) {
        return this.setNestedProperty('Order.Details.ShippingAddress.City', value);
    }

    shippingPostalCode(value: string) {
        return this.setNestedProperty('Order.Details.ShippingAddress.PostalCode', value);
    }

    shippingCountry(value: string) {
        return this.setNestedProperty('Order.Details.ShippingAddress.Country', value);
    }
}

// Usage with runtime validation
const order = OrderRequestBuilder.createWithDefaults()
    .customerId('CUST-001')
    .totalAmount(299.99)
    .orderNumber('ORD-12345')
    .shippingStreet('123 Main St')
    .shippingCity('New York')
    .shippingCountry('USA')
    .buildSafe(); // ✅ Validates all required fields are set

// ❌ This will throw an error at runtime
try {
    const invalidOrder = OrderRequestBuilder.createWithDefaults()
        .customerId('CUST-002')
        .buildSafe(); // Missing TotalAmount and shipping address fields
} catch (error) {
    console.error(error.message);
    // "Missing required fields: Order.Details.TotalAmount, Order.Details.ShippingAddress.Street, ..."
}
```

### Runtime Validation with Required Templates

Define which fields are required and validate them at runtime:

```typescript
class ProductBuilder extends CeriosBuilder<Product> {
    static create() {
        return new ProductBuilder({}, [
            'id',
            'name',
            'price',
        ]);
    }

    id(value: string) {
        return this.setProperty('id', value);
    }

    name(value: string) {
        return this.setProperty('name', value);
    }

    price(value: number) {
        return this.setProperty('price', value);
    }

    description(value: string) {
        return this.setProperty('description', value);
    }
}

// Use buildSafe() for runtime validation
const product = ProductBuilder.create()
    .id('PROD-001')
    .name('Laptop')
    .price(999.99)
    .buildSafe(); // ✅ All required fields are set

// This will throw an error
const invalidProduct = ProductBuilder.create()
    .id('PROD-002')
    .name('Mouse')
    .buildSafe(); // ❌ Error: Missing required fields: price
```

### Dynamic Required Fields

Add required fields at runtime based on business logic:

```typescript
class EmployeeBuilder extends CeriosBuilder<Employee> {
    static create() {
        return new EmployeeBuilder({}, [
            'firstName',
            'lastName',
            'email',
        ]);
    }

    firstName(value: string) {
        return this.setProperty('firstName', value);
    }

    lastName(value: string) {
        return this.setProperty('lastName', value);
    }

    email(value: string) {
        return this.setProperty('email', value);
    }

    employeeId(value: string) {
        return this.setProperty('employeeId', value);
    }

    phone(value: string) {
        return this.setProperty('phone', value);
    }
}

// Scenario 1: New employee (no ID required)
const newEmployee = EmployeeBuilder.create()
    .firstName('John')
    .lastName('Doe')
    .email('john.doe@company.com')
    .buildSafe(); // ✅ Only validates firstName, lastName, email

// Scenario 2: Existing employee (ID required)
const existingEmployee = EmployeeBuilder.create()
    .setRequiredFields(['employeeId']) // Add employeeId as required dynamically
    .firstName('Jane')
    .lastName('Smith')
    .email('jane.smith@company.com')
    .employeeId('EMP-12345') // Must provide employeeId
    .buildSafe(); // ✅ Validates firstName, lastName, email, AND employeeId

// Scenario 3: Employee with contact requirement
const contactEmployee = EmployeeBuilder.create()
    .setRequiredFields(['phone', 'employeeId']) // Add multiple dynamic fields
    .firstName('Bob')
    .lastName('Johnson')
    .email('bob.johnson@company.com')
    .phone('+1-555-0123')
    .employeeId('EMP-67890')
    .buildSafe(); // ✅ Validates all fields including phone and employeeId
```

### Four Ways to Set Up Required Fields for Deeply Nested Properties

When working with deeply nested structures, you have **four approaches** to configure required field validation:

#### 1. Static Template in Constructor (Recommended for Fixed Requirements)

Define required fields once at the class level and pass them through the constructor. Best for when required fields never change.

```typescript
type Address = {
    Street: string;
    City: string;
    Country: string;
};

type OrderDetails = {
    CustomerId: string;
    TotalAmount: number;
    ShippingAddress: Address;
};

type Order = {
    Details: OrderDetails;
};

class OrderBuilder extends CeriosBuilder<Order> {
    // Method 1: Static template defined at class level
    static requiredTemplate: RequiredFieldsTemplate<Order> = [
        'Details.CustomerId',
        'Details.TotalAmount',
        'Details.ShippingAddress.Street',
        'Details.ShippingAddress.City',
        'Details.ShippingAddress.Country',
    ];

    static create() {
        // Pass template through constructor
        return new OrderBuilder({});
    }

    customerId(value: string) {
        return this.setNestedProperty('Details.CustomerId', value);
    }

    totalAmount(value: number) {
        return this.setNestedProperty('Details.TotalAmount', value);
    }

    shippingStreet(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.Street', value);
    }

    shippingCity(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.City', value);
    }

    shippingCountry(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.Country', value);
    }
}

// Usage: All required fields validated by template
const order = OrderBuilder.create()
    .customerId('CUST-001')
    .totalAmount(299.99)
    .shippingStreet('123 Main St')
    .shippingCity('New York')
    .shippingCountry('USA')
    .buildSafe(); // ✅ Validates all 5 required nested fields
```

#### 2. Inline Constructor Template (Simple and Direct)

Pass the required template directly in the constructor without defining a static property. Best for simple cases or when you want to keep everything in one place.

```typescript
type Address = {
    Street: string;
    City: string;
    Country: string;
    PostalCode?: string;
};

type OrderDetails = {
    CustomerId: string;
    TotalAmount: number;
    ShippingAddress: Address;
};

type Order = {
    Details: OrderDetails;
};

class OrderBuilder extends CeriosBuilder<Order> {
    // Method 2: Pass template directly in constructor (no static property needed)
    static create() {
        return new OrderBuilder({}, [
            'Details.CustomerId',
            'Details.TotalAmount',
            'Details.ShippingAddress.Street',
            'Details.ShippingAddress.City',
            'Details.ShippingAddress.Country',
        ]);
    }

    customerId(value: string) {
        return this.setNestedProperty('Details.CustomerId', value);
    }

    totalAmount(value: number) {
        return this.setNestedProperty('Details.TotalAmount', value);
    }

    shippingStreet(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.Street', value);
    }

    shippingCity(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.City', value);
    }

    shippingCountry(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.Country', value);
    }

    shippingPostalCode(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.PostalCode', value);
    }
}

// Usage: Same validation as Method 1, but simpler setup
const order = OrderBuilder.create()
    .customerId('CUST-001')
    .totalAmount(299.99)
    .shippingStreet('123 Main St')
    .shippingCity('New York')
    .shippingCountry('USA')
    .buildSafe(); // ✅ Validates all required nested fields

// ❌ Still validates properly
try {
    const invalidOrder = OrderBuilder.create()
        .customerId('CUST-002')
        .buildSafe();
} catch (error) {
    console.error(error.message);
    // "Missing required fields: Details.TotalAmount, Details.ShippingAddress.Street, ..."
}
```

#### 3. Dynamic Required Fields via `setRequiredFields()` (Best for Conditional Logic)

Add required fields at runtime based on business logic. Combines static template with dynamic additions.

```typescript
class OrderBuilder extends CeriosBuilder<Order> {
    static requiredTemplate: RequiredFieldsTemplate<Order> = [
        'Details.CustomerId',
        'Details.TotalAmount',
    ];

    static create() {
        return new OrderBuilder({});
    }

    // Method 3: Add required fields dynamically for specific scenarios
    static createInternational() {
        return this.create()
            .setRequiredFields([
                'Details.ShippingAddress.Street',
                'Details.ShippingAddress.City',
                'Details.ShippingAddress.Country',
                'Details.ShippingAddress.PostalCode', // Extra requirement for international
            ]);
    }

    static createDomestic() {
        return this.create()
            .setRequiredFields([
                'Details.ShippingAddress.Street',
                'Details.ShippingAddress.City',
                'Details.ShippingAddress.Country',
            ]); // No postal code required
    }

    customerId(value: string) {
        return this.setNestedProperty('Details.CustomerId', value);
    }

    totalAmount(value: number) {
        return this.setNestedProperty('Details.TotalAmount', value);
    }

    shippingStreet(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.Street', value);
    }

    shippingCity(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.City', value);
    }

    shippingCountry(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.Country', value);
    }

    shippingPostalCode(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.PostalCode', value);
    }
}

// Domestic order: postal code is optional
const domesticOrder = OrderBuilder.createDomestic()
    .customerId('CUST-001')
    .totalAmount(99.99)
    .shippingStreet('123 Main St')
    .shippingCity('New York')
    .shippingCountry('USA')
    .buildSafe(); // ✅ Valid without postal code

// International order: postal code is required
const internationalOrder = OrderBuilder.createInternational()
    .customerId('CUST-002')
    .totalAmount(299.99)
    .shippingStreet('10 Downing Street')
    .shippingCity('London')
    .shippingCountry('UK')
    .shippingPostalCode('SW1A 2AA') // Must provide postal code
    .buildSafe(); // ✅ All fields including postal code validated

// ❌ This will fail - missing postal code for international
try {
    const invalidOrder = OrderBuilder.createInternational()
        .customerId('CUST-003')
        .totalAmount(150.00)
        .shippingStreet('Rue de Rivoli')
        .shippingCity('Paris')
        .shippingCountry('France')
        .buildSafe(); // Missing PostalCode
} catch (error) {
    console.error(error.message);
    // "Missing required fields: Details.ShippingAddress.PostalCode"
}
```

#### 4. Inline Dynamic Fields (Best for One-Off Requirements)

Add required fields inline during the building process. Useful for special cases.

```typescript
class OrderBuilder extends CeriosBuilder<Order> {
    static create() {
        return new OrderBuilder({}, ['Details.CustomerId']);
    }

    customerId(value: string) {
        return this.setNestedProperty('Details.CustomerId', value);
    }

    totalAmount(value: number) {
        return this.setNestedProperty('Details.TotalAmount', value);
    }

    shippingStreet(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.Street', value);
    }

    shippingCity(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.City', value);
    }

    shippingCountry(value: string) {
        return this.setNestedProperty('Details.ShippingAddress.Country', value);
    }
}

// Method 4: Inline requirement based on runtime data
function createOrder(isPaidOrder: boolean, requiresShipping: boolean) {
    let builder = OrderBuilder.create()
        .customerId('CUST-001');

    // Add requirements inline based on conditions
    if (isPaidOrder) {
        builder = builder.setRequiredFields(['Details.TotalAmount']);
    }

    if (requiresShipping) {
        builder = builder.setRequiredFields([
            'Details.ShippingAddress.Street',
            'Details.ShippingAddress.City',
            'Details.ShippingAddress.Country',
        ]);
    }

    return builder;
}

// Free order without shipping (digital product)
const digitalOrder = createOrder(false, false)
    .buildSafe(); // ✅ Only CustomerId required

// Paid order without shipping (in-store pickup)
const pickupOrder = createOrder(true, false)
    .totalAmount(49.99)
    .buildSafe(); // ✅ CustomerId + TotalAmount required

// Paid order with shipping
const shippedOrder = createOrder(true, true)
    .totalAmount(99.99)
    .shippingStreet('456 Oak Ave')
    .shippingCity('Boston')
    .shippingCountry('USA')
    .buildSafe(); // ✅ All fields validated
```

#### Choosing the Right Approach

| Approach | When to Use | Pros | Cons |
|----------|-------------|------|------|
| **Static Template** | Requirements never change, need reusability | Simple, clear, type-safe, reusable | Inflexible, extra line of code |
| **Inline Constructor** | Simple cases, one factory method | Minimal code, clear, type-safe | Template not reusable elsewhere |
| **Dynamic via Factory** | Multiple predefined scenarios | Reusable, organized, type-safe | More boilerplate |
| **Inline Dynamic** | Runtime-dependent logic | Maximum flexibility | Less discoverable |

**Best Practice**: Combine approaches! Use a static template for core required fields, then add dynamic requirements for conditional scenarios:

```typescript
class OrderBuilder extends CeriosBuilder<Order> {
    // Core fields always required
    static requiredTemplate: RequiredFieldsTemplate<Order> = [
        'Details.CustomerId',
    ];

    static create() {
        return new OrderBuilder({});
    }

    // Scenario-specific factory methods
    static createPaid() {
        return this.create().setRequiredFields(['Details.TotalAmount']);
    }

    static createShippable() {
        return this.createPaid().setRequiredFields([
            'Details.ShippingAddress.Street',
            'Details.ShippingAddress.City',
            'Details.ShippingAddress.Country',
        ]);
    }

    // ... builder methods
}

// Usage is clear and type-safe
const order = OrderBuilder.createShippable()
    .customerId('CUST-001')
    .totalAmount(199.99)
    .shippingStreet('789 Maple Dr')
    .shippingCity('Seattle')
    .shippingCountry('USA')
    .buildSafe(); // ✅ All required fields validated
```

### Building Test Data

Perfect for creating test fixtures with sensible defaults:

```typescript
class ProductBuilder extends CeriosBuilder<Product> {
    static create() {
        return new ProductBuilder({});
    }

    name(value: string) {
        return this.setProperty('name', value);
    }

    price(value: number) {
        return this.setProperty('price', value);
    }

    category(value: string) {
        return this.setProperty('category', value);
    }

    // Add to array property
    addTag(tag: string) {
        return this.addToArrayProperty('tags', tag);
    }

    // Custom methods for testing
    asElectronics() {
        return this.category('Electronics').price(299.99);
    }

    asFreeProduct() {
        return this.price(0);
    }

    withRandomName() {
        const names = ['Widget', 'Gadget', 'Tool', 'Device'];
        return this.name(names[Math.floor(Math.random() * names.length)]);
    }
}

// In your tests
const testProduct = ProductBuilder.create()
    .withRandomName()
    .asElectronics()
    .addTag("featured")
    .addTag("sale")
    .build();
```

### Building Complex Nested Objects

```typescript
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
    notes?: string[];
};

class AddressBuilder extends CeriosBuilder<Address> {
    static create() {
        return new AddressBuilder({});
    }

    static createWithDefaults() {
        return this.create().setProperties({
            city: "Othertown",
            country: "United States",
        });
    }

    street(value: string) {
        return this.setProperty('street', value);
    }

    city(value: string) {
        return this.setProperty('city', value);
    }

    country(value: string) {
        return this.setProperty('country', value);
    }

    zipCode(value: string) {
        return this.setProperty('zipCode', value);
    }

    // Preset addresses
    asUSAddress() {
        return this.country('United States');
    }
}

class CustomerBuilder extends CeriosBuilder<Customer> {
    static create() {
        return new CustomerBuilder({});
    }

    id(value: string) {
        return this.setProperty('id', value);
    }

    name(value: string) {
        return this.setProperty('name', value);
    }

    address(value: Address) {
        return this.setProperty('address', value);
    }

    phoneNumber(value: string) {
        return this.setProperty('phoneNumber', value);
    }

    // Add to array property
    addNote(note: string) {
        return this.addToArrayProperty('notes', note);
    }

    // Build address inline
    withAddress(builderFn: (builder: AddressBuilder) => AddressBuilder & CeriosBrand<Address>) {
        const address = builderFn(AddressBuilder.create()).build();
        return this.setProperty('address', address);
    }

    // Build address with defaults (pre-sets city and country)
    withAddressDefaults(
        builderFn: (
            builder: AddressBuilder & CeriosBrand<Pick<Address, "city" | "country">>
        ) => AddressBuilder & CeriosBrand<Address>
    ) {
        const address = builderFn(AddressBuilder.createWithDefaults()).build();
        return this.setProperty('address', address);
    }
}

// Usage with full address
const customer = CustomerBuilder.create()
    .id('CUST-001')
    .name('Alice Johnson')
    .withAddress(addr => addr
        .street('123 Main St')
        .city('New York')
        .asUSAddress()
        .zipCode('10001')
    )
    .addNote("VIP customer")
    .addNote("Prefers email contact")
    .phoneNumber('+1-555-0123')
    .build();

// Usage with defaults (only set street, city/country are pre-filled)
const customerWithDefaults = CustomerBuilder.create()
    .id('CUST-002')
    .name('Bob Smith')
    .withAddressDefaults(addr => addr.street('456 Elm St'))  // city and country are already set to defaults
    .addNote("New customer")
    .build();

console.log(customerWithDefaults);
// Output: { id: 'CUST-002', name: 'Bob Smith', address: { street: '456 Elm St', city: 'Othertown', country: 'United States' }, notes: ['New customer'] }
```

### Partial Building for Flexibility

Sometimes you need to build incomplete objects:

```typescript
// Build partial objects when not all data is available
const partialUser = UserBuilder.create()
    .name("Unknown User")
    .addRole("guest")
    .buildPartial(); // Returns Partial<User>

// This is useful for:
// - Progressive form filling
// - API responses with optional fields
// - Template objects
```

## 🧪 Testing Integration

Cerios Builder is perfect for test data creation:

```typescript
describe('User Service', () => {
    test('should create user with valid data', () => {
        const userData = UserBuilder.create()
            .withRandomId()
            .name('Test User')
            .email('test@example.com')
            .addRole('tester')
            .age(25)
            .build();

        const result = userService.createUser(userData);

        expect(result.success).toBe(true);
        expect(result.user.name).toBe('Test User');
        expect(result.user.roles).toContain('tester');
    });

    test('should handle users without age', () => {
        const userData = UserBuilder.create()
            .withRandomId()
            .name('Ageless User')
            .email('ageless@example.com')
            .addRole('guest')
            .build();

        const result = userService.createUser(userData);

        expect(result.success).toBe(true);
        expect(result.user.age).toBeUndefined();
        expect(result.user.roles).toContain('guest');
    });
});
```

## 🆚 Why Cerios Builder?

### Traditional Object Creation
```typescript
// ❌ No compile-time safety
const order = {
    Order: {
        Details: {
            CustomerId: "CUST-001",
            TotalAmount: 299.99,
            // Oops! Forgot required Status field
            ShippingAddress: {
                Street: "123 Main St",
                // Oops! Forgot required City and Country
            }
        }
    }
};

// ❌ Runtime error waiting to happen
orderService.createOrder(order);
```

### With Cerios Builder
```typescript
// ✅ Type-safe nested property building
const order = OrderRequestBuilder.createWithDefaults()
    .customerId('CUST-001')
    .totalAmount(299.99)
    .shippingStreet('123 Main St')
    .shippingCity('New York')
    .shippingCountry('USA')
    .buildSafe(); // ✅ Runtime validation ensures all required fields are set

// ✅ Clear error messages
try {
    const invalid = OrderRequestBuilder.createWithDefaults()
        .customerId('CUST-002')
        .buildSafe();
} catch (error) {
    console.error(error.message);
    // "Missing required fields: Order.Details.TotalAmount,
    //  Order.Details.ShippingAddress.Street, ..."
}
```

### Benefits

- **Type-Safe Paths**: Dot notation with full IntelliSense support
- **Runtime Validation**: Optional runtime checks with clear error messages
- **Flexible Requirements**: Static templates + dynamic required fields
- **Deep Nesting**: Handle complex nested structures easily
- **Developer Experience**: Better autocomplete and error messages

## 📚 API Reference

### CeriosBuilder<T>

Base class for all builders.

#### Static Properties

- `requiredTemplate?: RequiredFieldsTemplate<T>` - Optional array of required field paths for runtime validation

#### Instance Methods

- `setProperty<K>(key: K, value: T[K])` - Sets a property and returns a new builder instance
- `setProperties<K>(props: Pick<T, K>)` - Sets multiple properties at once and returns a new builder instance
- `setNestedProperty<P>(path: P, value: PathValue<T, P>)` - Sets a deeply nested property using dot notation
- `addToArrayProperty<K, V>(key: K, value: V)` - Adds a value to an array property and returns a new builder instance
- `setRequiredFields(fields: ReadonlyArray<Path<T>>)` - Sets required fields dynamically for this instance
- `build()` - Builds the final object (only available when all required properties are set via type system)
- `buildSafe()` - Builds the final object with runtime validation of required fields from template
- `buildPartial()` - Builds a partial object with currently set properties

### RequiredFieldsTemplate<T>

Type-safe array of paths for defining required fields.

```typescript
type RequiredFieldsTemplate<T> = ReadonlyArray<Path<T>>;
```

Example:
```typescript
static requiredTemplate: RequiredFieldsTemplate<OrderRequest> = [
    'Order.Details.CustomerId',
    'Order.Details.TotalAmount',
    'Order.Details.ShippingAddress.Street',
];
```

### Path<T>

Type utility that generates all valid dot-notation paths for a type.

```typescript
// For a type like:
type User = {
    profile: {
        name: string;
        email: string;
    };
};

// Path<User> includes:
// 'profile' | 'profile.name' | 'profile.email'
```

### CeriosBrand<T>

Type utility that tracks which properties have been set at the type level.

## � Build Methods Explained

### `build()` - Compile-Time Safety

Use `build()` when you want **compile-time type safety**. TypeScript will enforce that all required properties are set before allowing the build.

```typescript
type User = {
    id: string;
    name: string;
    email: string;
};

const user = UserBuilder.create()
    .id('123')
    .name('John')
    .email('john@example.com')
    .build(); // ✅ Compiles - all required fields set

const invalid = UserBuilder.create()
    .id('123')
    .name('John')
    .build(); // ❌ TypeScript error - missing email
```

### `buildSafe()` - Runtime Validation

Use `buildSafe()` when you want **runtime validation** using the `requiredTemplate`. This is useful when:
- Building from user input or external data
- You want to validate deeply nested required fields
- You need dynamic required fields based on business logic

```typescript
class OrderBuilder extends CeriosBuilder<Order> {
    static requiredTemplate: RequiredFieldsTemplate<Order> = [
        'Details.CustomerId',
        'Details.TotalAmount',
    ];

    static create() {
        return new OrderBuilder({});
    }
    // ... methods
}

const order = OrderBuilder.create()
    .customerId('CUST-001')
    .totalAmount(100)
    .buildSafe(); // ✅ Runtime validation passes

const invalid = OrderBuilder.create()
    .customerId('CUST-002')
    .buildSafe(); // ❌ Throws: "Missing required fields: Details.TotalAmount"
```

### `buildPartial()` - No Validation

Use `buildPartial()` when you need to build an incomplete object:

```typescript
const partial = UserBuilder.create()
    .name('Incomplete User')
    .buildPartial(); // Returns Partial<User>

// Useful for:
// - Progressive form filling
// - Template objects
// - Partial updates
```

## 💡 Best Practices

1. **Use `setNestedProperty()` for deep structures**: Instead of building nested objects separately, use dot notation for better type safety and cleaner code.

2. **Define `requiredTemplate` for runtime validation**: When working with external data or complex validation rules, define a required template and use `buildSafe()`.

3. **Use `setRequiredFields()` for conditional requirements**: When requirements change based on context (e.g., new vs existing records), use dynamic required fields.

4. **Create factory methods**: Use static `create()` and `createWithDefaults()` methods for better ergonomics:
   ```typescript
   static createWithDefaults() {
       return this.create()
           .status('pending')
           .createdAt(new Date());
   }
   ```

5. **Combine with validation libraries**: Use `buildSafe()` with libraries like Zod for comprehensive validation:
   ```typescript
   const data = builder.buildSafe();
   const validated = orderSchema.parse(data); // Zod validation
   ```

6. **Keep builders focused**: One builder per entity type - don't try to handle multiple unrelated types in one builder.

7. **Use type-safe paths**: The `RequiredFieldsTemplate` type ensures you can only specify valid paths:
   ```typescript
   static requiredTemplate: RequiredFieldsTemplate<Order> = [
       'Details.CustomerId', // ✅ Valid path
       'Details.InvalidField', // ❌ TypeScript error
   ];
   ```

## �📄 License

MIT © [Cerios](LICENSE)

## 🔗 Links

- [GitHub Repository](https://github.com/CeriosTesting/cerios-builder)
- [Issues](https://github.com/CeriosTesting/cerios-builder/issues)
- [NPM Package](https://www.npmjs.com/package/@cerios/cerios-builder)