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

test("form uses POST so no credentials end up in the URL/query string", () => {
    const m = html.match(/<form\b[^>]*>/i);
    assert.ok(m, "no <form> tag found");
    assert.ok(!/method=["']get["']/i.test(m[0]),
        "form method is GET — the password and every other field value would be serialised into the URL (server logs, browser history, Referer headers)");
    assert.ok(/action=["']#["']/i.test(m[0]),
        "form should keep action=\"#\" — this is a demo with no backend");
});

test("the phone field no longer locks users into exactly 11 digits", () => {
    const m = html.match(/<input\b[^>]*id=["']number["'][^>]*>/i);
    assert.ok(m, "no #number phone input found");
    assert.ok(!/\bminlength=["']11["']/.test(m[0]),
        "minlength=11 on a tel field rejects every real UK number (11 significant digits, but spaces/dashes/+ make the raw string longer)");
    assert.ok(!/\bmaxlength=["']11["']/.test(m[0]),
        "maxlength=11 has the same problem and also blocks a leading +");
    assert.ok(/\btype=["']tel["']/.test(m[0]), "#number should stay type=tel so mobile browsers show a phone keypad");
});

test("password confirmation is validated (JS + error element)", () => {
    assert.ok(/<script\b[^>]*src=["']script\.js["'][^>]*>/i.test(html),
        "index.html should load script.js for the cross-field password check");
    assert.ok(html.includes('id="pw-error"'),
        "missing #pw-error element that script.js toggles");
    // The error must sit inside the form so its position/visibility follow it
    const form = html.slice(html.search(/<form\b/i), html.search(/<\/form>/i));
    assert.ok(form.includes('id="pw-error"'), "#pw-error must live inside the <form>");
    assert.match(form, /\brole=["']alert["']/, "the error should have role=alert so it is announced");
    assert.ok(existsSync(path.join(root, "script.js")), "script.js is missing");
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
