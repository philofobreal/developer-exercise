# Architecture

Trusted `CodeLineExercise` JSON → `compileCodeLineExercise` → audit function ancestry → lower to `ExerciseDefinition` → add absolute-slot edges for `fixed` lines → `compileDefinition` → validate reference order → store compiled model on Node server.

Client gets *only* display line content, id, fixed and functionBlock, plus exercise metadata. It builds stable fixed slots and fills movable positions. A learner POSTs `exerciseId`, `revision`, `lines: string[]`. Server retrieves its own compiled reference and `validateSubmission` tests whether a content-preserving bijection exists under one profile and a valid lexical scope stack. It never accepts browser-supplied dependencies, fixed flags, or reference blocks.

Reference integrity + alternative constraints are **author-time** concerns. Correctness of all accepted programs depends on authoring sound constraints. `indeterminate` protects against exceeding the bounded matching search.

`CodeLine` alone cannot distinguish nested braces; `scopeId` + `blocks` do. Function IDs denote owning function rather than scope. This avoids conflating a function with a `for` block. Syntax-preserving reindentation is view-only via js-beautify.
