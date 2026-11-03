// Contact sheet: every variant × step for one medium, open and minimised, at 1440x900.
import { chromium } from "/home/shariq/wt/ui-test/runner/node_modules/playwright/index.mjs";
import fs from "fs";
const [medium, known = "1", variants = "A,B,C", steps = "picker,incoming,ringing,oncall,ended"] = process.argv.slice(2);
const dir = "/home/shariq/wt/46115-frappe/.46115";
const sid = fs.readFileSync(`${dir}/sid.txt`, "utf8").trim();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addCookies([{ name: "sid", value: sid, domain: "desk.localhost", path: "/" }]);
const page = await ctx.newPage();
const cells = [];
for (const v of variants.split(",")) for (const st of steps.split(",")) {
  await page.goto(`http://desk.localhost:8115/apps/crm/crm-lead?variant=${v}&medium=${medium}&step=${st}&known=${known}`);
  await page.waitForSelector("[data-standing-window]", { timeout: 30000 });
  await page.waitForTimeout(700);
  const open = (await page.locator("[data-standing-row]").screenshot()).toString("base64");
  let pill = "";
  if (st !== "picker") {
    await page.click("[data-standing-minimise]");
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(400);
    pill = (await page.locator("[data-standing-row]").screenshot()).toString("base64");
  }
  cells.push({ v, st, open, pill });
}
const html = `<body style="margin:0;padding:16px;background:#e5e5e5;font:12px ui-monospace">
<div style="display:grid;grid-template-columns:repeat(${steps.split(",").length},auto);gap:16px;align-items:start">
${cells.map((c) => `<div><div>${c.v} · ${medium} · ${c.st}</div><img onload="this.style.width=this.naturalWidth/2+'px'" style="display:block" src="data:image/png;base64,${c.open}">${c.pill ? `<img onload="this.style.width=this.naturalWidth/2+'px'" style="display:block;margin-top:8px" src="data:image/png;base64,${c.pill}">` : ""}</div>`).join("")}
</div></body>`;
const sheet = await browser.newPage({ viewport: { width: 1600, height: 400 }, deviceScaleFactor: 1 });
await sheet.setContent(html); await sheet.waitForTimeout(300);
await sheet.screenshot({ path: `${dir}/sheet-${medium}-${known}.png`, fullPage: true });
await browser.close();
console.log("done");
