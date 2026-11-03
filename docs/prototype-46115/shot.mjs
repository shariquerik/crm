// usage: node shot.mjs <out.png> <width> <height> <query> [clip=window|full] [setup=none|flow|composer|both]
import { chromium } from "/home/shariq/wt/ui-test/runner/node_modules/playwright/index.mjs";
import fs from "fs";
const [out, w, h, query, clip = "window", setup = "none", path = "/apps/crm/crm-lead"] = process.argv.slice(2);
const sid = fs.readFileSync("/home/shariq/wt/46115-frappe/.46115/sid.txt", "utf8").trim();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await ctx.addCookies([{ name: "sid", value: sid, domain: "desk.localhost", path: "/" }]);
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await page.goto(`http://desk.localhost:8115${path}?${query}`);
await page.waitForSelector("[data-standing-window], [data-standing-minimised]", { timeout: 30000 }).catch(() => errs.push("no window"));
await page.waitForTimeout(800);
if (process.env.EVAL) await page.evaluate(process.env.EVAL);
if (process.env.STEPS) for (const s of process.env.STEPS.split(";")) { await eval(s); await page.waitForTimeout(500); }
await page.waitForTimeout(600);
if (clip === "window") {
  const el = page.locator("[data-standing-row]");
  await el.screenshot({ path: out });
} else await page.screenshot({ path: out });
console.log(errs.slice(0, 5).join("\n") || "ok");
await browser.close();
