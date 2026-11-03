// The owner's three layouts per variant: 1440; 1024 with Flow docked right and the composer popped out; 390.
import { chromium } from "/home/shariq/wt/ui-test/runner/node_modules/playwright/index.mjs";
import fs from "fs";
const [variants = "A,B,C", step = "oncall", medium = "Twilio"] = process.argv.slice(2);
const dir = "/home/shariq/wt/46115-frappe/.46115/shots";
fs.mkdirSync(dir, { recursive: true });
const sid = fs.readFileSync("/home/shariq/wt/46115-frappe/.46115/sid.txt", "utf8").trim();
const browser = await chromium.launch();
const sizes = [["1440", 1440, 900], ["1024", 1024, 768], ["390", 390, 844]];
for (const v of variants.split(",")) for (const [name, w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "sid", value: sid, domain: "desk.localhost", path: "/" }]);
  const page = await ctx.newPage();
  await page.goto(`http://desk.localhost:8115/apps/crm/crm-lead/CRM-LEAD-2026-00002?variant=${v}&medium=${medium}&step=${step}`);
  await page.waitForSelector("[data-standing-window]", { timeout: 30000 });
  await page.waitForTimeout(5000);
  if (name === "1024") {
    await page.getByRole("button", { name: "Email", exact: true }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Pop out" }).click();
    await page.waitForTimeout(1200);
    const tag = fs.readFileSync("/home/shariq/wt/46115-frappe/.46115/flowtag.html", "utf8");
    await page.evaluate((tag) => {
      const tpl = document.createElement("div"); tpl.innerHTML = tag + "</script>";
      const old = tpl.firstChild, s = document.createElement("script");
      for (const a of old.attributes) s.setAttribute(a.name, a.value);
      document.body.append(s);
    }, tag);
    await page.waitForFunction(() => document.querySelector("flow-launcher")?.shadowRoot?.querySelector(".icon"), null, { timeout: 15000 });
    await page.evaluate(() => document.querySelector("flow-launcher").shadowRoot.querySelector(".icon").click());
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelector("flow-launcher").shadowRoot.querySelector(".dock").click());
    await page.waitForTimeout(1200);
  }
  await page.evaluate(() => { document.querySelector("[data-prototype-bar]").style.display = "none"; document.activeElement?.blur(); });
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  const hit = await page.evaluate(() => [...document.querySelectorAll("[data-standing-window] button")].map((b) => {
    const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return `${b.getAttribute("aria-label") || b.innerText.trim()}:${b.contains(top) ? "ok" : "COVERED"}${r.right > innerWidth || r.left < 0 ? ":OFFSCREEN" : ""}`;
  }).join(" "));
  await page.screenshot({ path: `${dir}/46115-${v}-${medium}-${step}-${name}.png` });
  console.log(v, name, hit);
  await ctx.close();
}
await browser.close();
