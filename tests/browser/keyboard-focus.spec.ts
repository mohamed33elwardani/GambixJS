import { expect, test } from "@playwright/test";

test("keyboard shortcuts affect only the last active board and ignore text inputs", async ({
  page,
}) => {
  await page.goto("/tests/browser/keyboard-focus.html");

  await page.locator("#board-a .gambix-wrapper").click();
  await page.keyboard.down("Shift");
  await page.keyboard.up("Shift");
  await expect(page.locator("#events-a")).toHaveText("Shift");
  await expect(page.locator("#events-b")).toHaveText("");

  await page.locator("#note").focus();
  await page.keyboard.down("Control");
  await page.keyboard.up("Control");
  await expect(page.locator("#events-a")).toHaveText("Shift");
});
