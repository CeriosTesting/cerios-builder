# @cerios/cerios-builder

A powerful TypeScript builder pattern library that provides **compile-time type safety** for object construction. Build complex objects with method chaining while ensuring all required properties are set at compile time.

## 🚀 Features

- **Type-Safe Building**: Compile-time validation ensures all required properties are set
- **Method Chaining**: Fluent API for readable object construction
- **Partial Building**: Build incomplete objects when needed
- **Zero Runtime Overhead**: All type checking happens at compile time
- **Extensible**: Easy to create custom builder methods
- **TypeScript First**: Built with TypeScript, for TypeScript

## 📦 Installation

```bash
npm install @cerios/cerios-builder
```

dev install
```bash
npm install --save-dev @cerios/cerios-builder
```

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
};

// Create your builder class
class UserBuilder extends CeriosBuilder<User> {
    private constructor(data: Partial<User>) {
        super(data);
    }

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
    .build();

// ✅ Optional fields can be omitted
const basicUser = UserBuilder.create()
    .id("456")
    .name("Jane Doe")
    .email("jane@example.com")
    .build(); // age is optional, so this works

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
    .age(25)
    .build();

console.log(adminUser);
// Output: { id: "550e8400-...", name: "Admin User", email: "admin@admin.company.com", age: 25 }
```

## 🎯 Advanced Examples

### Building Test Data

Perfect for creating test fixtures with sensible defaults:

```typescript
class ProductBuilder extends CeriosBuilder<Product> {
    private constructor(data: Partial<Product>) {
        super(data);
    }

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
};

class AddressBuilder extends CeriosBuilder<Address> {
    private constructor(data: Partial<Address>) {
        super(data);
    }

    static create() {
        return new AddressBuilder({});
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
    private constructor(data: Partial<Customer>) {
        super(data);
    }

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

    // Build address inline
    withAddress(builderFn: (builder: AddressBuilder) => AddressBuilder & CeriosBrand<Address>) {
        const address = builderFn(AddressBuilder.create()).build();
        return this.setProperty('address', address);
    }
}

// Usage
const customer = CustomerBuilder.create()
    .id('CUST-001')
    .name('Alice Johnson')
    .withAddress(addr => addr
        .street('123 Main St')
        .city('New York')
        .asUSAddress()
        .zipCode('10001')
    )
    .phoneNumber('+1-555-0123')
    .build();
```

### Partial Building for Flexibility

Sometimes you need to build incomplete objects:

```typescript
// Build partial objects when not all data is available
const partialUser = UserBuilder.create()
    .name("Unknown User")
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
            .age(25)
            .build();

        const result = userService.createUser(userData);

        expect(result.success).toBe(true);
        expect(result.user.name).toBe('Test User');
    });

    test('should handle users without age', () => {
        const userData = UserBuilder.create()
            .withRandomId()
            .name('Ageless User')
            .email('ageless@example.com')
            .build();

        const result = userService.createUser(userData);

        expect(result.success).toBe(true);
        expect(result.user.age).toBeUndefined();
    });
});
```

## 🆚 Why Cerios Builder?

### Traditional Object Creation
```typescript
// ❌ No compile-time safety
const user = {
    id: "123",
    name: "John",
    // Oops! Forgot required email field
};

// ❌ Runtime error waiting to happen
userService.createUser(user);
```

### With Cerios Builder
```typescript
// ✅ Compile-time safety
const user = UserBuilder.create()
    .id("123")
    .name("John")
    .email("john@example.com") // Required - won't compile without it
    .build();

// ✅ Guaranteed to have all required fields
userService.createUser(user);
```

## 📚 API Reference

### CeriosBuilder<T>

Base class for all builders.

#### Methods

- `setProperty<K>(key: K, value: T[K])` - Sets a property and returns a new builder instance
- `build()` - Builds the final object (only available when all required properties are set)
- `buildPartial()` - Builds a partial object with currently set properties

### CeriosBrand<T>

Type utility that tracks which properties have been set at the type level.

## 📄 License

MIT © [Cerios](LICENSE)

## 🔗 Links

- [GitHub Repository](https://github.com/CeriosTesting/cerios-builder)
- [Issues](https://github.com/CeriosTesting/cerios-builder/issues)
- [NPM Package](https://www.npmjs.com/package/@cerios/cerios-builder)