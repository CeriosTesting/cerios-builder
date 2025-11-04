# @cerios/cerios-builder

A powerful TypeScript builder pattern library that provides **compile-time type safety** for object construction. Build complex objects with method chaining while ensuring all required properties are set at compile time.

## 🚀 Features

- **Type-Safe Building**: Compile-time validation ensures all required properties are set
- **Nested Properties Support**: Build deeply nested objects with dot-notation paths
- **Flexible Runtime Validation**: Choose between compile-time, runtime, or both validations
- **Immutability Options**: Create frozen or sealed objects with shallow or deep variants
- **Dynamic Required Fields**: Add required fields at runtime based on your business logic
- **Method Chaining**: Fluent API for readable object construction
- **Partial Building**: Build incomplete objects when needed
- **Zero Runtime Overhead**: All type checking happens at compile time (unless using runtime validation)
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
| **Full Validation** | `build()` | Build with both compile-time and runtime validation |
| **Compile-Time Only** | `buildWithoutRuntimeValidation()` | Build with TypeScript checking only |
| **Runtime Only** | `buildWithoutCompileTimeValidation()` | Build with runtime validation only |
| **No Validation** | `buildUnsafe()` | Build without any validation |
| **Partial Build** | `buildPartial()` | Build incomplete objects |
| **Shallow Freeze** | `buildFrozen()` | Create immutable object (top-level only) |
| **Deep Freeze** | `buildDeepFrozen()` | Create fully immutable object tree |
| **Shallow Seal** | `buildSealed()` | Lock structure, allow modifications |
| **Deep Seal** | `buildDeepSealed()` | Lock all structures, allow modifications |

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
    .addRole("admin")
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
    Details?: OrderDetails;
};

type OrderRequest = {
    Order: Order;
};

class OrderRequestBuilder extends CeriosBuilder<OrderRequest> {
    static requiredTemplate: RequiredFieldsTemplate<OrderRequest> = [
        'Order.Details.CustomerId',
        'Order.Details.TotalAmount',
        'Order.Details.Status',
        'Order.Details.ShippingAddress.Street',
        'Order.Details.ShippingAddress.City',
        'Order.Details.ShippingAddress.Country',
    ];

