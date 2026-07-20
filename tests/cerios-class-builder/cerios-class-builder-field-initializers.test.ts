import { describe, expect, it } from "vitest";

import { CeriosClassBuilder, ClassBuilderStep, ClassConstructor } from "../../src/cerios-class-builder";

class ResultSet {
	people: string[] = [];
}

/** No constructor at all: `data` is never read, so every field keeps its initializer. */
class ResponseEnvelope {
	resultSet = new ResultSet();
	requestId?: string;
}

/** Normalises one property and leaves an unrelated field initializer alone. */
class Article {
	title!: string;
	tags: string[] = [];

	constructor(data?: Partial<Article>) {
		if (data?.title !== undefined) {
			this.title = data.title.trim();
		}
	}
}

/** Rejects a missing argument, so the no-data probe throws. */
class Connection {
	host!: string;
	port!: number;

	constructor(data?: Partial<Connection>) {
		if (!data) {
			throw new Error("Connection requires data");
		}
		this.host = data.host ?? "localhost";
		this.port = 0;
	}
}

class ResponseEnvelopeBuilder extends CeriosClassBuilder<ResponseEnvelope> {
	constructor(
		classConstructor: ClassConstructor<ResponseEnvelope> = ResponseEnvelope,
		data: Partial<ResponseEnvelope> = {},
		validators?: Array<(obj: Partial<ResponseEnvelope>) => boolean | string>,
		requiredFields?: Set<string>,
	) {
		super(classConstructor, data, validators, requiredFields);
	}

	static create(): ResponseEnvelopeBuilder {
		return new ResponseEnvelopeBuilder();
	}

	resultSet(value: ResultSet): ClassBuilderStep<this, ResponseEnvelope, "resultSet"> {
		return this.setProperty("resultSet", value);
	}

	requestId(value: string): ClassBuilderStep<this, ResponseEnvelope, "requestId"> {
		return this.setProperty("requestId", value);
	}
}

class ArticleBuilder extends CeriosClassBuilder<Article> {
	constructor(
		classConstructor: ClassConstructor<Article> = Article,
		data: Partial<Article> = {},
		validators?: Array<(obj: Partial<Article>) => boolean | string>,
		requiredFields?: Set<string>,
	) {
		super(classConstructor, data, validators, requiredFields);
	}

	static create(): ArticleBuilder {
		return new ArticleBuilder();
	}

	title(value: string): ClassBuilderStep<this, Article, "title"> {
		return this.setProperty("title", value);
	}

	tags(value: string[]): ClassBuilderStep<this, Article, "tags"> {
		return this.setProperty("tags", value);
	}
}

class ConnectionBuilder extends CeriosClassBuilder<Connection> {
	constructor(
		classConstructor: ClassConstructor<Connection> = Connection,
		data: Partial<Connection> = {},
		validators?: Array<(obj: Partial<Connection>) => boolean | string>,
		requiredFields?: Set<string>,
	) {
		super(classConstructor, data, validators, requiredFields);
	}

	static create(): ConnectionBuilder {
		return new ConnectionBuilder();
	}

	host(value: string): ClassBuilderStep<this, Connection, "host"> {
		return this.setProperty("host", value);
	}

	port(value: number): ClassBuilderStep<this, Connection, "port"> {
		return this.setProperty("port", value);
	}
}

function resultSetWith(...people: string[]): ResultSet {
	const resultSet = new ResultSet();
	resultSet.people = people;
	return resultSet;
}

describe("CeriosClassBuilder - field initializers", () => {
	it("keeps a value set through the builder when a field initializer supplies a default", () => {
		const envelope = ResponseEnvelopeBuilder.create().resultSet(resultSetWith("Ada")).build();

		expect(envelope.resultSet.people).toEqual(["Ada"]);
	});

	it("preserves the prototype of a nested class instance that replaces a default", () => {
		const envelope = ResponseEnvelopeBuilder.create().resultSet(resultSetWith("Ada")).build();

		expect(envelope.resultSet).toBeInstanceOf(ResultSet);
	});

	it("clones the built value rather than aliasing the one handed to the builder", () => {
		const resultSet = resultSetWith("Ada");
		const envelope = ResponseEnvelopeBuilder.create().resultSet(resultSet).build();

		// The builder deep-clones its state before construction so the built instance can never
		// alias the builder's own nested state. Equal in value, deliberately not the same object.
		expect(envelope.resultSet).toEqual(resultSet);
		expect(envelope.resultSet).not.toBe(resultSet);
	});

	it("assigns a key with an initializer default alongside one the class leaves unset", () => {
		const envelope = ResponseEnvelopeBuilder.create().resultSet(resultSetWith("Ada")).requestId("req-1").build();

		expect(envelope.resultSet.people).toEqual(["Ada"]);
		expect(envelope.requestId).toBe("req-1");
	});

	it("leaves an initializer default untouched when the builder never sets that key", () => {
		// Deliberately leaving `resultSet` unset is the point of this case, so the build gate
		// has to be stepped around.
		const envelope = ResponseEnvelopeBuilder.create().requestId("req-1").buildWithoutCompileTimeValidation();

		expect(envelope.resultSet).toBeInstanceOf(ResultSet);
		expect(envelope.resultSet.people).toEqual([]);
	});

	it("keeps a value the constructor derived from the data instead of overwriting it", () => {
		const article = ArticleBuilder.create().title("  Origin of Species  ").buildWithoutCompileTimeValidation();

		expect(article.title).toBe("Origin of Species");
	});

	it("keeps a derived value while still assigning an unrelated initializer default", () => {
		// The case the old all-or-nothing check got wrong in the opposite direction: one key
		// needing assignment used to drag every other key along with it.
		const article = ArticleBuilder.create().title("  Origin of Species  ").tags(["biology"]).build();

		expect(article.title).toBe("Origin of Species");
		expect(article.tags).toEqual(["biology"]);
	});

	it("assigns the builder's value when the constructor cannot be probed without arguments", () => {
		// `new Connection()` throws, so the class's defaults are unknowable - the explicitly set
		// value wins rather than being silently dropped.
		const connection = ConnectionBuilder.create().host("example.com").port(8080).build();

		expect(connection.host).toBe("example.com");
		expect(connection.port).toBe(8080);
	});

	it("applies the same resolution through the hardening build variants", () => {
		const envelope = ResponseEnvelopeBuilder.create().resultSet(resultSetWith("Ada")).buildFrozen();

		expect(envelope.resultSet.people).toEqual(["Ada"]);
		expect(Object.isFrozen(envelope)).toBe(true);
	});
});
