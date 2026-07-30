# Label template authoring and publishing

Build 13 templates are bounded declarative JSON interpreted by reviewed web and
Flutter renderers. They are data, not executable code. JavaScript, Dart, CSS,
scripted SVG, WebAssembly, remote fonts, remote images, and arbitrary network
references are not accepted.

The website workflow is:

1. Choose a published design or prior version.
2. Duplicate it to a Draft.
3. Edit allowed metadata and declarative elements.
4. Validate short, long, minimal, and maximum fictional previews.
5. Publish the Draft as a new immutable version.
6. Optionally make that version the default for future days.
7. Assign a published version to a Planning day.

Active and Complete days are locked. Rollback selects a prior published version
for a Planning day or as the future default; published history is never edited.

## Version 1 schema

The version-1 canvas is always exactly `591×354` pixels. A definition is no
larger than 64 KiB and contains 1–96 flat elements. Nested groups, external
assets, links, and references to other templates are not accepted.

Allowed primitives:

- `text`
- `line`
- `rect`
- `roundedRect`
- `circle`
- `ellipse`
- `mark` with the built-in `orbitGlobe` or `sparkle4` mark

Text uses bundled Arial regular or bold, black or white, 6–128 px type, one to
four lines, and no more than eight literal/binding segments. A literal is at
most 256 characters. Line height may not be smaller than font size, which
prevents overlapping text. Text is fitted within its declared box and
ellipsized if it cannot fit at the declared minimum size.

Bindings are limited to:

- `personName`
- `drink`
- `productionName`
- `clientName`
- `productionClient`
- `group`
- `orderNumber`

Coordinates and dimensions must be finite and remain inside the canvas.
Strokes are bounded to 0.01–12 px. Rotations are bounded to −360–360 degrees.
Colors are only `#000000` and `#ffffff`. Unknown keys, primitives, bindings,
fonts, colors, and schema versions are rejected.

## Compatibility and failure behavior

Build 13 supports schema version 1. The app validates a published definition
before replacing its cached version. A refresh failure or invalid/incompatible
definition cannot erase the last-known-good snapshot. A historical production
with no database assignment resolves deterministically to the bundled
`grid-01` version rather than whichever template is the current default.

New productions snapshot the current published default. Once a day leaves
Planning, its version is locked. Changing the future default never mutates an
existing day.

The production default remains `grid-01` until the exact Build 13 binary and
the other available designs pass the physical worksheet. Publishing a version
does not by itself prove that it is readable on the accepted printer, stock,
and density.
