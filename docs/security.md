# Security model

The browser is untrusted. POST `/api/evaluate` accepts only an exercise ID, revision, and array of physical lines; the trusted definition, graph, scopes, fixed anchors, and profiles remain server-side. The compiled engine never executes or interprets the submitted JavaScript/TypeScript. Unknown/changed content is rejected. Do not trust the UI's disabled controls or drag IDs.

Author-editable models belong exclusively to a temporary, untrusted preview channel. The server validates all model edits and never treats learner-supplied rules as authoritative. Do not use previews for grades or secrets. Use HTTPS, authentication, authorization, storage protections, logging, and production-grade rate limiting before deployment. JSON Schema and compile-time semantic checks should both be applied at publication time.

Use `normalization:'exact'` when indent changes might affect literals. No parser runs on learner input in production. Reference JS/TS syntax parser is an author-side check; test/verify all allowed orders for runtime behavior separately.
