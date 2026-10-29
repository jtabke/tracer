# Documentation and workspace navigation readiness

Selected maintenance slice, 2026-10-29, from the owner's request to prepare the
repository for a remote update and improve missing navigation. This does not
select bulk authoring, collaboration or another application model.

## Findings and selected changes

The shared workbench's project menu is a flat list. Open project tasks have no
general task switcher; users must return to the workspace and reopen the menu.
The main workspace rail is incorrectly titled Development map, which is a
different retained experience. Some completed configuration authoring remains
described as pending in current reference prose.

Use one grouped task catalog for the project menu and an accessible task selector
on project-task and model-page headers. Keep the existing mounted task/draft
owners and model-history routing. Add a direct documentation entry in the main
rail, identify the workspace correctly and bound the project menu to the viewport.
Keep Graph/Matrix/History navigation and the selected shared layout.

## Acceptance

1. Every existing project task remains reachable through named groups; selection
   dependent tasks remain disabled without a selected record.
2. Users can switch directly among tasks and the model page, identify the current
   task and return to the original workspace perspective/selection/revision.
3. In-session drafts remain intact across task changes. Switching is navigation,
   not save, discard, automatic refresh or mutation recovery acknowledgment.
4. Keyboard access, focus, Escape and return behavior remain usable. Project
   navigation and task headers fit desktop, 680px and 390px layouts; long menus
   scroll within their viewport.
5. Current docs describe implemented configuration/reference authoring and explain
   task navigation. Existing evidence anchors, paths and bytes remain intact;
   historical plans retain their qualifications.
6. Relevant regressions, full checks, desktop/narrow screenshots and repository
   link checks pass. Record exact evidence and remaining human-validation limits.
7. Guarded work status, export and online/restored backup are preserved. Inspect
   the fetched remote divergence and prepare local commits without pushing as
   part of this request.

Verification uses disposable native projects, retained drafts, selected Matrix
and historical contexts, direct help, keyboard task switching and model-page
returns. Reuse current core/HTTP/CLI and mutation contracts; no storage migration
or primitive change is intended. An automated walkthrough and screenshots are
technical evidence, not representative-human validation.
