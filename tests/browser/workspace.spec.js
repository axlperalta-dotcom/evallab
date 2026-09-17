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

test("guide explains the workflow and privacy, supports keyboard navigation and preserves cases", async ({
  page,
  request,
}) => {
  const before = await (await request.get("/api/workspace")).json();
  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "Buscar casos" })
    .fill("estructura");
  const guideTab = page
    .getByRole("navigation")
    .getByRole("button", { name: "Guía", exact: true });
  await guideTab.click();
  await expect(guideTab).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Tu guía de EvalLab" }),
  ).toBeVisible();
  await page.screenshot({ path: ".data/guide-desktop.png", fullPage: false });
  const privacyJump = page.getByRole("button", {
    name: "Privacidad y uso",
    exact: true,
  });
  await privacyJump.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#guide-privacy")).toBeFocused();
  const privacy = page
    .locator(".guide-chapter")
    .filter({ has: page.locator("#guide-privacy") });
  for (const summary of await privacy.locator("summary").all()) {
    await summary.click();
  }
  await expect(
    privacy.getByText(/las ejecuciones anteriores conservan una copia/),
  ).toBeVisible();
  await expect(
    privacy.getByText(/La aplicación no ofrece inicio de sesión ni cifra/),
  ).toBeVisible();
  await expect(
    privacy.getByText(/EvalLab no incluye un filtro automático/),
  ).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(guideTab).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Las cuatro reglas", exact: true })
    .click();
  const jsonHelp = page
    .locator(".guide-questions details")
    .filter({ hasText: "JSON con campos" });
  await jsonHelp.locator("summary").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: /Volver al inicio de la guía/ })
    .click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: ".data/guide-mobile.png", fullPage: false });
  await page.getByRole("button", { name: /Ir a Casos para empezar/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tus casos de prueba" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Buscar casos" }),
  ).toHaveValue("estructura");
  await expect(page.locator("#main")).toBeFocused();
  expect(await (await request.get("/api/workspace")).json()).toEqual(before);
});

test("language preference translates the UI and guide without changing stored content", async ({
  page,
  request,
}) => {
  const before = await (await request.get("/api/workspace")).json();
  await page.addInitScript(() => {
    if (!localStorage.getItem("evallab.language"))
      localStorage.setItem("evallab.language", "unknown");
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page
    .getByRole("combobox", { name: "Idioma", exact: true })
    .selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Your test cases" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("EvalLab — Answers under the microscope");
  await expect(page.locator("#inspector-title")).toHaveText(
    before.cases[0].title,
  );
  await expect(page.locator(".answer-panel pre").first()).toHaveText(
    before.cases[0].answer_a,
  );
  await page.screenshot({ path: ".data/cases-english.png", fullPage: true });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Guide", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Privacy and use", exact: true })
    .click();
  const privacy = page
    .locator(".guide-questions details")
    .filter({ hasText: "Where is my data stored?" });
  await privacy.locator("summary").click();
  await expect(privacy).toContainText(
    "The app has no sign-in and does not encrypt the database.",
  );
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("es");
  await expect(page.locator(".guide-questions details[open]")).toContainText(
    "¿Dónde se guardan mis datos?",
  );
  await page
    .getByRole("combobox", { name: "Idioma", exact: true })
    .selectOption("en");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your test cases" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Language", exact: true }),
  ).toHaveValue("en");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: ".data/cases-english-mobile.png",
    fullPage: false,
  });
  expect(await (await request.get("/api/workspace")).json()).toEqual(before);
});

test("English forms, evaluation messages and comparisons preserve user text and unsaved reviews", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Idioma", exact: true })
    .selectOption("en");
  await page.getByRole("button", { name: "New case" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Case name").fill("Guía");
  await dialog.getByLabel("Original prompt").fill("Casos");
  await dialog
    .getByLabel("Answer A", { exact: true })
    .fill("Casos <script>literal</script>");
  await dialog.getByLabel("Answer B", { exact: true }).fill("Guía");
  await dialog.getByLabel("Must include", { exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Save case" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Enable between one and four rules",
  );
  await expect(dialog.getByLabel("Case name")).toHaveValue("Guía");
  await dialog.getByLabel("Must include", { exact: true }).check();
  await dialog.locator('[name="value-contains"]').fill("Guía");
  await dialog.getByRole("button", { name: "Save case" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#inspector-title")).toHaveText("Guía");
  await expect(page.locator("#case-inspector script")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Run evaluation", exact: true })
    .click();
  await dialog.getByLabel("Run name").fill("English workflow A");
  await dialog.getByRole("button", { name: /Evaluate \d+ cases/ }).click();
  const result = page.locator(".result-card").filter({ hasText: "Guía" });
  await result.locator("summary").click();
  await expect(result.locator("pre")).toHaveText(
    "Casos <script>literal</script>",
  );
  await expect(result).toContainText("Missing: Guía");
  await result.getByLabel("Assessment").selectOption("disagree");
  await result
    .getByLabel("Explanation")
    .fill("Guía, Casos: mi nota sin traducir.");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("es");
  await expect(result).toHaveAttribute("open", "");
  await expect(result.getByLabel("Valoración")).toHaveValue("disagree");
  await expect(result.getByLabel("Explicación")).toHaveValue(
    "Guía, Casos: mi nota sin traducir.",
  );
  await page
    .getByRole("combobox", { name: "Idioma", exact: true })
    .selectOption("en");
  await result.getByRole("button", { name: "Save review" }).click();
  await expect(result.locator("summary")).toContainText("Review: Disagree");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Runs/ })
    .click();
  await page
    .getByRole("button", { name: "Run evaluation", exact: true })
    .click();
  await dialog.getByLabel("Run name").fill("English workflow B");
  await dialog.getByLabel("Answers to test").selectOption("b");
  await dialog.getByRole("button", { name: /Evaluate \d+ cases/ }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Compare", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Compare runs" }),
  ).toBeVisible();
  const row = page.locator(".comparison-row").filter({ hasText: "Guía" });
  await expect(row).toContainText("Now passes");
  await row.locator("summary").click();
  await expect(row.locator("pre").first()).toHaveText(
    "Casos <script>literal</script>",
  );
  const workspace = await (await request.get("/api/workspace")).json();
  const createdCase = workspace.cases.find((item) => item.title === "Guía");
  expect(createdCase.rules[0].value).toEqual(["Guía"]);
  const run = workspace.runs.find((item) => item.name === "English workflow A");
  const original = await (await request.get(`/api/run?id=${run.id}`)).json();
  const saved = original.results.find(
    (item) => item.case_id === createdCase.id,
  );
  expect(saved.evaluation.checks[0].detail).toBe("Falta: Guía");
  expect(saved.review.note).toBe("Guía, Casos: mi nota sin traducir.");
  await request.post("/api/command", {
    data: { type: "delete_case", id: createdCase.id },
  });
});

test("language switching still works when browser storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Idioma", exact: true })
    .selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Your test cases" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Your language preference could not be saved",
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Guide", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your EvalLab guide" }),
  ).toBeVisible();
});
