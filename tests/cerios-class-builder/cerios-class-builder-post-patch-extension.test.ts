import { describe, expect, it } from "vitest";

import { CeriosClassBuilder, ClassBuilderStep, ClassConstructor, ClassPath } from "../../src/cerios-class-builder";

class CreatePostRequest {
	postId!: string;
	title!: string;
	content!: string;
	authorId!: string;
	tags?: string[];

	constructor(data?: Partial<CreatePostRequest>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	headline(): string {
		return `${this.postId}:${this.title}`;
	}
}

class PatchPostRequest {
	postId!: string;
	patchReason!: string;
	title?: string;
	content?: string;
	tags?: string[];
	notifySubscribers?: boolean;

	constructor(data?: Partial<PatchPostRequest>) {
		if (data) {
			Object.assign(this, data);
		}
	}

	summary(): string {
		return `${this.postId}:${this.patchReason}`;
	}
}

type BasePostData = {
	postId: string;
	title?: string;
	content?: string;
	tags?: string[];
};

abstract class BasePostClassBuilder<T extends BasePostData> extends CeriosClassBuilder<T> {
	protected constructor(
		classConstructor: ClassConstructor<T>,
		data: Partial<T> = {},
		validators?: Array<(obj: Partial<T>) => boolean | string>,
		requiredFields?: ReadonlyArray<ClassPath<T>> | Set<string>,
	) {
		super(classConstructor, data, validators, requiredFields);
	}

	postId(value: T["postId"]): ClassBuilderStep<this, T, "postId"> {
		return this.setProperty("postId", value);
	}

	title(value: NonNullable<T["title"]>): ClassBuilderStep<this, T, "title"> {
		return this.setProperty("title", value);
	}

	content(value: NonNullable<T["content"]>): ClassBuilderStep<this, T, "content"> {
		return this.setProperty("content", value);
	}

	addTag(value: string): ClassBuilderStep<this, T, "tags"> {
		const currentTags = this.buildPartial().tags ?? [];
		return this.setProperty("tags", [...currentTags, value]);
	}
}

class CreatePostRequestClassBuilder extends BasePostClassBuilder<CreatePostRequest> {
	static requiredDataProperties = ["postId", "title", "content", "authorId"] as const;

	constructor(
		classConstructor: ClassConstructor<CreatePostRequest> = CreatePostRequest,
		data: Partial<CreatePostRequest> = {},
		validators?: Array<(obj: Partial<CreatePostRequest>) => boolean | string>,
		requiredFields?: ReadonlyArray<ClassPath<CreatePostRequest>> | Set<string>,
	) {
		super(classConstructor, data, validators, requiredFields);
	}

	static create(): CreatePostRequestClassBuilder {
		return new CreatePostRequestClassBuilder(CreatePostRequest);
	}

	authorId(value: string): ClassBuilderStep<this, CreatePostRequest, "authorId"> {
		return this.setProperty("authorId", value);
	}
}

class PatchPostRequestClassBuilder extends BasePostClassBuilder<PatchPostRequest> {
	static requiredDataProperties = ["postId", "patchReason"] as const;

	constructor(
		classConstructor: ClassConstructor<PatchPostRequest> = PatchPostRequest,
		data: Partial<PatchPostRequest> = {},
		validators?: Array<(obj: Partial<PatchPostRequest>) => boolean | string>,
		requiredFields?: ReadonlyArray<ClassPath<PatchPostRequest>> | Set<string>,
	) {
		super(classConstructor, data, validators, requiredFields);
	}

	static create(): PatchPostRequestClassBuilder {
		return new PatchPostRequestClassBuilder(PatchPostRequest);
	}

	patchReason(value: string): ClassBuilderStep<this, PatchPostRequest, "patchReason"> {
		return this.setProperty("patchReason", value);
	}

	notifySubscribers(value: boolean): ClassBuilderStep<this, PatchPostRequest, "notifySubscribers"> {
		return this.setProperty("notifySubscribers", value);
	}
}

describe("CeriosClassBuilder Post/Patch Extension", () => {
	it("should build create request class with shared and create-only fields", () => {
		const request = CreatePostRequestClassBuilder.create()
			.postId("post-100")
			.title("Class builder")
			.content("Class-friendly fluent API")
			.authorId("author-1")
			.addTag("typescript")
			.build();

		expect(request).toBeInstanceOf(CreatePostRequest);
		expect(request).toEqual({
			postId: "post-100",
			title: "Class builder",
			content: "Class-friendly fluent API",
			authorId: "author-1",
			tags: ["typescript"],
		});
		expect(request.headline()).toBe("post-100:Class builder");
	});

	it("should build patch request class with shared and patch-only fields", () => {
		const request = PatchPostRequestClassBuilder.create()
			.postId("post-200")
			.patchReason("Policy update")
			.title("Updated")
			.notifySubscribers(false)
			.build();

		expect(request).toBeInstanceOf(PatchPostRequest);
		expect(request.summary()).toBe("post-200:Policy update");
		expect(request.notifySubscribers).toBe(false);
	});

	it("shared methods should preserve concrete fluent API", () => {
		const request = PatchPostRequestClassBuilder.create()
			.postId("post-300")
			.content("Small change")
			.patchReason("Cleanup")
			.build();

		expect(request.postId).toBe("post-300");
		expect(request.patchReason).toBe("Cleanup");
		expect(request.content).toBe("Small change");
	});

	it("clone should preserve concrete class builder behavior", () => {
		const cloned = PatchPostRequestClassBuilder.create()
			.postId("post-400")
			.patchReason("Initial")
			.clone()
			.notifySubscribers(true)
			.patchReason("Updated");

		const request = cloned.build();
		expect(request).toBeInstanceOf(PatchPostRequest);
		expect(request.patchReason).toBe("Updated");
		expect(request.notifySubscribers).toBe(true);
	});

	it("should validate create and patch required templates independently", () => {
		expect(() =>
			CreatePostRequestClassBuilder.create()
				.postId("post-500")
				.title("Missing author")
				.content("No author yet")
				.buildWithoutCompileTimeValidation(),
		).toThrow("Missing required fields: authorId");

		expect(() => PatchPostRequestClassBuilder.create().postId("post-501").buildWithoutCompileTimeValidation()).toThrow(
			"Missing required fields: patchReason",
		);
	});
});
