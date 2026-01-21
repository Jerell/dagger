import { Locator, Page } from "playwright";
import { selectSubmenuItem } from "./selectSubmenuItem";

type ModuleSpec = {
  moduleType: string | RegExp;
  moduleName: string | RegExp;
  properties?: ModuleProperties;
};

type ModuleProperties = Record<string, string | number>;

export async function buildBranch(
  page: Page,
  modules: ModuleSpec[],
  { typeCharacters = false }: { typeCharacters?: boolean } = {},
) {
  const sourceModule = modules[0];
  const transportOrSinkModules = modules.slice(1);

  await addSourceModule(page, sourceModule);
  const branch = page.getByTitle("branch").last();

  if (sourceModule.properties) {
    await setModuleProperties(
      branch,
      0,
      sourceModule.properties,
      typeCharacters,
    );
  }

  let i = 1;
  for (const nextModule of transportOrSinkModules) {
    await addModule(branch, nextModule);
    if (nextModule.properties) {
      await setModuleProperties(
        branch,
        i,
        nextModule.properties,
        typeCharacters,
      );
    }
    i++;
  }
}

async function addSourceModule(page: Page, module: ModuleSpec) {
  await page.getByRole("button", { name: "new-source-module" }).click();
  await selectSubmenuItem(page, module.moduleType, module.moduleName);
}

async function addModule(branch: Locator, module: ModuleSpec) {
  await branch.getByRole("button", { name: "new-module" }).click();
  await selectSubmenuItem(branch.page(), module.moduleType, module.moduleName);
}

async function setModuleProperties(
  branch: Locator,
  moduleIndex: number,
  properties: ModuleProperties,
  typeCharacters?: boolean,
) {
  // Open edit pane
  const cell = branch.getByTestId("cell").nth(moduleIndex);
  await cell.hover();
  await cell.getByRole("button", { name: "Edit" }).click();

  // Find and fill each input
  const page = branch.page();
  for (const [key, value] of Object.entries(properties)) {
    const input = page.getByLabel(key);
    const inputTag = await input.first().evaluate((el) => el.tagName);
    if (inputTag === "SELECT") {
      // We need to select the item with the given name, rather than enter it into the box
      input.selectOption(value.toString());
    } else {
      if (typeCharacters) {
        await input.clear();
        await input.pressSequentially(value.toString());
      } else {
        await input.fill(value.toString());
      }
    }
  }
  // Apply
  await page.getByRole("button", { name: "Apply" }).click();

  // Click close button
  await page.getByLabel("close").click();
}
