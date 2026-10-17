# Getting started with Tracer

Run `npm ci` and `npm run demo` from the repository root with Node.js 24.15 or newer. Open the printed URL. The picker contains two separate databases: fictional Orbit R1 and Aster Home BP. Both open the same Graph / Matrix / History workspace. All example targets and results are invented.

## Complete a workflow in the main workspace

The normal launch opens **Graph**. Search for an artifact, use **Matrix** for title-first creation and direct connections, then edit a statement and open **History** to read its saved diff. **Explore potential impact** follows exact recorded paths; connectivity alone does not establish an assessed effect.

For a project without seeded evidence, open **Project tools → Evaluations → Record native-input receipt**. Choose the output, write the actual outcome and declare the exact input items and field scope. Historical native versions and configuration pins are available when needed. Record the receipt before changing an input, then return to that input and choose **Assess evidence**. Compare the captured and current values, select **Review receipt**, choose a decision and record its rationale. The receipt, freshness comparison and review remain separate facts.

**Project tools** also opens **Configure model**, **New item**, complete **Edit item and connections**, **Configurations**, and **Documentation**. Returning from a task retains its in-session draft. These tools use the selected database and existing version guards.

Reload recovers selection, graph positions, Matrix settings, revision and investigation scope in the same browser and origin. Use **Save Matrix configuration** for a named database-backed row-type/path/search recipe; loading one applies it across the project. Unsaved edits and review rationales are not recovered after reload or close: the browser warns, and reopening explains that policy. An unconfirmed save requires inspection and acknowledgment before new writes; it is never automatically resubmitted.

## Use the retained Development map

The remaining map walkthrough and desk-light example use **Project tools → Development map**. It retains the overview, Items table and guided connection controls; **Graph / Matrix / History** returns to the main workspace. Finish or deliberately discard unsaved drafts before changing workspaces.

## Follow a shared design

Choose **Orbit R1**, search `DES-01`, and open the matching result. The map follows the actual recorded relationships around the blower-control firmware design. Use **Levels** and **Trace direction** to adjust context, or **Follow connections** to walk one native link at a time. **← Data model** returns to the overview. **Frame all** changes the camera; it does not change scope or evidence.

Choose **Items table** to read the same scope as rows. Select an item for its full statement and immediate connections. **Graph** returns to the map. A shared item retains one native identity, even when several requirements refer to it.

In Aster, search `PRS-01` to follow a product requirement into its subsystem allocations and verification plan. Allowed schema routes and recorded links remain distinct; a plan is not an executed test result.

## Make and retain an edit

Select an item and choose **Edit item and connections**. Click a displayed field or choose **Edit item** for the complete form. **Save item** checks the captured version. **Cancel** discards that editor's local proposal; rejected saves retain it. Review current versions deliberately after a conflict.

**Return to map** or Escape hides the task while keeping its in-session draft. Open the same task to resume. Choosing another item with a dirty editor requires an explicit discard decision. Reloading the browser does not preserve an unsaved draft.

The task's connection controls create native typed directed links with captured endpoint/schema guards. A saved connection is trace information, not approval or proof of satisfaction.

## Create records and configure the model

Use **Configure model** to define item types, typed fields and allowed relationships. The existing Visual/Text proposal editor retains its schema-version checks and conflict recovery. On a new project, choose a starter or define your own model. **New item** creates a native record using that project's actual fields; optional keys remain optional. A model change retains a creation proposal and requires explicit adoption before saving.

## Worked example: start a product from an empty database

This example builds a fictional desk light with one requirement and one component. It uses the shared UI and your own SQLite file, with no seeded records.

### 1. Create and open the database

From the repository root, after installing Node.js 24.15 or newer:

```sh
npm ci
npm start -- --db desk-light.sqlite
```

Use a new filename in an existing directory. Tracer creates the file when it opens it. If the file already exists, this command opens its saved project; it does not reset it. Open the exact local URL printed in the terminal. Keep the terminal running while using the browser. **New item** becomes available after you save a model.

### 2. Define the product model

A **type** defines a kind of record, such as `requirement`; an **item** is an actual record of that type, such as `REQ-001`. A relationship definition permits a direction between types. It does not create links between items.

Our model is:

| Type          | Required fields                | Purpose                          |
| ------------- | ------------------------------ | -------------------------------- |
| `product`     | `title` (string)               | The product being developed      |
| `requirement` | `title`, `statement` (strings) | A required product behavior      |
| `component`   | `title` (string)               | An implementation responsibility |

`has_requirement` permits product → requirement. `allocated_to` permits requirement → component. Each has an authored development-flow label; those labels affect presentation, while recorded links retain their native direction.

Open **Configure model**. Choose **Text**, enable **Advanced JSON**, and replace **Project schema JSON** with this complete definition:

```json
{
  "entityTypes": {
    "product": {
      "fields": {
        "title": {
          "type": "string",
          "required": true
        }
      }
    },
    "requirement": {
      "fields": {
        "title": {
          "type": "string",
          "required": true
        },
        "statement": {
          "type": "string",
          "required": true
        }
      }
    },
    "component": {
      "fields": {
        "title": {
          "type": "string",
          "required": true
        }
      }
    }
  },
  "relationshipTypes": {
    "has_requirement": {
      "source": ["product"],
      "target": ["requirement"],
      "fields": {},
      "workflow": [
        {
          "source": "product",
          "target": "requirement",
          "direction": "forward",
          "label": "Requirements"
        }
      ]
    },
    "allocated_to": {
      "source": ["requirement"],
      "target": ["component"],
      "fields": {},
      "workflow": [
        {
          "source": "requirement",
          "target": "component",
          "direction": "forward",
          "label": "Allocation"
        }
      ]
    }
  }
}
```

