import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Minimal in-memory DOM: just enough of `document` to load script.js and
// exercise the cross-field password check (setCustomValidity, submit/input
// listeners, hidden flag on #pw-error).
class El {
    constructor(id) {
        this.id = id;
        this.value = "";
        this.hidden = false;
        this._customValidity = "";
        this._listeners = {};
    }
    addEventListener(type, fn) {
        (this._listeners[type] ??= []).push(fn);
    }
    setCustomValidity(v) {
        this._customValidity = v;
    }
    get customValidity() {
        return this._customValidity;
    }
    // Forms need to find their child inputs; only the form El gets children.
    querySelector(sel) {
        return this._children?.[sel] ?? null;
    }
    dispatch(type) {
        for (const fn of this._listeners[type] ?? []) fn({ preventDefault() {} });
    }
    type(value) {
        this.value = value;
        this.dispatch("input");
    }
}

function buildDom() {
    const form = new El("form");
    const password = new El("password");
    const confirm = new El("confirm-password");
    const pwError = new El("pw-error");
    pwError.hidden = true;
    form._children = { "#password": password, "#confirm-password": confirm };

    const documentStub = {
        querySelector: (sel) =>
            sel === 'form[action="#"]'
                ? form
                : sel === "#password"
                  ? password
                  : sel === "#confirm-password"
                    ? confirm
                    : null,
        getElementById: (id) =>
            id === "pw-error" ? pwError : null,
    };
    return { documentStub, form, password, confirm, pwError };
}

function loadScript() {
    const { documentStub, form, password, confirm, pwError } = buildDom();
    const src = readFileSync(
        path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "script.js"),
        "utf8"
    );
    const fn = new Function("document", src);
    fn(documentStub);
    return { form, password, confirm, pwError };
}

test("matching passwords allow the form to submit", () => {
    const { form, password, confirm, pwError } = loadScript();
    password.type("Sup3rSecret");
    confirm.type("Sup3rSecret");
    let prevented = false;
    // re-dispatch submit capturing preventDefault
    form._listeners["submit"].forEach((fn) =>
        fn({ preventDefault() { prevented = true; } })
    );
    assert.equal(prevented, false, "form was blocked even though passwords match");
    assert.equal(pwError.hidden, true, "error should stay hidden when passwords match");
});

test("mismatched passwords block submission and show the error", () => {
    const { form, password, confirm, pwError } = loadScript();
    password.type("Sup3rSecret");
    confirm.type("Sup3rSecre7"); // differs by one char
    let prevented = false;
    form._listeners["submit"].forEach((fn) =>
        fn({ preventDefault() { prevented = true; } })
    );
    assert.equal(prevented, true, "form submitted despite mismatched passwords");
    assert.equal(pwError.hidden, false, "error should be visible on mismatch");
    assert.notEqual(password.customValidity, "", "password field should carry custom validity");
    assert.notEqual(confirm.customValidity, "", "confirm field should carry custom validity");
});

test("fixing the confirm field clears the error as the user types", () => {
    const { password, confirm, pwError } = loadScript();
    password.type("Sup3rSecret");
    confirm.type("nope");
    assert.equal(pwError.hidden, false, "error should be visible while mismatched");
    confirm.type("Sup3rSecret"); // now they match
    assert.equal(pwError.hidden, true, "error should clear once passwords agree");
    assert.equal(password.customValidity, "", "custom validity should reset when matching");
});

test("empty fields do not trigger a premature error", () => {
    const { form, password, confirm, pwError } = loadScript();
    // both empty: submit should not be blocked on the password rule
    let prevented = false;
    form._listeners["submit"].forEach((fn) =>
        fn({ preventDefault() { prevented = true; } })
    );
    assert.equal(prevented, false, "empty form was blocked by the password check");
    assert.equal(pwError.hidden, true, "no error should show while both fields are empty");
});
