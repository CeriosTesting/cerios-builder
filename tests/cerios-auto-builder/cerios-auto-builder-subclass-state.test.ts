import { describe, expect, it } from "vitest";

import { CeriosAutoBuilder } from "../../src/cerios-auto-builder";

type Doc = {
	title: string;
	body?: string;
};

// Copy-on-write bypasses the subclass constructor, so it has to carry the subclass's own
// fields across itself. Getting this wrong is not merely lossy: a missing field is absent
// from the proxy target, so the proxy hands back an auto-setter *function* for it, and
// `this.cache.set(...)` fails with "is not a function" far from the real cause.
class TrackingBuilder extends CeriosAutoBuilder<Doc>() {
	cache = new Map<string, string>();
	counter = 0;

	constructor(data?: Partial<Doc>) {
		super(data);
	}

	static create(): TrackingBuilder {
		return new TrackingBuilder();
	}

	get upper(): string {
		return (this.buildPartial().title ?? "").toUpperCase();
	}

	remember(key: string, value: string): this {
		this.cache.set(key, value);
		this.counter += 1;
		return this;
	}
}

describe("CeriosAutoBuilder - subclass instance state across copy-on-write", () => {
	it("keeps a subclass field after a setter call", () => {
		const forked = TrackingBuilder.create().title("t");

		expect(forked.cache).toBeInstanceOf(Map);
		expect(forked.counter).toBe(0);
	});

	it("does not shadow a subclass field with an auto setter", () => {
		const forked = TrackingBuilder.create().title("t");

		// The regression made this a function, so `typeof` is the assertion that matters.
		expect(typeof forked.cache).not.toBe("function");
	});

	it("leaves subclass methods usable after a setter call", () => {
		const forked = TrackingBuilder.create().title("t").remember("a", "1");

		expect(forked.cache.get("a")).toBe("1");
		expect(forked.counter).toBe(1);
	});

	it("keeps subclass fields through clone()", () => {
		const cloned = TrackingBuilder.create().title("t").clone();

		expect(cloned.cache).toBeInstanceOf(Map);
	});

	it("keeps subclass fields through setRequiredFields() and removeOptionalProperty()", () => {
		const configured = TrackingBuilder.create().setRequiredFields(["title"]).title("t").body("b");

		expect(configured.cache).toBeInstanceOf(Map);
		expect(configured.removeOptionalProperty("body").cache).toBeInstanceOf(Map);
	});

	it("keeps subclass getters working after a setter call", () => {
		expect(TrackingBuilder.create().title("hello").upper).toBe("HELLO");
	});

	it("carries subclass reference fields shallowly - every fork shares one instance", () => {
		// Copy-on-write carries subclass fields by reference, deliberately: only the target
		// data is deep-cloned. A mutable field like a Map is therefore aliased across forks;
		// per-fork state belongs in the target data, not in builder fields.
		const original = TrackingBuilder.create().remember("a", "1");
		const forked = original.title("t");

		expect(forked.cache).toBe(original.cache);
		forked.cache.set("b", "2");
		expect(original.cache.get("b")).toBe("2");

		// clone() deep-clones only the target data; subclass fields stay shared too.
		expect(original.clone().cache).toBe(original.cache);
	});

	it("does not let a subclass field mask the builder's own members", () => {
		const forked = TrackingBuilder.create().title("t");

		expect(forked.build()).toEqual({ title: "t" });
		expect(forked.clone()).toBeInstanceOf(TrackingBuilder);
	});
});
