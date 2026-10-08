import { afterEach, describe, expect, it, vi } from "vitest";
import { timestamp } from "./util.ts";

describe("timestamp", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns the current time by default", () => {
		const now = new Date(2026, 9, 8, 14, 32, 45);
		vi.useFakeTimers();
		vi.setSystemTime(now);

		expect(timestamp()).toEqual(now);
	});

	it("returns the start of the current day when dateOnly is true", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 9, 8, 14, 32, 45));

		expect(timestamp(true)).toEqual(new Date(2026, 9, 8));
	});
});
