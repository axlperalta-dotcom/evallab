import { test, expect } from "@playwright/test";

test("evaluate A and B, review a false positive, preserve history and compare criteria fairly", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tus casos de prueba" }),
  ).toBeVisible();
  await page.screenshot({ path: ".data/cases-desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "Ejecutar evaluación", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre de la ejecución").fill("Primera respuesta A");
  await dialog.getByRole("button", { name: "Evaluar 4 casos" }).click();
  await expect(
    page.getByRole("heading", { name: "Primera respuesta A" }),
  ).toBeVisible();
  await page.screenshot({ path: ".data/run-desktop.png", fullPage: true });
  const card = page
    .locator("details")
    .filter({ hasText: "Evitar promesas absolutas" });
  await card.locator("summary").click();
  await expect(card.locator("summary")).toContainText("No cumple");
  await card.getByLabel("Valoración").selectOption("disagree");
  await card
    .getByLabel("Explicación")
    .fill("La frase está negada; la regla necesita contexto.");
  await card.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(card.locator("summary")).toContainText("En desacuerdo");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Ejecuciones/ })
    .click();
  await page.getByRole("button", { name: /Primera respuesta A/ }).click();
  await card.locator("summary").click();
  await expect(card.getByLabel("Explicación")).toHaveValue(
    "La frase está negada; la regla necesita contexto.",
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Ejecuciones/ })
    .click();
  await page
    .getByRole("button", { name: "Ejecutar evaluación", exact: true })
    .click();
  await dialog.getByLabel("Nombre de la ejecución").fill("Segunda respuesta B");
  await dialog.getByLabel("Respuestas que quieres probar").selectOption("b");
  await dialog.getByRole("button", { name: "Evaluar 4 casos" }).click();
  await expect(
    page.getByRole("heading", { name: "Segunda respuesta B" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Comparar/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mismo porcentaje, revisa cada caso." }),
  ).toBeVisible();
  await expect(page.getByText("Ahora cumple", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Ahora no cumple", { exact: true })).toHaveCount(
    2,
  );
  await expect(page.getByRole("status")).toBeHidden({ timeout: 6000 });
  await page.screenshot({
    path: ".data/comparison-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Casos/ })
    .click();
  await page
    .locator(".case-card")
    .filter({ hasText: "Una respuesta breve" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: /Editar caso/ }).click();
  await dialog
    .getByLabel("Instrucción original")
    .fill("Ahora se evalúa una instrucción diferente.");
  await dialog.getByRole("button", { name: "Guardar caso" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Ejecutar evaluación", exact: true })
    .click();
  await dialog.getByLabel("Nombre de la ejecución").fill("Criterios cambiados");
  await dialog.getByRole("button", { name: "Evaluar 4 casos" }).click();
  await expect(
    page.getByRole("heading", { name: "Criterios cambiados" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Comparar/ })
    .click();
  await expect(page.getByText(/Los casos o criterios cambiaron/)).toBeVisible();
  await expect(page.locator(".comparison-callout")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("create, validate, edit and delete a case on mobile without executing markup", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tus casos de prueba" }),
  ).toBeVisible();
  await page.screenshot({ path: ".data/cases-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Nuevo caso" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre del caso").fill("Prueba <script> literal");
  await dialog.getByLabel("Instrucción original").fill("Incluye un saludo.");
  await dialog.getByLabel("Respuesta A", { exact: true }).fill("Hola");
  await dialog.getByLabel("Respuesta B", { exact: true }).fill("Adiós");
  await dialog.getByLabel("Debe incluir", { exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Guardar caso" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Activa entre una y cuatro reglas",
  );
  await expect(dialog.getByLabel("Nombre del caso")).toHaveValue(
    "Prueba <script> literal",
  );
  await dialog.getByLabel("Debe incluir", { exact: true }).check();
  await dialog.locator('[name="value-contains"]').fill("Hola");
  await dialog.getByRole("button", { name: "Guardar caso" }).click();
  await expect(dialog).not.toBeVisible();
  const card = page
    .locator(".case-card")
    .filter({ hasText: "Prueba <script> literal" });
  await expect(card).toBeVisible();
  await expect(card.locator("script")).toHaveCount(0);
  await card.getByRole("button").click();
  await page.getByRole("button", { name: /Editar caso/ }).click();
  await dialog.getByLabel("Incluir en las próximas ejecuciones").uncheck();
  await dialog.getByRole("button", { name: "Guardar caso" }).click();
  await expect(card).toContainText("Pausado");
  await card.getByRole("button").click();
  await page.getByRole("button", { name: /Editar caso/ }).click();
  await dialog.getByRole("button", { name: "Eliminar caso" }).click();
  await dialog.getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(card).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Nuevo caso" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("mobile navigation accommodates fallback fonts and narrow viewports", async ({
  page,
}) => {
  // Linux does not have Segoe UI. Exercise a fallback font on Windows too.
  await page.route("**/styles.css", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      'Inter, "Segoe UI", Arial, sans-serif',
      "Arial, sans-serif",
    );
    await route.fulfill({ response, body });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tus casos de prueba" }),
  ).toBeVisible();
  for (const width of [390, 360, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const overflowing = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && (box.right > innerWidth + 1 || box.left < -1);
        })
        .map((element) => element.tagName + "." + element.className),
    );
    expect(overflowing).toEqual([]);
    await expect(
      page.getByRole("navigation").getByRole("button", { name: "Comparar" }),
    ).toBeVisible();
  }
});

test("backend rejects rule errors and keeps automatic scoring separate from review", async ({
  request,
}) => {
  const invalid = await request.post("/api/command", {
    data: { type: "run", name: "Invalid", variant: "z" },
  });
  expect(invalid.status()).toBe(400);
  const blocked = await request.post("/api/command", {
    headers: { Origin: "https://external.example" },
    data: {},
  });
  expect(blocked.status()).toBe(403);
  const created = await request.post("/api/command", {
    data: { type: "run", name: "API verification", variant: "a" },
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  const run = await (await request.get(`/api/run?id=${id}`)).json();
  expect(run.results).toHaveLength(4);
  expect(run.summary.error).toBe(0);
});

test("case workbench searches, filters and preserves selection without changing data", async ({
  page,
  request,
}) => {
  const before = await (await request.get("/api/workspace")).json();
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Buscar casos" });
  await search.fill("estructura");
  await expect(search).toBeFocused();
  await expect(page.locator(".case-card")).toHaveCount(1);
  await page.locator(".case-select").press("Enter");
  await expect(page.locator("#inspector-title")).toHaveText(
    "La estructura también importa",
  );
  await expect(page.locator("#inspector-title")).toBeFocused();
  await expect(page.locator(".answer-panel")).toHaveCount(2);
  await expect(page.locator(".criteria-list")).toContainText("JSON");
  await search.fill("zzzzsinresultados");
  await expect(
    page.getByRole("heading", { name: "No hay casos que mostrar" }),
  ).toBeVisible();
  await expect(page.locator(".answer-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Mostrar todos los casos" }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await expect(page.locator(".case-card")).toHaveCount(4);
  await page.getByLabel("Estado de los casos").selectOption("paused");
  await expect(page.locator(".case-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Mostrar todos los casos" }).click();
  await search.fill("absolutas");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Ejecuciones/ })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Casos/ })
    .click();
  await expect(search).toHaveValue("absolutas");
  await expect(page.locator("#inspector-title")).toHaveText(
    "Evitar promesas absolutas",
  );
  const after = await (await request.get("/api/workspace")).json();
  expect(after).toEqual(before);
});

test("comparison exposes saved answers and remains usable on a narrow screen", async ({
  page,
  request,
}) => {
  const runIds = [];
  for (const variant of ["a", "b"]) {
    const response = await request.post("/api/command", {
      data: { type: "run", name: `Comparación móvil ${variant}`, variant },
    });
    expect(response.ok()).toBe(true);
    runIds.push((await response.json()).id);
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Comparar/ })
    .click();
  await page
    .getByRole("combobox", { name: "Ejecución de referencia", exact: true })
    .selectOption(runIds[0]);
  await page
    .getByRole("combobox", { name: "Ejecución a comparar", exact: true })
    .selectOption(runIds[1]);
  const row = page
    .locator(".comparison-row")
    .filter({ hasText: "La estructura también importa" });
  await row.locator("summary").click();
  await expect(row.locator(".answer-panel")).toHaveCount(2);
  await expect(row.locator(".evidence-rules").first()).toContainText("JSON");
  const saved = await (await request.get(`/api/run?id=${runIds[0]}`)).json();
  const original = saved.results.find(
    (result) => result.snapshot.title === "La estructura también importa",
  );
  await expect(row.locator("pre").first()).toHaveText(original.answer);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".data/comparison-mobile.png",
    fullPage: true,
  });
});
