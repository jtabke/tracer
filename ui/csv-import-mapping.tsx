import type { SchemaObject, TypeDefinition } from "../src/core/model.ts";
import type { CsvTable } from "../src/core/csv.ts";
import type {
  CsvFieldMapping,
  CsvImportMapping,
  CsvLinkMapping,
} from "../src/core/csv-import-types.ts";

function matchingColumn(table: CsvTable, name: string) {
  const matches = table.headers.flatMap((header, index) =>
    header.toLowerCase() === name.toLowerCase() ? [index] : [],
  );
  return matches.length === 1 ? matches[0] : -1;
}
function matchingFields(table: CsvTable, definition?: TypeDefinition): CsvFieldMapping {
  return Object.fromEntries(
    Object.keys(definition?.fields ?? {}).flatMap((name) => {
      const column = matchingColumn(table, name);
      return column < 0 ? [] : [[name, column]];
    }),
  );
}
export function initialCsvMapping(
  table: CsvTable,
  kind: CsvImportMapping["kind"],
): CsvImportMapping {
  const shared = { type: "", fields: {} };
  return kind === "records"
    ? { kind, ...shared, keyColumn: matchingColumn(table, "key"), links: [] }
    : {
        kind,
        ...shared,
        sourceColumn: matchingColumn(table, "source"),
        targetColumn: matchingColumn(table, "target"),
      };
}
function Column({
  table,
  value,
  label,
  empty = "Choose column",
  onChange,
}: {
  table: CsvTable;
  value: number;
  label: string;
  empty?: string;
  onChange(value: number): void;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value < 0 ? "" : value}
        onChange={(event) => onChange(event.target.value === "" ? -1 : Number(event.target.value))}
      >
        <option value="">{empty}</option>
        {table.headers.map((header, index) => (
          <option key={header} value={index}>
            {header}
          </option>
        ))}
      </select>
    </label>
  );
}
function FieldColumns({
  table,
  definition,
  value,
  onChange,
}: {
  table: CsvTable;
  definition?: TypeDefinition;
  value: CsvFieldMapping;
  onChange(value: CsvFieldMapping): void;
}) {
  return (
    <div className="csv-field-columns">
      {Object.entries(definition?.fields ?? {}).map(([name, field]) => (
        <Column
          key={name}
          table={table}
          label={`${name} (${field.type}${field.required ? ", required" : ""})`}
          value={Object.hasOwn(value, name) ? value[name] : -1}
          empty="Do not import"
          onChange={(column) => {
            const next = { ...value };
            if (column < 0) delete next[name];
            else
              Object.defineProperty(next, name, {
                value: column,
                enumerable: true,
                configurable: true,
                writable: true,
              });
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}
function TypeChoice({
  types,
  value,
  label,
  onChange,
}: {
  types: string[];
  value: string;
  label: string;
  onChange(value: string): void;
}) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose type</option>
        {types.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    </label>
  );
}
function LinkColumns({
  table,
  schema,
  value,
  types,
  onChange,
}: {
  table: CsvTable;
  schema: SchemaObject;
  value: CsvLinkMapping;
  types: string[];
  onChange(value: CsvLinkMapping): void;
}) {
  return (
    <>
      <TypeChoice
        label="Relationship type"
        types={types}
        value={value.type}
        onChange={(type) =>
          onChange({
            ...value,
            type,
            fields: matchingFields(table, schema.relationshipTypes[type]),
          })
        }
      />
      <Column
        label="Target key column"
        table={table}
        value={value.targetColumn}
        onChange={(targetColumn) => onChange({ ...value, targetColumn })}
      />
      <FieldColumns
        table={table}
        definition={schema.relationshipTypes[value.type]}
        value={value.fields}
        onChange={(fields) => onChange({ ...value, fields })}
      />
    </>
  );
}
function RecordLinks({
  table,
  schema,
  value,
  onChange,
}: MappingProps & { value: Extract<CsvImportMapping, { kind: "records" }> }) {
  const types = Object.keys(schema.relationshipTypes).filter(
    (type) =>
      !schema.relationshipTypes[type].source ||
      schema.relationshipTypes[type].source!.includes(value.type),
  );
  return (
    <div className="csv-record-links">
      <h3>Links from imported records</h3>
      <p>
        Each mapped cell contains one exact target key. An empty cell creates no link. Targets can
        be existing records or records in this file.
      </p>
      {value.links.map((link, index) => (
        <fieldset key={index}>
          <legend>Link {index + 1}</legend>
          <LinkColumns
            table={table}
            schema={schema}
            types={types}
            value={link}
            onChange={(next) =>
              onChange({
                ...value,
                links: value.links.map((item, position) => (position === index ? next : item)),
              })
            }
          />
          <button
            type="button"
            onClick={() =>
              onChange({ ...value, links: value.links.filter((_, position) => position !== index) })
            }
          >
            Remove link {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={!value.type || !types.length || value.links.length >= 8}
        onClick={() =>
          onChange({
            ...value,
            links: [...value.links, { type: "", targetColumn: -1, fields: {} }],
          })
        }
      >
        Add link mapping
      </button>
    </div>
  );
}
type MappingProps = {
  table: CsvTable;
  schema: SchemaObject;
  value: CsvImportMapping;
  onChange(value: CsvImportMapping): void;
};
export function CsvMapping({ table, schema, value, onChange }: MappingProps) {
  return (
    <div className="csv-mapping">
      <h3>Map columns</h3>
      <label>
        Import as
        <select
          aria-label="Import as"
          value={value.kind}
          onChange={(event) =>
            onChange(initialCsvMapping(table, event.target.value as CsvImportMapping["kind"]))
          }
        >
          <option value="records">New records, with optional links</option>
          <option value="links">Links between existing records</option>
        </select>
      </label>
      {value.kind === "records" ? (
        <>
          <TypeChoice
            label="Record type"
            types={Object.keys(schema.entityTypes)}
            value={value.type}
            onChange={(type) =>
              onChange({
                ...value,
                type,
                fields: matchingFields(table, schema.entityTypes[type]),
                links: [],
              })
            }
          />
          <Column
            label="Stable key column"
            table={table}
            value={value.keyColumn}
            onChange={(keyColumn) => onChange({ ...value, keyColumn })}
          />
          <FieldColumns
            table={table}
            definition={schema.entityTypes[value.type]}
            value={value.fields}
            onChange={(fields) => onChange({ ...value, fields })}
          />
          <RecordLinks table={table} schema={schema} value={value} onChange={onChange} />
        </>
      ) : (
        <>
          <Column
            label="Source key column"
            table={table}
            value={value.sourceColumn}
            onChange={(sourceColumn) => onChange({ ...value, sourceColumn })}
          />
          <LinkColumns
            table={table}
            schema={schema}
            types={Object.keys(schema.relationshipTypes)}
            value={value}
            onChange={(next) => onChange({ ...value, ...next })}
          />
        </>
      )}
    </div>
  );
}
