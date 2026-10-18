import { test } from "node:test";
import assert from "node:assert/strict";
import { generateShortCode } from "../src/utils/generateShortCode.js";

test("generateShortCode returns a string", () => {
    assert.equal(typeof generateShortCode(), "string");
});

test("generateShortCode returns exactly 6 characters", () => {
    assert.equal(generateShortCode().length, 6);
});

test("generateShortCode uses only uppercase, lowercase and digits", () => {
    for (let i = 0; i < 100; i++) {
        assert.match(generateShortCode(), /^[A-Za-z0-9]{6}$/);
    }
});
