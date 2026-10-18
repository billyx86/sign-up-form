# sign-up-form
A sign-up form design.

**Front-end-only demo.** There is no backend: the form intentionally keeps
`action="#"` with `method="post"` (so no field value ever lands in the URL),
and submitting sends nothing anywhere. The "Log in" link was removed for the
same reason — a dead `href="#"` control is not a working feature. If this
ever gains a real handler, the `action` should point at it (and the spec
test that pins `action="#"` must be updated with it).

Photo by [Halie West](https://unsplash.com/photos/25xggax4bSA) on [Unsplash](https://unsplash.com/@haliewestphoto)