Choose **Save model**, wait for the project refresh, then **Return to map**. The model now has three types and two allowed routes, with no items yet. **Visual** and guided **Text** editing change this same model draft; JSON is used here to make the tutorial reproducible. Alternatively, use **Definition kind** and **Add definition** to create the types and relationships individually, with their fields and permitted source/target types. Save the full draft when finished.

Model updates validate existing saved data. Adding a required field or removing a used type can be rejected; changing a definition does not automatically migrate existing records.

### 3. Create the three items

Choose **New item**. Select the type before entering its fields, enter the optional key and the values below, then choose **Create item**. Wait for the saved confirmation. The form clears after each successful creation, so repeat it for the next row.

| Item type     | Key        | title                 | statement                       |
| ------------- | ---------- | --------------------- | ------------------------------- |
| `product`     | `PROD-001` | Desk light            | Not a field on this type        |
| `requirement` | `REQ-001`  | Adjustable brightness | The user can adjust brightness. |
| `component`   | `COMP-001` | LED controller        | Not a field on this type        |

Keys are optional human labels, unique across active items in the project. Tracer assigns each item a permanent UUID; relationships refer to that UUID, so changing a title does not disconnect an item.

### 4. Connect actual items

Choose **Return to map**. Search `PROD-001`, open its matching result, and choose **Edit item and connections**. Expand **Connect an existing item**, select `has_requirement` under **Connection meaning**, and find `REQ-001` under **Find target**. Choose its target result, then **Connect selected target**. This tutorial's relationships have no additional fields to fill in.

Return to the map, search `REQ-001`, and open its item editor. Repeat the connection process with `allocated_to` and target `COMP-001`. The recorded chain is now:

```text
PROD-001  --has_requirement-->  REQ-001  --allocated_to-->  COMP-001
```

Use **Follow connections** to inspect the recorded links. **Items table** reads the same working scope. The two links record requirement membership and allocation; they do not establish implementation completeness or a passing verification result.

### 5. Edit and reopen

Select `REQ-001`, choose **Edit item and connections**, then **Edit item**. Change its title to `User-adjustable brightness` and choose **Save item**. If a save conflicts, retain the proposal and review the current version before retrying.

Stop the server with Ctrl+C. Reopen the same database from the same directory:

```sh
npm start -- --db desk-light.sqlite
```

Search `REQ-001`: its updated title, the three items, the model and the two recorded links remain saved. Temporary folders, categories, view recipes and unsaved drafts do not survive a browser reload. Use an absolute `--db` path if starting from a different directory.

For the same model without a browser, see [using the headless core](developer-reference.md#use-the-headless-core). The executable example runs in a disposable database and verifies save, conflict, trace and reopen behavior:

```sh
node examples/product-model.ts
```

## Review evidence and change

Open **Evaluations**, choose a receipt, and compare its captured/current declared inputs. Orbit's `EVAL-R02` predates a change to `DES-01`. The recorded outcome stays unchanged while input freshness shows the difference. Freshness, technical outcome and missing execution evidence are different questions.

Record a native-input receipt, observe an external artifact or record a scoped review through the existing evidence controls. Unknown save outcomes pause further saves and offer **Refresh saved records**; inspect the result before explicitly continuing. A lost response is not evidence that nothing saved.

## Inspect a build

Open **Configurations** to read or capture exact native member revisions. Orbit includes `BUILD-R01 · selected native inputs`, which captures older firmware while the current design identity has moved forward. Captures are immutable selected sets, not proof of a complete BOM or release readiness.

## Organize and return

Expand a type on the **Development map**, open a folder where one has been explicitly authored in this session, or use **Browse folders**. Categories narrow records across types. Unassigned records remain directly discoverable; no folder hierarchy is inferred from an engineering trace.

Folder/category edits, their Undo operation and map **Save view** recipes are session-only. They do not change native engineering identities/links and are discarded on reload or project switching. The headless API/CLI's existing saved-view contracts are separate from these map recipes. Durable map organization is not delivered by this integration.

## Switch projects and resume

The project picker switches database context. It asks before reloading because unsaved drafts and temporary organization are not transferred. Each saved record, receipt, configuration and history remains in the database that owns it.

Every demo launch creates fresh isolated databases and prints a command to reopen both. For enduring examples, create two new directories:

```sh
npm run seed -- orbit --size integrated
npm run seed -- aster --size medical
npm start -- --db orbit/project.sqlite --guide orbit/tasks.json --secondary-db aster/project.sqlite --secondary-guide aster/tasks.json
```

Seeding refuses existing directories. Omit guides for ordinary projects. For one empty project, use `npm start -- --db my-project.sqlite`. Use **Configure model**, then **New item**. **Documentation** opens these guides inside the same interface; use **Return to map** to resume.

The map snapshot has a fixed bound of 10,000 records / 100,000 connections and rejects overflow explicitly. Visible graph and trace limits are separately disclosed. Paged headless queries remain available for larger datasets; this bound is not a performance or usability guarantee.

See [realistic examples](realistic-examples.md), the [industry workflow guides](industry-workflows/README.md), and the [developer reference](developer-reference.md) for project structures, sourced context and headless commands.
