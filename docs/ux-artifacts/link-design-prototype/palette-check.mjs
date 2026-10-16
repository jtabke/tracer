import assert from "node:assert/strict";

const luminance = (color) =>
  color
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number)
    .map((v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);

// Focused checks of rendered, flat-color pairs; not an accessibility certification.
export async function checkFocus(page) {
  const colors = await page.evaluate(() => {
    const element = document.activeElement;
    const style = getComputedStyle(element);
    return {
      visible: element.matches(":focus-visible"),
      width: parseFloat(style.outlineWidth),
      outline: style.outlineColor,
      surface: getComputedStyle(document.querySelector("dialog")).backgroundColor,
    };
  });
  assert.equal(colors.visible, true);
  assert.ok(colors.width >= 3);
  const a = luminance(colors.outline),
    b = luminance(colors.surface);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(ratio >= 3);
  return { focusRatio: ratio.toFixed(2), outlinePixels: colors.width };
}

export async function checkPalette(page) {
  assert.equal(await page.locator("body").evaluate((e) => getComputedStyle(e).colorScheme), "dark");
  const selectors = [
    ".workspace-heading",
    ".breadcrumbs",
    ".scope-chip",
    ".gap-count",
    ".quiet-button",
    ".rail-current",
    ".brand",
    "h1",
    ".eyebrow",
    ".requirement-statement",
    ".req-title",
    ".selected .req-key",
    ".untraced",
    ".mapping-status.amber",
    ".mapping-status.purple",
    ".view-control button[aria-pressed=true]",
    ".inspector .primary-button",
    ".session-note",
    ".remaining-work",
    ".remaining-work small",
    ".mapping-button",
    ".undo-link",
    ".parent-intent h2",
    ".parent-intent p",
    ".contribution-statement",
    ".lane-selection",
    ".contribution-remainder",
    ".partial-scope",
    ".outdated-scope",
    ".artifact-identity",
    ".mapping-qualifier",
    ".context-action",
    ".artifact-select",
    ".relationship-focus",
    ".inspector-guidance",
  ];
  if (await page.locator("dialog[open]").count())
    selectors.push(
      ".picker-header h2",
      ".picker-context",
      ".picker-context strong",
      ".picker-context p",
      ".search-field input",
      ".artifact-title",
      ".artifact-result small",
      ".draft-line",
      ".secondary-button",
      ".source-preview",
    );
  const samples = await samplePalette(page, selectors);
  validateTextContrast(samples);
  if (await page.locator("dialog[open]").count()) {
    const placeholder = await page
      .locator("#search")
      .evaluate((e) => getComputedStyle(e, "::placeholder").color);
    assert.equal(
      placeholder,
      await page.locator("body").evaluate((e) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--muted)";
        e.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }),
    );
  }
  return {
    treatment: await page.locator("body").getAttribute("data-treatment"),
    sampledPairs: samples.length,
    minimumTextRatio: Math.min(...samples.map((s) => s.ratio)).toFixed(2),
  };
}

async function samplePalette(page, selectors) {
  const samples = [];
  for (const selector of selectors) {
    const element = page.locator(selector).first();
    if (!(await element.count()) || !(await element.isVisible())) continue;
    samples.push(
      await element.evaluate((e, selector) => {
        let ancestor = e,
          background;
        while (ancestor) {
          const candidate = getComputedStyle(ancestor).backgroundColor;
          if (!candidate.includes("rgba") || !candidate.endsWith(", 0)")) {
            background = candidate;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        const foreground = getComputedStyle(e).color;
        return {
          selector,
          foreground,
          background,
        };
      }, selector),
    );
  }
  return samples;
}
function validateTextContrast(samples) {
  for (const sample of samples) {
    const a = luminance(sample.foreground),
      b = luminance(sample.background);
    sample.ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(
      sample.ratio >= 4.5,
      `${sample.selector}: ${sample.ratio.toFixed(2)} (${sample.foreground} on ${sample.background})`,
    );
  }
}
