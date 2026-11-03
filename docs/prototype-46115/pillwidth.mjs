import { chromium } from "/home/shariq/wt/ui-test/runner/node_modules/playwright/index.mjs";
import fs from "fs";
const sid = fs.readFileSync("/home/shariq/wt/46115-frappe/.46115/sid.txt", "utf8").trim();
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "sid", value: sid, domain: "desk.localhost", path: "/" }]);
const page = await ctx.newPage();
await page.goto("http://desk.localhost:8115/apps/crm/crm-lead?variant=C&medium=Twilio&step=oncall&known=1");
await page.waitForSelector("[data-standing-minimise]"); await page.waitForTimeout(800);
await page.click("[data-standing-minimise]");
const w = [];
for (let i = 0; i < 12; i++) { w.push(await page.evaluate(() => { const p = document.querySelector("[data-standing-minimised]"); return getComputedStyle(p.querySelector("[data-standing-restore]")).fontFeatureSettings + p.querySelector("[data-standing-restore]").innerText + "=" + p.getBoundingClientRect().width.toFixed(1); })); await page.waitForTimeout(1000); }
console.log(w.join(" ")); await b.close();
