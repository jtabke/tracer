# Define a custom project model

Use this advanced guide when you want to define your own vocabulary from scratch. For a first project, follow [Start your own project](getting-started.md#start-your-own-project) with the Engineering starter.

The connection walkthrough uses **Project settings → Advanced → Development map** and its complete item editor. **Return to map**, then **Graph / Matrix / History**, returns to the main workspace.

This example builds a fictional desk light with one requirement and one component. It uses the shared UI and your own SQLite file, with no seeded records.

## 1. Create and open the database

From the repository root, after installing Node.js 24.15 or newer:

```sh
npm ci
npm start -- --db desk-light.sqlite
```

Use a new filename in an existing directory. Tracer creates the file when it opens it. If the file already exists, this command opens its saved project; it does not reset it. Open the exact local URL printed in the terminal. Keep the terminal running while using the browser. **New item** becomes available after you save a model.

## 2. Define the product model

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

## 3. Create the three items

Choose **New item**. Select the type before entering its fields, enter the optional key and the values below, then choose **Create record**. Wait for the saved confirmation. The form clears after each successful creation, so repeat it for the next row.

| Item type     | Key        | title                 | statement                       |
| ------------- | ---------- | --------------------- | ------------------------------- |
| `product`     | `PROD-001` | Desk light            | Not a field on this type        |
| `requirement` | `REQ-001`  | Adjustable brightness | The user can adjust brightness. |
| `component`   | `COMP-001` | LED controller        | Not a field on this type        |

Keys are optional human labels, unique across active items in the project. Tracer assigns each item a permanent UUID; relationships refer to that UUID, so changing a title does not disconnect an item.

## 4. Connect actual items

Choose **Return to map**. Search `PROD-001`, open its matching result, and choose **Edit item and connections**. Expand **Connect an existing item**, select `has_requirement` under **Connection meaning**, and find `REQ-001` under **Find target**. Choose its target result, then **Connect selected target**. This tutorial's relationships have no additional fields to fill in.

Return to the map, search `REQ-001`, and open its item editor. Repeat the connection process with `allocated_to` and target `COMP-001`. The recorded chain is now:

```text
PROD-001  --has_requirement-->  REQ-001  --allocated_to-->  COMP-001
```

Use **Follow connections** to inspect the recorded links. **Items table** reads the same working scope. The two links record requirement membership and allocation; they do not establish implementation completeness or a passing verification result.

## 5. Edit and reopen

Select `REQ-001`, choose **Edit item and connections**, then **Edit item**. Change its title to `User-adjustable brightness` and choose **Save item**. If a save conflicts, retain the proposal and review the current version before retrying.

Stop the server with Ctrl+C. Reopen the same database from the same directory:

```sh
npm start -- --db desk-light.sqlite
```

Search `REQ-001`: its updated title, the three items, the model and the two recorded links remain saved. Development-map folders, categories and unnamed view recipes are session-only. Named Matrix recipes persist in the database; unsaved drafts do not survive a browser reload. Use an absolute `--db` path if starting from a different directory.

For the same model without a browser, see [using the headless core](../reference/developer-reference.md#use-the-headless-core). The executable example runs in a disposable database and verifies save, conflict, trace and reopen behavior:

```sh
node examples/product-model.ts
```