    static create() {
        return new OrderRequestBuilder({});
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

// Usage with full validation (both compile-time and runtime)
const order = OrderRequestBuilder.createWithDefaults()
    .customerId('CUST-001')
    .totalAmount(299.99)
    .orderNumber('ORD-12345')
    .shippingStreet('123 Main St')
    .shippingCity('New York')
    .shippingCountry('USA')
    .build(); // ✅ TypeScript + runtime validation

// ❌ This will throw an error at runtime
try {
    const invalidOrder = OrderRequestBuilder.createWithDefaults()
        .customerId('CUST-002')
        .buildWithoutCompileTimeValidation(); // Missing TotalAmount and shipping address
} catch (error) {
    console.error(error.message);
    // "Missing required fields: Order.Details.TotalAmount, Order.Details.ShippingAddress.Street, ..."
}
```

### Runtime Validation with Required Templates

Define which fields are required and validate them at runtime:

```typescript
type Product = {
    id: string;
    name: string;
    price: number;
    description?: string;
};

class ProductBuilder extends CeriosBuilder<Product> {
    static requiredTemplate: RequiredFieldsTemplate<Product> = [
        'id',
        'name',
        'price',
    ];

    static create() {
        return new ProductBuilder({});
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

// Full validation (compile-time + runtime)
const product = ProductBuilder.create()
    .id('PROD-001')
    .name('Laptop')
    .price(999.99)
    .build(); // ✅ All required fields are set

// Runtime-only validation (useful for dynamic data)
const dynamicProduct = ProductBuilder.create()
    .id('PROD-002')
    .name('Mouse')
    .price(29.99)
    .buildWithoutCompileTimeValidation(); // ✅ Runtime check passes

// ❌ This will throw an error at runtime
try {
    const invalidProduct = ProductBuilder.create()
        .id('PROD-003')
        .name('Keyboard')
        .buildWithoutCompileTimeValidation(); // Missing price
} catch (error) {
    console.error(error.message);
    // "Missing required fields: price"
}
```

### Dynamic Required Fields

Add required fields at runtime based on business logic:

```typescript
type Employee = {
    firstName: string;
    lastName: string;
    email: string;
    employeeId?: string;
    phone?: string;
};

class EmployeeBuilder extends CeriosBuilder<Employee> {
    static requiredTemplate: RequiredFieldsTemplate<Employee> = [
        'firstName',
        'lastName',
        'email',
    ];

    static create() {
        return new EmployeeBuilder({});
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

// Scenario 1: New employee (only basic fields required)
const newEmployee = EmployeeBuilder.create()
    .firstName('John')
    .lastName('Doe')
    .email('john.doe@company.com')
    .build(); // ✅ Only validates firstName, lastName, email

// Scenario 2: Existing employee (ID required)
const existingEmployee = EmployeeBuilder.create()
    .setRequiredFields(['employeeId']) // Add employeeId as required dynamically
    .firstName('Jane')
    .lastName('Smith')
    .email('jane.smith@company.com')
    .employeeId('EMP-12345')
    .buildWithoutCompileTimeValidation(); // ✅ Runtime validates all fields including employeeId

// Scenario 3: Employee with contact requirement
const contactEmployee = EmployeeBuilder.create()
    .setRequiredFields(['phone', 'employeeId']) // Add multiple dynamic fields
    .firstName('Bob')
    .lastName('Johnson')
    .email('bob.johnson@company.com')
    .phone('+1-555-0123')
    .employeeId('EMP-67890')
    .buildWithoutCompileTimeValidation(); // ✅ Validates all including phone and employeeId

// ❌ This will fail - missing dynamically required field
try {
    const invalidEmployee = EmployeeBuilder.create()
        .setRequiredFields(['employeeId'])
        .firstName('Alice')
        .lastName('Brown')
        .email('alice.brown@company.com')
        .buildWithoutCompileTimeValidation(); // Missing employeeId
} catch (error) {
    console.error(error.message);
    // "Missing required fields: employeeId"
}
```

### Four Ways to Set Up Required Fields for Deeply Nested Properties

When working with deeply nested structures, you have **multiple approaches** to configure required field validation:

#### 1. Static Template at Class Level (Recommended for Fixed Requirements)

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

// Usage: Runtime validation checks all required fields
const order = OrderBuilder.create()
    .customerId('CUST-001')
    .totalAmount(299.99)
    .shippingStreet('123 Main St')
    .shippingCity('New York')
    .shippingCountry('USA')
    .buildWithoutCompileTimeValidation(); // ✅ Validates all 5 required nested fields
```

#### 2. Dynamic Required Fields via `setRequiredFields()` (Best for Conditional Logic)

```typescript
class OrderBuilder extends CeriosBuilder<Order> {
    static requiredTemplate: RequiredFieldsTemplate<Order> = [
        'Details.CustomerId',
        'Details.TotalAmount',
    ];

    static create() {
        return new OrderBuilder({});
    }

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
    .buildWithoutCompileTimeValidation(); // ✅ Valid without postal code

// International order: postal code is required
const internationalOrder = OrderBuilder.createInternational()
    .customerId('CUST-002')
    .totalAmount(299.99)
    .shippingStreet('10 Downing Street')
    .shippingCity('London')
    .shippingCountry('UK')
    .shippingPostalCode('SW1A 2AA')
    .buildWithoutCompileTimeValidation(); // ✅ All fields including postal code validated

// ❌ This will fail - missing postal code for international
try {
    const invalidOrder = OrderBuilder.createInternational()
        .customerId('CUST-003')
        .totalAmount(150.00)
        .shippingStreet('Rue de Rivoli')
        .shippingCity('Paris')
        .shippingCountry('France')
        .buildWithoutCompileTimeValidation(); // Missing PostalCode
} catch (error) {
    console.error(error.message);
    // "Missing required fields: Details.ShippingAddress.PostalCode"
}
```

### Building Test Data

Perfect for creating test fixtures with sensible defaults:

```typescript
type Product = {
    name: string;
    price: number;
    category: string;
    tags?: string[];
};

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

    // NEW: Create with ALL required fields set
    static createComplete() {
        return this.create()
            .street("123 Default Street")
            .city("Othertown")
            .country("United States");
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

    addNote(note: string) {
        return this.addToArrayProperty('notes', note);
    }

    // Pattern 1: No defaults - must set all required fields
    withAddress(builderFn: (builder: AddressBuilder) => AddressBuilder & CeriosBrand<Address>) {
        const address = builderFn(AddressBuilder.create()).build();
        return this.setProperty('address', address);
    }

    // Pattern 2: Partial defaults - must set remaining required fields (street)
    withAddressDefaults(
        builderFn: (
            builder: AddressBuilder & CeriosBrand<Pick<Address, "city" | "country">>
        ) => AddressBuilder & CeriosBrand<Address>
    ) {
        const address = builderFn(AddressBuilder.createWithDefaults()).build();
        return this.setProperty('address', address);
    }

    // Pattern 3: Complete defaults - callback is OPTIONAL
    withCompleteAddress(
        builderFn?: (
            builder: AddressBuilder & CeriosBrand<Address>
        ) => AddressBuilder & CeriosBrand<Address>
    ) {
        const builder = AddressBuilder.createComplete();
        const address = builderFn ? builderFn(builder).build() : builder.build();
        return this.setProperty('address', address);
    }
}

// Pattern 1: No defaults - must set all required fields
const customer1 = CustomerBuilder.create()
    .id('CUST-001')
    .name('Alice Johnson')
    .withAddress(addr => addr
        .street('123 Main St')
        .city('New York')
        .asUSAddress()
        .zipCode('10001')
    )
    .addNote("VIP customer")
    .phoneNumber('+1-555-0123')
    .build();

// Pattern 2: Partial defaults - city and country already set, must provide street
const customer2 = CustomerBuilder.create()
    .id('CUST-002')
    .name('Bob Smith')
    .withAddressDefaults(addr => addr.street('456 Elm St'))
    .addNote("New customer")
    .build();

console.log(customer2);
// Output: { id: 'CUST-002', name: 'Bob Smith', address: { street: '456 Elm St', city: 'Othertown', country: 'United States' }, notes: ['New customer'] }

// Pattern 3a: Complete defaults - no callback needed, use all defaults
const customer3 = CustomerBuilder.create()
    .id('CUST-003')
    .name('Charlie Davis')
    .withCompleteAddress() // ✅ No callback needed - all required fields already set!
    .build();

console.log(customer3);
// Output: { id: 'CUST-003', name: 'Charlie Davis', address: { street: '123 Default Street', city: 'Othertown', country: 'United States' } }

// Pattern 3b: Complete defaults - optional callback to modify/add optional fields
const customer4 = CustomerBuilder.create()
    .id('CUST-004')
    .name('Diana Evans')
    .withCompleteAddress(addr => addr
        .zipCode('90210')  // Only modify/add optional fields if needed
    )
    .build();

console.log(customer4);
// Output: { id: 'CUST-004', name: 'Diana Evans', address: { street: '123 Default Street', city: 'Othertown', country: 'United States', zipCode: '90210' } }

// Pattern 3c: Complete defaults - optional callback to override any field
const customer5 = CustomerBuilder.create()
    .id('CUST-005')
    .name('Eve Foster')
    .withCompleteAddress(addr => addr
        .street('789 Custom Ave')  // Override the default street
        .zipCode('10001')
    )
    .addNote("Premium customer")
    .build();

console.log(customer5);
// Output: { id: 'CUST-005', name: 'Eve Foster', address: { street: '789 Custom Ave', city: 'Othertown', country: 'United States', zipCode: '10001' }, notes: ['Premium customer'] }
```

#### Using `createWithDefaults()` with Nested Builders

The key pattern is:
1. **`createComplete()`**: Returns a builder with **all required fields already set**
2. **Optional callback parameter**: The callback parameter is typed as `optional` (`?`), so you don't have to provide it
3. **Already branded**: Since all required fields are set, the builder is already branded with `CeriosBrand<Address>`, so you can call `build()` immediately

This pattern is perfect when:
- You have sensible defaults for all required fields
- Most users will use the defaults
- Some users may want to customize optional fields or override defaults
- You want a clean API without forcing users to write empty callbacks

**Comparison of the three patterns:**

```typescript
// Pattern 1: Must set ALL required fields
.withAddress(addr => addr.street('...').city('...').country('...'))

// Pattern 2: Must set REMAINING required fields (street)
.withAddressDefaults(addr => addr.street('...'))

// Pattern 3a: NO callback needed - all defaults
.withCompleteAddress()

// Pattern 3b: OPTIONAL callback - only if you want to customize
.withCompleteAddress(addr => addr.zipCode('...'))

// Pattern 3c: OPTIONAL callback - can override any field
.withCompleteAddress(addr => addr.street('...').zipCode('...'))
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
    .build(); // ✅ Both compile-time and runtime validation

// ✅ Clear error messages at runtime
try {
    const invalid = OrderRequestBuilder.createWithDefaults()
        .customerId('CUST-002')
        .buildWithoutCompileTimeValidation();
} catch (error) {
    console.error(error.message);
    // "Missing required fields: Order.Details.TotalAmount,
    //  Order.Details.ShippingAddress.Street, ..."
}
```

### Benefits

- **Type-Safe Paths**: Dot notation with full IntelliSense support
- **Flexible Validation**: Choose compile-time, runtime, both, or neither
- **Dynamic Requirements**: Static templates + dynamic required fields
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

#### Build Methods

- **`build()`** - Builds with **both compile-time and runtime validation** (recommended)
  - Compile-time: TypeScript enforces all required properties are set
  - Runtime: Validates all fields in the `requiredTemplate`
  - Throws error if any required field is missing

- **`buildWithoutRuntimeValidation()`** - Builds with **compile-time validation only**
  - Compile-time: TypeScript enforces all required properties are set
  - Runtime: No validation (better performance)
  - Use when you trust the type system and need speed

- **`buildWithoutCompileTimeValidation()`** - Builds with **runtime validation only**
  - Compile-time: No TypeScript enforcement
  - Runtime: Validates all fields in the `requiredTemplate`
  - Use when building from external data where compile-time checks aren't possible
  - Throws error if any required field is missing

- **`buildUnsafe()`** - Builds **without any validation**
  - Compile-time: No TypeScript enforcement
  - Runtime: No validation
  - Use only when you're certain the object is valid and need maximum performance
  - Returns potentially incomplete object

- **`buildPartial()`** - Builds a **partial object**
  - Returns `Partial<T>` with currently set properties
  - Useful for progressive form filling or template objects

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

## 🛠️ Build Methods Explained

### `build()` - Full Validation (Recommended)

Use `build()` when you want **both compile-time and runtime validation**. This is the safest option.

```typescript
class UserBuilder extends CeriosBuilder<User> {
    static requiredTemplate: RequiredFieldsTemplate<User> = ['id', 'name', 'email'];
    // ... methods
}

const user = UserBuilder.create()
    .id('123')
    .name('John')
    .email('john@example.com')
    .build(); // ✅ TypeScript + runtime validation

// ❌ TypeScript error - missing email
const invalid1 = UserBuilder.create()
    .id('123')
    .name('John')
    .build();

// ❌ Runtime error - missing email
try {
    const invalid2 = UserBuilder.create()
        .id('123')
        .name('John')
        .build();
} catch (error) {
    console.error(error.message); // "Missing required fields: email"
}
```

**Use when:**
- You want maximum safety
- Building critical business objects
- You have a required template defined

### `buildWithoutRuntimeValidation()` - Compile-Time Only

Use when you want **TypeScript safety** but need to skip runtime validation for performance.

```typescript
const user = UserBuilder.create()
    .id('123')
    .name('John')
    .email('john@example.com')
    .buildWithoutRuntimeValidation(); // ✅ Fast build, no runtime check

// ❌ Still won't compile - TypeScript enforces types
const invalid = UserBuilder.create()
    .id('123')
    .name('John')
    .buildWithoutRuntimeValidation();
```

**Use when:**
- Performance is critical
- You trust the type system
- Building many objects in loops

### `buildWithoutCompileTimeValidation()` - Runtime Only

Use when building from **external data** where compile-time checks aren't possible.

```typescript
function buildFromAPI(data: any) {
    const builder = UserBuilder.create();

    if (data.id) builder = builder.id(data.id);
    if (data.name) builder = builder.name(data.name);
    if (data.email) builder = builder.email(data.email);

    return builder.buildWithoutCompileTimeValidation(); // Runtime validation
}

// ✅ Valid data passes
const user = buildFromAPI({ id: '123', name: 'John', email: 'john@example.com' });

// ❌ Invalid data throws
try {
    const invalid = buildFromAPI({ id: '123', name: 'John' }); // Missing email
} catch (error) {
    console.error(error.message); // "Missing required fields: email"
}
```

**Use when:**
- Building from API responses
- Processing user input
- Working with dynamic data
- Need runtime validation without TypeScript constraints

### `buildUnsafe()` - No Validation

Use **only when you're certain** the object is valid and need maximum performance.

```typescript
const user = UserBuilder.create()
    .id('123')
    .buildUnsafe(); // ⚠️ No checks at all

console.log(user); // { id: '123' } - potentially incomplete!
```

**Use when:**
- You're absolutely certain the data is valid
- Maximum performance is required
- Building throwaway test objects

### `buildPartial()` - Partial Objects

Use when you need **incomplete objects**.

```typescript
const partial = UserBuilder.create()
    .name('Incomplete User')
    .buildPartial(); // Returns Partial<User>

console.log(partial); // { name: 'Incomplete User' }
```

**Use when:**
- Progressive form filling
- Template objects
- Partial updates
- Inspecting builder state

### Comparison Table

| Method | Compile-Time Check | Runtime Check | Performance | Safety | Use Case |
|--------|-------------------|---------------|-------------|--------|----------|
| `build()` | ✅ | ✅ | Medium | Highest | Production code |
| `buildWithoutRuntimeValidation()` | ✅ | ❌ | Fast | High | Performance-critical |
| `buildWithoutCompileTimeValidation()` | ❌ | ✅ | Medium | Medium | External data |
| `buildUnsafe()` | ❌ | ❌ | Fastest | Lowest | Trusted scenarios only |
| `buildPartial()` | ❌ | ❌ | Fast | N/A | Incomplete objects |

## � Immutable Build Methods

In addition to the standard build methods, `@cerios/cerios-builder` provides **frozen** and **sealed** variants that create immutable objects. These methods help prevent accidental mutations and enforce data integrity.

### Understanding Freeze vs Seal

Before diving into the methods, it's important to understand the difference between **frozen** and **sealed** objects:

| Feature | `Object.freeze()` | `Object.seal()` |
|---------|------------------|-----------------|
| **Add properties** | ❌ Prevented | ❌ Prevented |
| **Delete properties** | ❌ Prevented | ❌ Prevented |
| **Modify properties** | ❌ Prevented | ✅ Allowed |
| **Use case** | Complete immutability | Prevent structural changes |

**Shallow vs Deep:**
- **Shallow**: Only applies to the top-level object
- **Deep**: Recursively applies to all nested objects and arrays

### `buildFrozen()` - Shallow Freeze

Creates a **shallowly frozen** object where top-level properties cannot be modified, but nested objects remain mutable.

```typescript
const user = UserBuilder.create()
    .id('123')
    .name('John')
    .email('john@example.com')
    .buildFrozen(); // Returns Readonly<User>

// ❌ Error: Cannot modify top-level properties
user.name = 'Jane'; // TypeError in strict mode

// ⚠️ Nested objects can still be modified (shallow freeze)
user.address.city = 'New York'; // Works if address is an object
```

**Use when:**
- You want to prevent accidental top-level modifications
- Nested objects are intentionally mutable
- Performance is a concern (shallow operations are faster)

### `buildDeepFrozen()` - Deep Freeze

Creates a **deeply frozen** object where all properties at all levels are immutable.

```typescript
const user = UserBuilder.create()
    .id('123')
    .name('John')
    .email('john@example.com')
    .setNestedProperty('address.city', 'Boston')
    .buildDeepFrozen(); // Returns DeepReadonly<User>

// ❌ Error: Cannot modify top-level properties
user.name = 'Jane'; // TypeError

// ❌ Error: Cannot modify nested properties
user.address.city = 'New York'; // TypeError

// ❌ Error: Cannot modify arrays
user.tags.push('new tag'); // TypeError
```

**Use when:**
- You need complete immutability
- Building configuration objects
- Creating frozen state snapshots
- Working with Redux/immutable state patterns
- Passing objects to untrusted code

### `buildSealed()` - Shallow Seal

Creates a **shallowly sealed** object where properties cannot be added or removed, but existing properties can be modified.

```typescript
const user = UserBuilder.create()
    .id('123')
    .name('John')
    .email('john@example.com')
    .buildSealed(); // Returns T

// ✅ Can modify existing properties
user.name = 'Jane'; // Works!

// ❌ Cannot add new properties
user.newProp = 'value'; // TypeError in strict mode

// ❌ Cannot delete properties
delete user.email; // TypeError in strict mode

// ⚠️ Can modify nested objects (shallow seal)
user.address.city = 'New York'; // Works if address is an object
```

**Use when:**
- You want to lock the object structure
- Properties should be modifiable
- Preventing accidental property additions
- Building objects with fixed schemas

### `buildDeepSealed()` - Deep Seal

Creates a **deeply sealed** object where no properties can be added or removed at any level, but all properties can still be modified.

```typescript
const user = UserBuilder.create()
    .id('123')
    .name('John')
    .email('john@example.com')
    .setNestedProperty('address.city', 'Boston')
    .buildDeepSealed(); // Returns T

// ✅ Can modify properties at all levels
user.name = 'Jane'; // Works
user.address.city = 'New York'; // Works

// ❌ Cannot add properties at any level
user.newProp = 'value'; // TypeError
user.address.newProp = 'value'; // TypeError

// ❌ Cannot add array elements
user.tags.push('new tag'); // TypeError

// ✅ Can modify array elements
user.tags[0] = 'updated tag'; // Works
```

**Use when:**
- You want to lock all object structures
- Values should be modifiable
- Preventing structural changes throughout the tree
- Building objects with deeply fixed schemas

### Immutability Comparison

| Method | Modify Top-Level | Modify Nested | Add Properties | Delete Properties | Performance |
|--------|-----------------|---------------|----------------|-------------------|-------------|
| `buildFrozen()` | ❌ | ✅ | ❌ | ❌ | Fast |
| `buildDeepFrozen()` | ❌ | ❌ | ❌ | ❌ | Slower |
| `buildSealed()` | ✅ | ✅ | ❌ | ❌ | Fast |
| `buildDeepSealed()` | ✅ | ✅ | ❌ | ❌ | Slower |

### Immutability Examples

#### Example 1: Configuration Object

```typescript
class ConfigBuilder extends CeriosBuilder<AppConfig> {
    static requiredTemplate: RequiredFieldsTemplate<AppConfig> = [
        'apiUrl',
        'timeout',
        'features.authentication'
    ];

    static create() {
        return new ConfigBuilder({});
    }

    // ... builder methods
}

const config = ConfigBuilder.create()
    .setApiUrl('https://api.example.com')
    .setTimeout(5000)
    .setNestedProperty('features.authentication', true)
    .buildDeepFrozen(); // Configuration should never change

// ❌ Configuration is completely frozen
config.timeout = 10000; // TypeError
config.features.authentication = false; // TypeError
```

#### Example 2: Mutable Data with Fixed Structure

```typescript
class UserStateBuilder extends CeriosBuilder<UserState> {
    static create() {
        return new UserStateBuilder({});
    }

    // ... builder methods
}

const userState = UserStateBuilder.create()
    .setUserId('123')
    .setStatus('active')
    .setLastSeen(new Date())
    .buildDeepSealed(); // Structure is fixed, but values can change

// ✅ Can update state values
userState.status = 'inactive';
userState.lastSeen = new Date();

// ❌ Cannot add new properties
userState.newField = 'value'; // TypeError
```

#### Example 3: Snapshot for Time Travel Debugging

```typescript
class AppStateBuilder extends CeriosBuilder<AppState> {
    // ... methods
}

const snapshots: DeepReadonly<AppState>[] = [];

// Capture immutable snapshots
snapshots.push(
    AppStateBuilder.create()
        .setCurrentUser(user)
        .setOpenDocuments(documents)
        .buildDeepFrozen()
);

// Snapshots cannot be modified
snapshots[0].currentUser.name = 'Changed'; // TypeError
```

### When to Use Immutability

**Use `buildDeepFrozen()`:**
- ✅ Configuration objects
- ✅ State snapshots
- ✅ Event data
- ✅ Cached results
- ✅ Objects passed to untrusted code

**Use `buildDeepSealed()`:**
- ✅ State objects with fixed schemas
- ✅ Form data models
- ✅ Database records with fixed columns
- ✅ API response models

**Use shallow variants (`buildFrozen()`, `buildSealed()`):**
- ✅ When nested objects need flexibility
- ✅ Performance-critical scenarios
- ✅ Intentional selective mutability

**Avoid immutable builds when:**
- ❌ Building frequently updated objects
- ❌ Working with large data structures (performance cost)
- ❌ Objects that need frequent transformations

## �💡 Best Practices

1. **Use `setNestedProperty()` for deep structures**: Instead of building nested objects separately, use dot notation for better type safety and cleaner code.

2. **Define `requiredTemplate` for runtime validation**: When working with external data or complex validation rules, define a required template.

3. **Choose the right build method**:
   - Default to `build()` for safety
   - Use `buildWithoutRuntimeValidation()` for performance
   - Use `buildWithoutCompileTimeValidation()` for external data
   - Use `buildUnsafe()` only when absolutely necessary
   - Use `buildDeepFrozen()` for configuration and immutable data
   - Use `buildDeepSealed()` when you need fixed schemas with mutable values

4. **Use `setRequiredFields()` for conditional requirements**: When requirements change based on context (e.g., new vs existing records), use dynamic required fields.

5. **Create factory methods**: Use static `create()` and `createWithDefaults()` methods for better ergonomics:
   ```typescript
   static createWithDefaults() {
       return this.create()
           .status('pending')
           .createdAt(new Date());
   }
   ```

6. **Combine with validation libraries**: Use runtime validation with libraries like Zod for comprehensive validation:
   ```typescript
   const data = builder.buildWithoutCompileTimeValidation();
   const validated = orderSchema.parse(data); // Zod validation
   ```

7. **Keep builders focused**: One builder per entity type - don't try to handle multiple unrelated types in one builder.

8. **Use type-safe paths**: The `RequiredFieldsTemplate` type ensures you can only specify valid paths:
   ```typescript
   static requiredTemplate: RequiredFieldsTemplate<Order> = [
       'Details.CustomerId', // ✅ Valid path
       'Details.InvalidField', // ❌ TypeScript error
   ];
   ```
