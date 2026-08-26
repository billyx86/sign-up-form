// Password-match validation for the sign-up form.
//
// `minlength` can only check one field on its own — making sure the two
// password fields agree is a cross-field rule, which only JavaScript can
// express. The check runs on submit (blocking the form when they differ)
// and on input, so the error clears as soon as the user fixes it.
(function () {
    "use strict";

    // No document (e.g. unit test without a DOM) or no form: nothing to do.
    if (typeof document === "undefined") return;
    var form = document.querySelector('form[action="#"]');
    if (!form) return;

    var password = form.querySelector("#password");
    var confirm = form.querySelector("#confirm-password");
    var error = document.getElementById("pw-error");
    if (!password || !confirm || !error) return;

    function match() {
        return password.value === confirm.value;
    }

    function validate() {
        var bothFilled = password.value !== "" && confirm.value !== "";
        var ok = !bothFilled || match();
        error.hidden = ok;
        password.setCustomValidity(ok ? "" : "Passwords do not match");
        confirm.setCustomValidity(ok ? "" : "Passwords do not match");
        return ok;
    }

    form.addEventListener("submit", function (event) {
        if (!validate()) {
            event.preventDefault();
            error.hidden = false;
        }
    });

    password.addEventListener("input", validate);
    confirm.addEventListener("input", validate);
})();
