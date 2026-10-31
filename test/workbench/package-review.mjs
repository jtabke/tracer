import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { reviewFolder } from "./verification-fixtures.mjs";
const folder = reviewFolder(),
  manifest = JSON.parse(await readFile(path.join(folder, "manifest.json"), "utf8"));
const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const titles = [
  "Matching captured inputs",
  "Modify the requirement",
  "Inspect the saved semantic diff",
  "Investigate recorded dependencies",
  "Compare captured and current evidence inputs",
  "Assess and draft the decision",
  "Record the decision",
  "Return to the investigation",
  "Verify persistence after reload",
];
const sequence = [
  "Prepared fictional receipt captures PRS-02 v2 at r399. Open assessment for PRS-02.",
  "Matrix → double-click PRS-02 → change 10–40°C to 5–45°C → Save.",
  "History → inspect r400.",
  "Explore potential impact → inspect the graph and declared-evaluation freshness.",
  "Assess evidence → select the non-superseded RUN-01 evaluation → compare PRS-02 v2 with v3.",
  "Review receipt → Needs reevaluation → enter rationale. The verification also visits Matrix and resumes this same draft.",
  "Record review decision. Native head stays r400; evidence history receives the immutable review.",
  "Back to investigation → the same twenty native links and original change remain in scope.",
  "Reload → find PRS-02 → Assess evidence. The exact review ID and rationale are read from the database.",
];
const css = `*{box-sizing:border-box}body{margin:0;background:#f2f0eb;color:#20292e;font:15px/1.5 system-ui,sans-serif}main{max-width:1680px;margin:auto;padding:32px}h1{font-size:32px;letter-spacing:-.7px;margin:0 0 8px}h2{font-size:23px;margin:0 0 10px}p{color:#526069;max-width:1150px}a{color:#315b52;text-underline-offset:3px}nav{display:flex;gap:18px;flex-wrap:wrap;margin:24px 0}.note{background:#e4e9e2;border-left:3px solid #73836a;padding:16px 20px;margin:24px 0}.note p{margin:6px 0}.stage{padding:30px 0;border-top:1px solid #d5dad6;scroll-margin-top:16px}.pair{display:grid;grid-template-columns:1440fr 680fr;gap:18px;align-items:start}figure{margin:0;background:white;border:1px solid #d5dad6;border-radius:8px;overflow:hidden}figure>a{display:block;background:#172126}img{display:block;width:100%;height:auto}figcaption{padding:14px 16px;font-size:13px}figcaption strong{display:block;font-size:14px}figcaption p{margin:6px 0}.sequence{font-size:13px}.contact main{max-width:none;padding:26px}.contact h1{font-size:28px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:24px}.contact figure>a{height:370px;display:flex;align-items:center;justify-content:center}.contact img{width:100%;height:100%;object-fit:contain}.contact figcaption{min-height:85px}@media(max-width:850px){main{padding:20px}.pair,.grid{grid-template-columns:1fr}}`;
const page = (body, cls = "") =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tracer · Modify → investigate → assess → record decision</title><style>${css}</style></head><body class="${cls}"><main>${body}</main></body></html>`;
const card = (e) =>
  `<figure><a href="${e.file}"><img src="${e.file}" alt="${esc(titles[e.step])} · ${e.viewport.width}px"></a><figcaption><strong>${e.label === "desktop" ? "Desktop" : "680px"} · native r${e.revision}</strong><p>${esc(e.caption)}</p></figcaption></figure>`;
const intro = `<h1>Tracer · Modify → investigate → assess → record decision</h1><p>${manifest.entries.length} full-resolution screens · 1440 × 1000 and 680 × 900 · ${esc(manifest.capturedAt)}</p>`;
const sections = titles
  .map(
    (title, step) =>
      `<section class="stage" id="step-${step}"><h2>${String(step).padStart(2, "0")} · ${title}</h2><p class="sequence">${esc(sequence[step])}</p><div class="pair">${["desktop", "narrow"].map((label) => card(manifest.entries.find((e) => e.step === step && e.label === label))).join("")}</div></section>`,
  )
  .join("");
await writeFile(
  path.join(folder, "index.html"),
  page(
    `${intro}<nav><a href="#step-1">Modify</a><a href="#step-3">Investigate</a><a href="#step-4">Compare inputs</a><a href="#step-5">Assess</a><a href="#step-6">Recorded decision</a><a href="manifest.json">Capture evidence</a></nav><div class="note"><p><strong>One persisted loop.</strong> PRS-02 changes from 10–40°C to 5–45°C at r400. A real receipt captured its earlier v2 statement; the core comparison now identifies v3 as changed. The engineer records Needs reevaluation with a rationale. Input drift and original outcome remain unchanged by that judgment.</p><p>Two independent fictional Aster databases were prepared with an explicitly simulated evaluation matching the pre-edit state. The earlier receipt is superseded, retained and disclosed. These are actual native edits, comparisons and immutable review writes—not physical test evidence or an assessment inferred from graph proximity. Verification uses disposable databases; the persistent review server is never a write target.</p><p>Click any screenshot for its original PNG. The gallery and images work offline after extraction. Draft frames are followed by saved results and a reload check. Separate conflict/recovery checks cover stale inputs, unknown inputs, failed reads and lost responses; screenshots do not establish representative-user speed or production acceptance.</p></div>${sections}`,
  ),
);
for (const label of ["desktop", "narrow"]) {
  const samples = [1, 2, 3, 4, 5, 6];
  await writeFile(
    path.join(folder, `overview-${label}.html`),
    page(
      `<h1>Tracer · ${label === "desktop" ? "Desktop · 1440 × 1000" : "680px · 680 × 900"}</h1><p>Modify → investigate → assess → record decision · saved native edit and immutable review</p><div class="grid">${samples
        .map((step) => {
          const e = manifest.entries.find((e) => e.label === label && e.step === step);
          return `<figure><a href="${e.file}"><img src="${e.file}" alt="${esc(titles[step])}"></a><figcaption><strong>${titles[step]}</strong><p>Native r${e.revision}</p></figcaption></figure>`;
        })
        .join("")}</div>`,
      "contact",
    ),
  );
}
const browser = await chromium.launch();
try {
  const tab = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
  for (const label of ["desktop", "narrow"]) {
    await tab.setViewportSize({ width: label === "desktop" ? 1800 : 1440, height: 1000 });
    await tab.goto("file://" + path.join(folder, `overview-${label}.html`));
    await tab.evaluate(async () => Promise.all([...document.images].map((i) => i.decode())));
    await tab.screenshot({ path: path.join(folder, `overview-${label}.png`), fullPage: true });
  }
  await tab.goto("file://" + path.join(folder, "index.html"));
  await tab.evaluate(async () => Promise.all([...document.images].map((i) => i.decode())));
  console.log(
    "Gallery and overview sheets verified: " +
      (await tab.locator("img").count()) +
      " original screenshots.",
  );
} finally {
  await browser.close();
}
