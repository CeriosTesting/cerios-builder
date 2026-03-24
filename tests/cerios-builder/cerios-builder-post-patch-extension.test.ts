import { describe, expect, it } from "vitest";

import { BuilderStep, CeriosBuilder, RequiredFieldsTemplate } from "../../src/cerios-builder";

type BasePostRequest = {
	postId: string;
	title?: string;
	content?: string;
	tags?: string[];
};

type CreatePostRequest = BasePostRequest & {
	title: string;
	content: string;
	authorId: string;
};

type PatchPostRequest = BasePostRequest & {
	patchReason: string;
	notifySubscribers?: boolean;
};

abstract class BasePostRequestBuilder<T extends BasePostRequest> extends CeriosBuilder<T> {
	protected constructor(
		data: Partial<T> = {},
		requiredFields?: RequiredFieldsTemplate<T>,
		validators?: Array<(obj: Partial<T>) => boolean | string>,
	) {
		super(data, requiredFields, validators);
	}

	postId(value: T["postId"]): BuilderStep<this, T, "postId"> {
		return this.setProperty("postId", value);
	}

	title(value: NonNullable<T["title"]>): BuilderStep<this, T, "title"> {
		return this.setProperty("title", value as T["title"]);
	}

	content(value: NonNullable<T["content"]>): BuilderStep<this, T, "content"> {
		return this.setProperty("content", value as T["content"]);
	}

	addTag(value: string): BuilderStep<this, T, "tags"> {
		const currentTags = this.buildPartial().tags ?? [];
		return this.setProperty("tags", [...currentTags, value] as T["tags"]);
	}
}

class CreatePostRequestBuilder extends BasePostRequestBuilder<CreatePostRequest> {
	static requiredTemplate: RequiredFieldsTemplate<CreatePostRequest> = ["postId", "title", "content", "authorId"];

	static create(): CreatePostRequestBuilder {
		return new CreatePostRequestBuilder({}, this.requiredTemplate);
	}

	authorId(value: string): BuilderStep<this, CreatePostRequest, "authorId"> {
		return this.setProperty("authorId", value);
	}
}

class PatchPostRequestBuilder extends BasePostRequestBuilder<PatchPostRequest> {
	static requiredTemplate: RequiredFieldsTemplate<PatchPostRequest> = ["postId", "patchReason"];

	static create(): PatchPostRequestBuilder {
		return new PatchPostRequestBuilder({}, this.requiredTemplate);
	}

	patchReason(value: string): BuilderStep<this, PatchPostRequest, "patchReason"> {
		return this.setProperty("patchReason", value);
	}

	notifySubscribers(value: boolean): BuilderStep<this, PatchPostRequest, "notifySubscribers"> {
		return this.setProperty("notifySubscribers", value);
	}
}

describe("CeriosBuilder Post/Patch Extension", () => {
	it("should build create request with shared and create-only fields", () => {
		const request = CreatePostRequestBuilder.create()
			.postId("post-100")
			.title("Builder Patterns")
			.content("Compile-time safety is great.")
			.authorId("author-1")
			.addTag("typescript")
			.addTag("builders")
			.build();

		expect(request).toEqual({
			postId: "post-100",
			title: "Builder Patterns",
			content: "Compile-time safety is great.",
			authorId: "author-1",
			tags: ["typescript", "builders"],
		});
	});

	it("should build patch request with shared and patch-only fields", () => {
		const request = PatchPostRequestBuilder.create()
			.postId("post-200")
			.patchReason("Fix typo")
			.title("Fixed title")
			.notifySubscribers(true)
			.build();

		expect(request).toEqual({
			postId: "post-200",
			patchReason: "Fix typo",
			title: "Fixed title",
			notifySubscribers: true,
		});
	});

	it("shared methods should preserve concrete fluent API", () => {
		const request = PatchPostRequestBuilder.create()
			.postId("post-300")
			.content("Small update")
			.patchReason("Patch")
			.build();

		expect(request.postId).toBe("post-300");
		expect(request.patchReason).toBe("Patch");
		expect(request.content).toBe("Small update");
	});

	it("clone should preserve concrete builder behavior", () => {
		const cloned = PatchPostRequestBuilder.create()
			.postId("post-400")
			.patchReason("Initial reason")
			.clone()
			.notifySubscribers(true)
			.patchReason("Updated reason");

		const request = cloned.build();
		expect(request).toEqual({
			postId: "post-400",
			patchReason: "Updated reason",
			notifySubscribers: true,
		});
	});

	it("should validate create and patch required templates independently", () => {
		expect(() =>
			CreatePostRequestBuilder.create()
				.postId("post-500")
				.title("Missing author")
				.content("No author yet")
				.buildWithoutCompileTimeValidation(),
		).toThrow("Missing required fields: authorId");

		expect(() => PatchPostRequestBuilder.create().postId("post-501").buildWithoutCompileTimeValidation()).toThrow(
			"Missing required fields: patchReason",
		);
	});
});
