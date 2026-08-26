import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const html = readFileSync(path.join(root, "index.html"), "utf8");

test("the submit button lives inside the <form>", () => {
    const start = html.search(/<form\b/i);
    const end = html.search(/<\/form>/i);
    assert.ok(start !== -1 && end > start, "no <form>...</form> found");
    const form = html.slice(start, end);
    assert.ok(
        /<button[^>]*type=["']submit["'][^>]*>/.test(form),
        "no type=submit button found inside the <form> — clicking it would not submit"
    );
    // and it must not also exist outside the form
    assert.ok(
        !/type=["']submit["']/.test(html.slice(0, start)) &&
            !/type=["']submit["']/.test(html.slice(end + 7)),
        "submit button found outside the <form>"
    );
});

test("every input uses a valid HTML type", () => {
    const valid = new Set([
        "text", "email", "password", "tel", "number", "search", "url",
        "date", "time", "datetime-local", "month", "week", "color",
        "checkbox", "radio", "range", "file", "submit", "button", "reset",
        "image",
    ]);
    const types = [...html.matchAll(/<input\b[^>]*type=["']([^"']+)["']/gi)].map((m) => m[1]);
    assert.ok(types.length > 0, "expected inputs with a type attribute");
    for (const t of types) {
        assert.ok(valid.has(t), `invalid input type "${t}" (falls back to plain text)`);
    }
});

test("inline tags are balanced (no stray closing tags)", () => {
    for (const tag of ["em", "strong", "h2", "p", "a", "span", "label", "div", "form", "fieldset"]) {
        const open = (html.match(new RegExp(`<${tag}\\b[^>]*?>`, "gi")) ?? []).length;
        const close = (html.match(new RegExp(`</${tag}>`, "gi")) ?? []).length;
        assert.equal(open, close, `<${tag}> open/close mismatch: ${open} open, ${close} close`);
    }
});

test("every <img> has a non-empty alt attribute", () => {
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    assert.ok(imgs.length > 0, "expected the page to contain images");
    for (const [i, tag] of imgs.entries()) {
        const alt = tag.match(/\balt=["']([^"']*)["']/i);
        assert.ok(alt, `img #${i + 1} has no alt attribute: ${tag.slice(0, 60)}...`);
        assert.ok(alt[1].trim().length > 0, `img #${i + 1} has an empty alt`);
    }
});

test("every <label for> targets an existing id", () => {
    const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((m) => m[1]));
    const forIds = [...html.matchAll(/\bfor=["']([^"']+)["']/gi)].map((m) => m[1]);
    assert.ok(forIds.length > 0, "expected labelled inputs");
    for (const id of forIds) {
        assert.ok(ids.has(id), `label for="${id}" targets a missing id`);
    }
});

test("local href/src references point at existing files", () => {
    const refs = [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)]
        .map((m) => m[1])
        .filter((r) => !/^(https?:)?\/\//.test(r) && !r.startsWith("#") && !r.startsWith("mailto:"));
    assert.ok(refs.length > 0, "expected at least one local reference");
    for (const ref of refs) {
        assert.ok(existsSync(path.join(root, ref)), `local reference "${ref}" does not exist`);
    }
});
