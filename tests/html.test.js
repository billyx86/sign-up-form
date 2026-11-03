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

test("every input has an autocomplete hint so autofill and assistive tech work (#7)", () => {
    const field = (id) => html.match(new RegExp(`<input\\b[^>]*\\bid=["']${id}["'][^>]*>`, "i"))?.[0] ?? "";
    const expected = {
        "first-name": "given-name",
        "last-name": "family-name",
        email: "email",
        number: "tel",
        password: "new-password",
        "confirm-password": "new-password",
    };
    for (const [id, token] of Object.entries(expected)) {
        const input = field(id);
        assert.ok(input, `#${id} input not found`);
        assert.ok(
            input.includes(`autocomplete="${token}"`),
            `#${id} should have autocomplete="${token}"`
        );
    }
});

test("no dead href=\"#\" links are presented as working controls (#8)", () => {
    const deadLinks = [...html.matchAll(/<a\b[^>]*\bhref=["']#["'][^>]*>/gi)];
    assert.deepEqual(
        deadLinks.map((m) => m[0]),
        [],
        `dead href="#" link(s) presented as working control(s): ${deadLinks.map((m) => m[0]).join(" ")}`
    );
});

test("the front-end-only demo posture is documented (action=\"#\" is intentional) (#9)", () => {
    const form = html.match(/<form\b[^>]*>/i)?.[0] ?? "";
    assert.ok(/action=["']#["']/i.test(form), "form should keep action=\"#\" (backend-less demo)");
    assert.ok(!/method=["']get["']/i.test(form), "form must stay POST");
    const readme = readFileSync(path.join(root, "README.md"), "utf8");
    assert.match(readme, /front-end-only demo/i, "README should document that this is a front-end-only demo");
});

test("the phone field carries a permissive E.164-ish pattern (#12)", () => {
    const m = html.match(/<input\b[^>]*id=["']number["'][^>]*>/i);
    assert.ok(m, "no #number phone input found");
    const pattern = m[0].match(/\bpattern=["']([^"']+)["']/i);
    assert.ok(pattern, "#number should have a pattern attribute so clearly-garbage input is rejected");
    // Compile the declared pattern (HTML pattern is anchored, so wrap with ^/$)
    // and verify the intent: reject obvious garbage, keep real numbers.
    const re = new RegExp(`^${pattern[1]}$`);
    // legitimate international formats must still pass
    for (const good of ["+44 7700 900000", "+447700900000", "07700 900000", "+1 (415) 555-0100", "+49 30 123456"]) {
        assert.ok(re.test(good), `pattern should accept "${good}"`);
    }
    // clearly-garbage input must be rejected
    for (const bad of ["abc", "1", "!!!"]) {
        assert.ok(!re.test(bad), `pattern should reject "${bad}"`);
    }
    // a helpful message should accompany the pattern
    assert.ok(/\btitle=["'][^"']+["']/.test(m[0]), "#number pattern should have a title attribute so the browser shows a useful message");
});

test("the page has a non-empty <meta name=\"description\"> (#13)", () => {
    const head = html.slice(0, html.search(/<\/head>/i));
    const m = head.match(/<meta\b[^>]*\bname=["']description["'][^>]*>/i);
    assert.ok(m, "no <meta name=\"description\"> in <head>");
    const content = m[0].match(/\bcontent=["']([^"']*)["']/i);
    assert.ok(content, "the description meta has no content attribute");
    assert.ok(content[1].trim().length > 0, "the description meta content is empty");
    assert.match(content[1], /front-end-only design demo/i, "description should describe the page as a front-end-only sign-up form demo");
});
