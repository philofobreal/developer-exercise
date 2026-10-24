# Third-party dependencies

The vendored PrismJS runtime and CSS were reused from the user's previous ngDynamic vanilla JavaScript prototype (PrismJS 1.25.0, MIT license). Official project: https://prismjs.com/ . Preserve the upstream MIT license notices when distributing these assets.

The original js-beautify **1.13.13** formatter is loaded separately from cdnjs in this prototype; it is NOT bundled in the ZIP. No other runtime framework dependency exists. In production, pin a vetted version, vendor it locally via your dependency build, apply SRI / CSP, and check its license and provenance. The frontend reports unavailable formatter explicitly.

The TypeScript compiler (pinned 5.8.3) is used by the GitHub Pages **authoring demo** and bundled into its generated `_site/vendor/typescript.js`; the MIT license is copied to `_site/vendor/LICENSE-typescript.txt`. The pure runtime validator does not need it. The secure Node backend remains a separate deployment target.
