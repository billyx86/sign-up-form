import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const css = readFileSync(path.join(root, "style.css"), "utf8");

// Return the first rule whose selector list matches `selectorTest`.
function ruleFor(selectorTest) {
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        if (selectorTest.test(m[1].trim())) {
            return { selector: m[1].trim(), body: m[2] };
        }
    }
    return null;
}

test("the submit button has a :focus-visible rule with a visible indicator (#11)", () => {
    const rule = ruleFor(/\bbutton\s*:focus-visible\b/);
    assert.ok(rule, "no `button:focus-visible` rule in style.css");
    assert.match(
        rule.body,
        /outline|box-shadow/,
        "the button :focus-visible rule must draw a visible indicator (outline or box-shadow)"
    );
});

test("the header credit links have a :focus-visible rule with a visible indicator (#11)", () => {
    const rule = ruleFor(/\ba\s*:focus-visible\b/);
    assert.ok(rule, "no `a:focus-visible` rule in style.css");
    assert.match(
        rule.body,
        /outline|box-shadow/,
        "the link :focus-visible rule must draw a visible indicator (outline or box-shadow)"
    );
});

test("the 'Norse Bold' @font-face declares format() so unsupported files are skipped (#17)", () => {
    const rule = ruleFor(/^@font-face$/);
    assert.ok(rule, "no `@font-face` rule in style.css");
    assert.match(
        rule.body,
        /format\(\s*["']?opentype["']?\s*\)/,
        "the `@font-face` src must carry a format() hint (the file is a .otf, so format(\"opentype\"))"
    );
});

test("the 'Norse Bold' @font-face declares font-display: swap so the heading is not blocked on font load (#17)", () => {
    const rule = ruleFor(/^@font-face$/);
    assert.ok(rule, "no `@font-face` rule in style.css");
    assert.match(
        rule.body,
        /font-display\s*:\s*swap/,
        "the `@font-face` rule must set font-display: swap so the fallback face renders immediately"
    );
});
