# Motor-change prototyping tool test

**Status:** historical, disposable tool/workflow proof, not a selected UI concept or engineering assessment. Current task/design decisions live in [ux-plan.md](../../ux-plan.md); this artifact is not the next design iteration.

## Open it

- **Editable canvas:** open https://excalidraw.com/, choose Open, and load `motor-change.excalidraw`. No account, SDK or server installation is needed. The drawing contains three grouped boards; ungroup if you want to edit individual objects.
- **Clickable companion:** open `walkthrough.html` directly in your browser (double-click the file). It works from disk without a dev server, packages or network. Use the drawn buttons or the three screen links.
- **Static previews:** `proposal.svg`, `impact.svg` and `requirement.svg`.

Keep the editable `.excalidraw` source, not just screenshots. The native drawing is a storyboard; its illustrated controls are not interactive inside Excalidraw. The HTML companion supplies a tiny, throwaway screen-navigation harness and one simulated acknowledgement—not an application implementation. It does not call Tracer, compute impact or persist decisions.

The SVG previews were generated from the same content/layout as the initial drawing. They use a different font/straight-line rendering and are not exact Excalidraw exports. Editing the drawing does **not** automatically regenerate SVG/HTML; update previews intentionally after a design change. Do not treat both copies as independent sources of truth.

## What this checks

Can we use a free visual editor to import/edit/export a durable drawing, then walk through a short scenario without changing production React?

1. Identify a proposed software motor-limit change.
2. Explore possible effects across system parts.
3. Inspect whether an unchanged system requirement still needs assessment.
4. Simulate marking a question for reassessment.

This first layout is not one of three completed competing concepts. It validates the artifact workflow before we invest in them. Its layout and terminology are assumptions to challenge.

## Scenario and limitations

Source: UR-6 and the worked sustaining scenario in [user-journeys.md](../../user-journeys.md). Needs: PN-03, PN-05, PN-07, PN-09. No actual motor-limit type, values, design artifacts or results were supplied. Relationships, suggested categories and statuses are illustrative, not discovered technical dependencies. No clinical specifications or conclusions are invented.

Desktop-scale wireframes deliberately scroll horizontally at narrow widths; responsive UX and screen-reader usability are not validated by this artifact. Browser keyboard navigation/focus and the click-through path can be checked, but that is not user validation.

Use only toy/sanitized material in the hosted editor. The drawing import is handled by its browser application; this does not constitute a review of the service's full privacy policy. Do not upload confidential artifacts or enable online collaboration before reviewing the relevant policy/terms.

## Next

The file import/edit/export and click-path proof is complete. Follow [ux-plan.md](../../ux-plan.md#7-immediate-next-step) for current source-grounded walkthroughs and collaborative visual decisions; do not refine this first layout into the product by default.

## Verification

Run the native-scene metadata check from the repository root:

```sh
node --test test/prototype-artifacts.test.ts
```

The native-editor import/edit/download round-trip and offline companion navigation checks passed; see [checkpoint.md](../../checkpoint.md) for evidence and limitations. Native download testing used the browser fallback with OS picker APIs disabled. No Excalidraw MCP was used. These checks do not prove user usability.
