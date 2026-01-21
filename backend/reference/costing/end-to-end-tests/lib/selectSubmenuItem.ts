import { Page } from "playwright";

export async function selectSubmenuItem(
  page: Page,
  menuItemName: string | RegExp,
  submenuItemName: string | RegExp,
) {
  // radix-ui's dropdown has an issue with playwright where the
  // mouse movement causes the dropdown to be dismissed too fast.
  // This is likely because the mouse briefly exits the dropdown, which
  // to radix looks like a dismiss. To resolve this, we move the mouse
  // manually into the top right of the menu box (with 5px padding), _then_ click the item,
  // which moves the mouse entirely within the box of the submenu

  // Click the menu item
  const menuItem = page.getByRole("menuitem", { name: menuItemName });
  const menuItemBoundingBox = (await menuItem.boundingBox())!;
  await menuItem.click();

  // Find the submenu's bounding box
  const submenuBoundingBox = (await page
    .getByRole("menu")
    .nth(1)
    .boundingBox())!;

  // Move the mouse to the right of the submenu's box, inline with the menu item
  await page.mouse.move(
    submenuBoundingBox.x + submenuBoundingBox.width - 5,
    menuItemBoundingBox.y + menuItemBoundingBox.height / 2,
    { steps: 2 },
  );

  // Find the target submenu item
  const item = page
    .getByRole("menuitem", { disabled: false })
    .filter({ hasText: submenuItemName });

  // Scroll item into view
  await item.scrollIntoViewIfNeeded();

  // Click on the submenu item
  await item.click();
}
