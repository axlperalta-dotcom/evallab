import { t, language, setLanguage, localizeMessage } from "/i18n.js";
const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const labels = {
  cases: "Casos",
  runs: "Ejecuciones",
  compare: "Comparar",
  guide: "Guía",
};
const statuses = {
  passed: "Cumple",
  failed: "No cumple",
  error: "Error del evaluador",
};
const reviewLabels = {
  agree: "De acuerdo",
  disagree: "En desacuerdo",
  unsure: "Por revisar",
};
let state = { cases: [], runs: [] },
  view = "cases",
  selectedRun = null,
  selectedCase = null,
  caseQuery = "",
  caseFilter = "all",
  comparison = [],
  busy = false,
  toastTimer,
  renderToken = 0;
const dialog = $("#dialog");
// Capture only the fixed shell before user content is loaded. Keeping the
// original copy lets us translate both ways without replacing live controls.
const shellText = [];
const shellAttributes = [];
for (const root of document.querySelectorAll(
  ".masthead, .navigation-bar, .page-footer, .skip-link, .close, .loading, title",
)) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest("#language"))
      shellText.push([node, node.textContent]);
  }
  for (const element of [root, ...root.querySelectorAll("[aria-label]")]) {
    if (element.hasAttribute("aria-label"))
      shellAttributes.push([element, element.getAttribute("aria-label")]);
  }
}
function translateShell() {
  document.documentElement.lang = language();
  for (const [node, source] of shellText) {
    const key = source.trim();
    if (key) node.textContent = source.replace(key, () => t(key));
  }
  for (const [element, source] of shellAttributes)
    element.setAttribute("aria-label", t(source));
  $("#language").value = language();
}
translateShell();

async function changeLanguage(value) {
  const previousView = view,
    previousRun = selectedRun;
  const openDetails = [...document.querySelectorAll("#main details")].map(
    (item) => item.open,
  );
  const drafts = [...document.querySelectorAll("#main form")].map((form) => ({
    key: form.id || form.dataset.result,
    fields: [...form.querySelectorAll("input, select, textarea")].map(
      (field) => ({
        name: field.name,
        value: field.value,
        checked: field.checked,
      }),
    ),
  }));
  const scroll = window.scrollY;
  const persisted = setLanguage(value);
  translateShell();
  $("#toast").hidden = true;
  await render();
  if (view === previousView && selectedRun === previousRun) {
    document.querySelectorAll("#main details").forEach((item, index) => {
      item.open = openDetails[index] || false;
    });
    for (const form of document.querySelectorAll("#main form")) {
      const saved = drafts.find(
        (item) => item.key === (form.id || form.dataset.result),
      );
      for (const field of form.querySelectorAll("input, select, textarea")) {
        const draft = saved?.fields.find((item) => item.name === field.name);
        if (draft) {
          field.value = draft.value;
          if (field.type === "checkbox") field.checked = draft.checked;
        }
      }
    }
    window.scrollTo(0, scroll);
  }
  if (!persisted)
    notice(
      t("No se pudo recordar el idioma. Se aplicará solo en esta pestaña."),
    );
}
const badge = (status) =>
  `<span class="badge ${esc(status)}"><span></span>${esc(t(statuses[status] || status))}</span>`;
const date = (value) =>
  new Date(value).toLocaleString(language() === "en" ? "en-US" : "es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

async function api(path, command) {
  const response = await fetch(
    path,
    command
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        }
      : { cache: "no-store" },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || t("No se pudo completar la operación."));
  return data;
}
function notice(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4500);
}
function showError(error) {
  if (dialog.open) {
    $("#form-error").textContent = localizeMessage(error.message);
    $("#form-error").hidden = false;
    $("#form-error").scrollIntoView({ block: "nearest" });
  } else {
    const node = document.createElement("p");
    node.className = "alert error";
    node.role = "alert";
    node.textContent = localizeMessage(error.message);
    $("#main").prepend(node);
  }
}
async function write(command) {
  if (busy) return null;
  busy = true;
  $("#language").disabled = true;
  $("#form-error").hidden = true;
  const buttons = [
    ...document.querySelectorAll("button[data-write], button[type=submit]"),
  ];
  const prior = buttons.map((b) => b.disabled);
  buttons.forEach((b) => {
    b.disabled = true;
  });
  try {
    const result = await api("/api/command", command);
    state = await api("/api/workspace");
    return result;
  } catch (error) {
    showError(error);
    return null;
  } finally {
    busy = false;
    $("#language").disabled = false;
    buttons.forEach((b, i) => {
      b.disabled = prior[i];
    });
  }
}
function openDialog(content) {
  $("#dialog-content").innerHTML = content;
  $("#form-error").hidden = true;
  dialog.showModal();
}
function closeDialog() {
  if (!busy) dialog.close();
}
dialog.addEventListener("cancel", (event) => {
  if (busy) event.preventDefault();
});
function header(eyebrow, title, description, action = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtitle">${description}</p></div>${action}</div>`;
}
const runButton = () =>
  `<button class="button primary" data-action="new-run" data-write><span aria-hidden="true">▷</span> ${t("Ejecutar evaluación")}</button>`;
function ruleDescription(rule) {
  if (rule.type === "contains") return t("Incluye: ") + rule.value.join(", ");
  if (rule.type === "excludes") return t("Excluye: ") + rule.value.join(", ");
  if (rule.type === "max_length")
    return `${t("Máximo")} ${rule.value} ${t("caracteres")}`;
  return t("Campos JSON: ") + rule.value.join(", ");
}
const normalizeSearch = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
function visibleCases() {
  const query = normalizeSearch(caseQuery.trim());
  return state.cases.filter(
    (c) =>
      (caseFilter === "all" ||
        (caseFilter === "active" ? c.active : !c.active)) &&
      normalizeSearch(
        `${c.title} ${c.prompt} ${c.rules.map(ruleDescription).join(" ")}`,
      ).includes(query),
  );
}
function answerPanel(letter, answer, caption = t("Respuesta guardada")) {
  return `<section class="answer-panel"><div class="answer-heading"><span class="variant">${letter}</span><h3>${caption}</h3><span class="character-count">${[...answer].length} ${t("car.")}</span></div><pre>${esc(answer || t("(Respuesta vacía)"))}</pre></section>`;
}
function caseInspector(c) {
  if (!state.cases.length)
    return `<div class="empty inspector-empty"><span class="empty-symbol" aria-hidden="true">＋</span><h2>${t("Tu primer experimento empieza aquí")}</h2><p>${t("Usa «Nuevo caso» para escribir una instrucción, dos respuestas y una regla que quieras comprobar.")}</p></div>`;
  if (!c)
    return `<div class="empty inspector-empty"><span class="empty-symbol" aria-hidden="true">∅</span><h2>${t("No hay casos que mostrar")}</h2><p>${t("Prueba otra búsqueda o cambia el filtro.")}</p><button class="button secondary" data-action="clear-search">${t("Mostrar todos los casos")}</button></div>`;
  const number = String(
    state.cases.findIndex((item) => item.id === c.id) + 1,
  ).padStart(2, "0");
  return `<article class="case-inspector" aria-labelledby="inspector-title"><header class="inspector-header"><div><p class="eyebrow">${t("FICHA /")} ${number}</p><h2 id="inspector-title" tabindex="-1">${esc(c.title)}</h2></div><button class="button secondary small" data-action="edit-case" data-id="${c.id}" data-write>${t("Editar caso ↗")}</button></header><div class="instruction"><span class="field-caption">${t("01 / INSTRUCCIÓN")}</span><p>${esc(c.prompt)}</p></div><div class="response-section"><p class="field-caption">${t("02 / DOS RESPUESTAS, UNA MISMA PRUEBA")}</p><div class="answer-grid">${answerPanel("A", c.answer_a)}${answerPanel("B", c.answer_b)}</div></div><section class="criteria-section"><p class="field-caption">${t("03 / QUÉ VAS A COMPROBAR")}</p><ol class="criteria-list">${c.rules.map((r) => `<li>${esc(ruleDescription(r))}</li>`).join("")}</ol></section><aside class="inspector-note"><span aria-hidden="true">↳</span><p>${t("Una regla comprueba una condición.")} <strong>${t("Tu criterio completa la evaluación.")}</strong></p></aside></article>`;
}
function caseWorkspace() {
  const cases = visibleCases();
  if (!cases.some((c) => c.id === selectedCase))
    selectedCase = cases[0]?.id || null;
  return `<section class="case-index" aria-label="${t("Biblioteca de casos")}"><div class="index-heading"><span>${t("ÍNDICE DE CASOS")}</span><span aria-live="polite">${cases.length} / ${state.cases.length}</span></div><div class="case-list">${cases.map((c) => `<article class="case-card ${c.id === selectedCase ? "selected" : ""}"><button class="case-select" data-action="select-case" data-id="${c.id}" aria-pressed="${c.id === selectedCase}"><span class="case-number">${String(state.cases.indexOf(c) + 1).padStart(2, "0")}</span><span class="case-label"><strong>${esc(c.title)}</strong><span>${c.rules.length} ${c.rules.length === 1 ? t("regla") : t("reglas")} <span class="index-dot">·</span> <span class="${c.active ? "active-text" : "paused-text"}">${c.active ? t("Activo") : t("Pausado")}</span></span></span><span class="selection-arrow" aria-hidden="true">↗</span></button></article>`).join("") || `<p class="index-empty">${t("Sin resultados.")}</p>`}</div><p class="index-footnote">${t("Selecciona un caso para leer sus respuestas y criterios.")}</p></section><div id="case-inspector">${caseInspector(cases.find((c) => c.id === selectedCase))}</div>`;
}
function refreshCases() {
  const scrollTop = $(".case-list")?.scrollTop || 0;
  $("#case-workspace").innerHTML = caseWorkspace();
  $(".case-list").scrollTop = scrollTop;
}
function caseView() {
  const active = state.cases.filter((c) => c.active).length;
  return (
    header(
      t("01 / PREPARAR EL EXPERIMENTO"),
      t("Tus casos de prueba"),
      t(
        "Pon dos respuestas frente a las mismas reglas. Después, cuestiona el resultado.",
      ),
      `<button class="button secondary" data-action="new-case" data-write>${t("＋ Nuevo caso")}</button>`,
    ) +
    `<div class="case-toolbar"><label class="search-field"><span aria-hidden="true">⌕</span><input type="search" id="case-search" aria-label="${t("Buscar casos")}" placeholder="${t("Buscar por nombre, instrucción o regla…")}" value="${esc(caseQuery)}"></label><label class="filter-field">${t("Mostrar")}<select id="case-filter" aria-label="${t("Estado de los casos")}"><option value="all" ${caseFilter === "all" ? "selected" : ""}>${t("Todos los casos")}</option><option value="active" ${caseFilter === "active" ? "selected" : ""}>${t("Solo activos")}</option><option value="paused" ${caseFilter === "paused" ? "selected" : ""}>${t("Solo pausados")}</option></select></label></div><div class="case-workspace" id="case-workspace">${caseWorkspace()}</div><div class="experiment-bar"><div><span class="ready-dot" aria-hidden="true"></span><strong>${active} ${active === 1 ? t("caso listo") : t("casos listos")}</strong><span>${t("Se evalúan todos los activos, aunque estén ocultos por el filtro.")}</span></div>${runButton()}</div>`
  );
}
function guideView() {
  return (
    header(
      t("MANUAL DE CAMPO / EMPEZAR AQUÍ"),
      t("Tu guía de EvalLab"),
      t(
        "Aprende a comprobar una respuesta y a explicar el resultado. No necesitas programar.",
      ),
    ) +
    `
    <div class="guide-layout">
      <aside class="guide-index" aria-labelledby="guide-index-title">
        <p class="field-caption" id="guide-index-title">${t("EN ESTA GUÍA")}</p>
        <ol>
          <li><button data-action="guide-section" data-id="guide-purpose">${t("Para qué sirve")}</button></li>
          <li><button data-action="guide-section" data-id="guide-start">${t("Tu primera evaluación")}</button></li>
          <li><button data-action="guide-section" data-id="guide-results">${t("Entender los resultados")}</button></li>
          <li><button data-action="guide-section" data-id="guide-rules">${t("Las cuatro reglas")}</button></li>
          <li><button data-action="guide-section" data-id="guide-privacy">${t("Privacidad y uso")}</button></li>
        </ol>
        <p>${t("Ten esta guía a mano. Puedes volver a ella desde cualquier pantalla.")}</p>
      </aside>
      <div class="guide-pages">
        <section class="guide-chapter" aria-labelledby="guide-purpose">
          <p class="eyebrow">${t("01 / EL PROPÓSITO")}</p>
          <h2 id="guide-purpose" tabindex="-1">${t("Una respuesta puede sonar bien. ¿Cumple lo que pediste?")}</h2>
          <p>${t("EvalLab es un laboratorio personal para comprobar respuestas con condiciones que tú eliges. Sirve para practicar evaluaciones de IA, comparar alternativas y detectar cuándo una regla necesita mejorar.")}</p>
          <p>${t("Tú escribes o pegas dos respuestas,")} <strong>${t("A y B")}</strong>${t(". EvalLab revisa su texto; esta versión no genera respuestas ni está conectada a un modelo de IA.")}</p>
          <dl class="guide-map">
            <div><dt>${t("Casos")}</dt><dd>${t("Preparas la instrucción, las dos respuestas y las reglas. Ese conjunto es un")} <strong>${t("caso de prueba")}</strong>.</dd></div>
            <div><dt>${t("Ejecuciones")}</dt><dd>${t("Guardas una evaluación de los casos activos, como una foto de sus respuestas y reglas en ese momento.")}</dd></div>
            <div><dt>${t("Comparar")}</dt><dd>${t("Ves qué cambió entre dos ejecuciones y abres cada caso para investigar la diferencia.")}</dd></div>
          </dl>
        </section>
        <section class="guide-chapter" aria-labelledby="guide-start">
          <p class="eyebrow">${t("02 / MANOS A LA OBRA")}</p>
          <h2 id="guide-start" tabindex="-1">${t("Tu primera evaluación, paso a paso")}</h2>
          <ol class="guide-steps">
            <li><div><h3>${t("Prepara un caso")}</h3><p>${t("En")} <strong>${t("Casos")}</strong>${t(", selecciona uno para leerlo o pulsa")} <strong>${t("Nuevo caso")}</strong>${t(". Escribe qué pides, añade A y B, activa al menos una regla y guarda. Para cambiar un caso existente, usa")} <strong>${t("Editar caso")}</strong>.</p></div></li>
            <li><div><h3>${t("Prueba las respuestas A")}</h3><p>${t("Pulsa")} <strong>${t("Ejecutar evaluación")}</strong>${t(", pon un nombre que reconozcas y elige A. Se comprueban todos los casos activos, incluso los que una búsqueda o filtro oculte. Un caso pausado queda fuera.")}</p></div></li>
            <li><div><h3>${t("Lee y añade tu criterio")}</h3><p>${t("Abre un resultado para ver qué regla cumplió o falló. En")} <strong>${t("Tu revisión")}</strong>${t(", indica si estás de acuerdo y explica por qué. Esta revisión se guarda por separado; no cambia el resultado automático.")}</p></div></li>
            <li><div><h3>${t("Prueba B y compara")}</h3><p>${t("Desde")} <strong>${t("Ejecuciones")}</strong>${t(", crea otra evaluación con B. Mantén los mismos casos, instrucciones y reglas. En")} <strong>${t("Comparar")}</strong>${t(", elige ambas ejecuciones y despliega una fila para leer la evidencia.")}</p></div></li>
          </ol>
          <div class="guide-example">
            <p class="field-caption">${t("EJEMPLO PARA TU PROPIO CASO")}</p>
            <h3>${t("Una explicación de CareerOps")}</h3>
            <p><strong>${t("Instrucción:")}</strong> ${t("explica para qué sirve CareerOps usando las palabras «vacantes» y «proyectos».")}</p>
            <p><strong>${t("Regla:")}</strong> ${t("activa «Debe incluir» y escribe")} <code>${t("vacantes, proyectos")}</code>.</p>
            <div class="guide-example-answers">
              <div><span class="variant">A</span><p>${t("CareerOps organiza vacantes y proyectos para reunir evidencia de trabajo.")}</p>${badge("passed")}</div>
              <div><span class="variant">B</span><p>${t("Es una aplicación para organizar ideas.")}</p>${badge("failed")}</div>
            </div>
            <p class="help">${t("A incluye ambos términos; B no. Es un ejemplo explicativo, no una ejecución guardada. El porcentaje de una ejecución también cuenta los demás casos activos.")}</p>
          </div>
          <button class="button primary" data-action="nav" data-view="cases">${t("Ir a Casos para empezar")} <span aria-hidden="true">↗</span></button>
        </section>
        <section class="guide-chapter" aria-labelledby="guide-results">
          <p class="eyebrow">${t("03 / LEER CON CRITERIO")}</p>
          <h2 id="guide-results" tabindex="-1">${t("Qué te dice cada resultado")}</h2>
          <dl class="guide-outcomes">
            <div><dt>${badge("passed")}</dt><dd>${t("La respuesta cumple todas las reglas del caso. Eso no garantiza que sea correcta o útil en todos los sentidos.")}</dd></div>
            <div><dt>${badge("failed")}</dt><dd>${t("Al menos una regla no se cumplió. Abre el detalle y revisa si la condición representa lo que realmente buscas.")}</dd></div>
            <div><dt>${badge("error")}</dt><dd>${t("La configuración o el motor de evaluación fallaron. La respuesta no se calificó: revisa ese problema antes de comparar porcentajes.")}</dd></div>
          </dl>
          <p><strong>${t("El porcentaje cuenta casos que cumplen todas sus reglas.")}</strong> ${t("Si cumplen 2 de 4 casos evaluables, verás 50%. Los errores del evaluador se excluyen del cálculo. Dos ejecuciones pueden tener el mismo porcentaje y fallar en casos distintos.")}</p>
          <div class="guide-note"><h3>${t("Una regla puede perderse el contexto")}</h3><p>${t("«No garantiza cero errores» contiene el fragmento «garantiza cero errores». Una regla que lo excluya marcará un fallo, aunque la frase esté negando la promesa. Tu revisión sirve para explicar esa diferencia.")}</p></div>
          <p>${t("Si cambias los casos, instrucciones o reglas entre ejecuciones, EvalLab avisa que las tasas no son comparables. La revisión humana expresa tu criterio; tampoco es una garantía de calidad.")}</p>
        </section>
        <section class="guide-chapter" aria-labelledby="guide-rules">
          <p class="eyebrow">${t("04 / TUS HERRAMIENTAS")}</p>
          <h2 id="guide-rules" tabindex="-1">${t("Las cuatro reglas de evaluación")}</h2>
          <p>${t("Puedes combinar de una a cuatro reglas por caso. Para que el caso cumpla, deben cumplirse todas.")}</p>
          <div class="guide-questions">
            <details><summary>${t("Debe incluir / No debe incluir")}</summary><div><p>${t("Buscan fragmentos de texto sin distinguir mayúsculas. Separa los términos con comas. «Debe incluir» exige todos; «No debe incluir» falla si aparece cualquiera de los excluidos.")}</p><p>${t("Buscan fragmentos, no el significado de la frase. Por ejemplo, «dato» también aparece dentro de «datos».")}</p></div></details>
            <details><summary>${t("Longitud máxima")}</summary><div><p>${t("Limita la respuesta a un número de caracteres entre 1 y 10,000, incluidos espacios y saltos de línea. No es un conteo de palabras. Algunos símbolos compuestos pueden contar como varios caracteres.")}</p></div></details>
            <details><summary>${t("JSON con campos")}</summary><div><p>${t("JSON es un formato de texto con nombres y valores. Por ejemplo:")} <code>${t('{"titulo":"Revisar formulario","prioridad":"alta"}')}</code>.</p><p>${t("Si configuras")} <code>${t("titulo, prioridad")}</code>${t(", la regla exige esos nombres exactos en el primer nivel. No comprueba si sus valores son correctos. La respuesta debe ser solo el objeto JSON, sin explicaciones ni bloques de Markdown.")}</p></div></details>
          </div>
        </section>
        <section class="guide-chapter" aria-labelledby="guide-privacy">
          <p class="eyebrow">${t("05 / CUIDAR TU TRABAJO")}</p>
          <h2 id="guide-privacy" tabindex="-1">${t("Privacidad, seguridad y normas de uso")}</h2>
          <p>${t("Esta versión es un prototipo local para una persona. Usa ejemplos ficticios o textos que tengas permiso de utilizar.")}</p>
          <div class="guide-questions">
            <details><summary>${t("¿Dónde se guardan mis datos?")}</summary><div><p>${t("Los casos, ejecuciones y revisiones se guardan en una base de datos de esta computadora. Cerrar o recargar el navegador no los borra. EvalLab no envía esas respuestas a servicios de IA.")}</p><p>${t("La aplicación no ofrece inicio de sesión ni cifra la base de datos. Otra persona con acceso a los archivos podría leerla. Si la carpeta está dentro de OneDrive u otro servicio de sincronización, ese servicio puede copiarla según su configuración.")}</p></div></details>
            <details><summary>${t("¿Qué pasa al editar, pausar o eliminar?")}</summary><div><p>${t("Editar afecta a futuras evaluaciones. Pausar excluye el caso de la próxima ejecución. Eliminar retira el caso de la biblioteca, pero")} <strong>${t("las ejecuciones anteriores conservan una copia de sus respuestas y reglas")}</strong>.</p><p>${t("Eliminar un caso no borra toda su información histórica. Esta versión no tiene un botón para eliminar el historial de ejecuciones. Al actualizar una revisión humana, se conserva su última versión.")}</p></div></details>
            <details><summary>${t("¿Qué normas conviene seguir?")}</summary><div><ul><li>${t("Evita contraseñas, claves de acceso, información confidencial y datos personales reales.")}</li><li>${t("Usa lenguaje respetuoso y ejemplos relacionados con lo que quieres comprobar. Si pruebas lenguaje ofensivo, usa ejemplos ficticios y explica el propósito.")}</li><li>${t("EvalLab no incluye un filtro automático de lenguaje ofensivo. La regla «No debe incluir» solo comprueba los términos que tú configures.")}</li><li>${t("Al compartir resultados, indica qué reglas usaste y qué límites tienen. Un porcentaje no demuestra por sí solo la calidad de una IA.")}</li></ul></div></details>
            <details><summary>${t("¿Cómo cuido mis datos y reporto un problema?")}</summary><div><p>${t("Para respaldar, detén el servidor y copia la carpeta")} <code>.data</code> ${t("del proyecto a un lugar seguro. El guardado local no crea copias de seguridad automáticas.")}</p><p>${t("El servidor está preparado para abrirse solo en esta computadora. No lo expongas a Internet como un servicio público: esta versión no tiene cuentas ni separación entre usuarios.")}</p><p>${t("Si algo falla, anota la pantalla, los pasos, lo que esperabas y lo que ocurrió. Puedes compartir una captura ocultando datos sensibles. Si un guardado se interrumpe, revisa primero si aparece en el historial antes de repetirlo.")}</p></div></details>
          </div>
        </section>
        <div class="guide-closing"><p>${t("El objetivo es poder explicar")} <strong>${t("qué comprobaste, qué ocurrió y qué mejorarías")}</strong>.</p><button class="text-button" data-action="guide-section" data-id="guide-purpose">${t("Volver al inicio de la guía ↑")}</button></div>
      </div>
    </div>`
  );
}
function stats(summary) {
  return `<div class="score-sheet"><div class="score-total"><span class="field-caption">${t("CUMPLIMIENTO")}</span><strong>${summary.rate === null ? "—" : summary.rate + "%"}</strong><span>${summary.passed} ${t("de")} ${summary.evaluated} ${t("casos evaluables")}</span></div><dl class="score-breakdown"><div><dt><span class="status-dot"></span>${t("Cumplen")}</dt><dd>${summary.passed}</dd></div><div><dt><span class="status-dot failed-dot"></span>${t("No cumplen")}</dt><dd>${summary.failed}</dd></div><div><dt><span class="status-dot error-dot"></span>${t("Errores del evaluador")}</dt><dd>${summary.error}</dd></div></dl><p class="score-explainer">${t("El porcentaje mide")} <strong>${t("cumplimiento de reglas")}</strong>${t(", no calidad general.")}<br>${t("Los errores del evaluador se excluyen del cálculo.")}</p></div>`;
}
function runView() {
  return (
    header(
      t("02 / REGISTRO DE EXPERIMENTOS"),
      t("Ejecuciones"),
      t("Conserva las respuestas y reglas exactas de cada evaluación."),
      runButton(),
    ) +
    `<div class="run-list">${state.runs.map((r) => `<button class="run-row" data-action="open-run" data-id="${r.id}"><span class="run-symbol" aria-hidden="true">▷</span><span class="run-name"><strong>${esc(r.name)}</strong><small>${t("Respuesta")} ${r.variant.toUpperCase()} · ${date(r.created_at)}</small></span><span class="run-counts">${r.summary.passed} ${t("cumplen")} <span>·</span> ${r.summary.failed} ${t("no cumplen")} <span>·</span> ${r.summary.error} ${t("errores")}</span><span class="run-rate">${r.summary.rate === null ? "—" : r.summary.rate + "%"}</span><span aria-hidden="true">›</span></button>`).join("") || `<div class="empty"><span class="empty-symbol" aria-hidden="true">▷</span><h2>${t("Aún no hay resultados")}</h2><p>${t("Ejecuta la respuesta A de los casos activos. Después prueba B para comparar.")}</p><button class="button primary" data-action="new-run" data-write>${t("Primera evaluación")}</button></div>`}</div>`
  );
}
function resultCard(result) {
  const evaluation = result.evaluation;
  return `<details class="result-card"><summary><strong>${esc(result.snapshot.title)}</strong>${badge(evaluation.status)}${result.review ? `<span class="review-indicator">${t("Revisión:")} ${esc(t(reviewLabels[result.review.decision]))}</span>` : ""}</summary><div class="result-content"><p class="field-caption">${t("INSTRUCCIÓN")}</p><p>${esc(result.snapshot.prompt)}</p><p class="field-caption">${t("RESPUESTA EVALUADA")}</p><pre>${esc(result.answer || t("(Respuesta vacía)"))}</pre><h3>${t("Comprobaciones")}</h3>${evaluation.status === "error" ? `<p class="alert error">${esc(localizeMessage(evaluation.detail))}</p>` : evaluation.checks.map((check) => `<div class="check-row"><span class="check-icon ${check.passed ? "yes" : "no"}" aria-hidden="true">${check.passed ? "✓" : "×"}</span><div><strong>${esc(t(check.label))} · ${check.passed ? t("Cumple") : t("No cumple")}</strong><p>${esc(localizeMessage(check.detail))}</p></div></div>`).join("")}
  <form class="review-form" data-result="${result.id}"><h3>${t("Tu revisión")}</h3><p class="muted">${t("¿Estás de acuerdo con la evaluación? Tu valoración se guarda por separado y no altera la puntuación automática.")}</p><label>${t("Valoración")}<select name="decision"><option value="agree" ${result.review?.decision === "agree" ? "selected" : ""}>${t("Estoy de acuerdo")}</option><option value="disagree" ${result.review?.decision === "disagree" ? "selected" : ""}>${t("Estoy en desacuerdo")}</option><option value="unsure" ${!result.review || result.review.decision === "unsure" ? "selected" : ""}>${t("Necesito revisarlo")}</option></select></label><label>${t("Explicación")}<textarea name="note" required maxlength="2000" rows="2" placeholder="${t("Ej. La regla detecta una frase, pero aquí se usa para negar una promesa.")}">${esc(result.review?.note || "")}</textarea></label><button type="submit" class="button secondary small">${t("Guardar revisión")}</button><p class="review-error alert error" role="alert" hidden></p>${result.reviewed_at ? `<small class="muted">${t("Última revisión:")} ${date(result.reviewed_at)}</small>` : ""}</form></div></details>`;
}
function runDetail(run) {
  return (
    `<button class="back" data-action="back-runs">${t("← Todas las ejecuciones")}</button>` +
    header(
      t("02 / INFORME DE EVALUACIÓN"),
      esc(run.name),
      `${t("Respuesta")} ${run.variant.toUpperCase()} · ${date(run.created_at)} ${t("· Reglas y respuestas conservadas")}`,
    ) +
    stats(run.summary) +
    `<div class="section-line"><h2>${t("Resultados por caso")}</h2><span class="muted">${t("Abre un resultado para revisarlo")}</span></div>${run.results.map(resultCard).join("")}`
  );
}
function comparisonOptions(selected) {
  return state.runs
    .map(
      (r) =>
        `<option value="${r.id}" ${r.id === selected ? "selected" : ""}>${esc(r.name)} · ${r.variant.toUpperCase()} · ${date(r.created_at)}</option>`,
    )
    .join("");
}
function compareView(a, b) {
  const comparable = a.signature === b.signature;
  const same = a.id === b.id;
  const errors = a.summary.error + b.summary.error;
  const rateA = a.summary.rate,
    rateB = b.summary.rate;
  const delta =
    rateA === null || rateB === null
      ? null
      : Math.round((rateB - rateA) * 10) / 10;
  const pairs = new Map(a.results.map((r) => [r.case_id, { a: r, b: null }]));
  b.results.forEach((r) => {
    if (pairs.has(r.case_id)) pairs.get(r.case_id).b = r;
    else pairs.set(r.case_id, { a: null, b: r });
  });
  const verdict = (left, right) => {
    if (!left || !right) return t("Caso añadido o retirado");
    if (
      JSON.stringify(left.snapshot.rules) !==
        JSON.stringify(right.snapshot.rules) ||
      left.snapshot.prompt !== right.snapshot.prompt
    )
      return t("Criterios distintos");
    if ([left.evaluation.status, right.evaluation.status].includes("error"))
      return t("Revisar evaluador");
    if (left.evaluation.status === right.evaluation.status)
      return t("Sin cambio de estado");
    return right.evaluation.status === "passed"
      ? t("Ahora cumple")
      : t("Ahora no cumple");
  };
  return (
    header(
      t("03 / CONTRASTAR LA EVIDENCIA"),
      t("Comparar ejecuciones"),
      t(
        "Compara sobre los mismos casos y criterios antes de sacar conclusiones.",
      ),
    ) +
    `<div class="compare-selectors"><label>${t("Ejecución de referencia")}<select id="compare-a">${comparisonOptions(a.id)}</select></label><span aria-hidden="true">→</span><label>${t("Ejecución a comparar")}<select id="compare-b">${comparisonOptions(b.id)}</select></label></div>
  ${same ? `<p class="alert warning">${t("Seleccionaste la misma ejecución. Elige dos distintas.")}</p>` : !comparable ? `<p class="alert warning">${t("Los casos o criterios cambiaron. Las tasas no son comparables y no se calcula una diferencia global.")}</p>` : errors ? `<p class="alert warning">${t("Hay errores del evaluador. Resuélvelos antes de interpretar una diferencia global.")}</p>` : `<div class="comparison-callout"><div><small>${t("MISMOS CASOS Y CRITERIOS")}</small><h2>${delta === 0 ? t("Mismo porcentaje, revisa cada caso.") : `${t("Diferencia:")} ${delta > 0 ? "+" : ""}${delta} ${t("puntos porcentuales")}`}</h2><p>${rateA}% → ${rateB}${t("%. Este porcentaje mide reglas, no calidad general de un modelo.")}</p></div><span class="compare-mark" aria-hidden="true">⇄</span></div>`}
  <div class="comparison-ledger"><div class="ledger-heading"><span>${t("CASO / ABRE PARA VER LAS RESPUESTAS")}</span><span>${t("REFERENCIA")}</span><span>${t("COMPARACIÓN")}</span><span>${t("QUÉ CAMBIÓ")}</span></div>${[...pairs.values()].map(({ a: left, b: right }, i) => `<details class="comparison-row"><summary><strong><span class="case-number">${String(i + 1).padStart(2, "0")}</span>${esc((right || left).snapshot.title)}</strong><span class="ledger-status"><small>${t("Referencia")}</small>${left ? badge(left.evaluation.status) : t("No incluido")}</span><span class="ledger-status"><small>${t("Comparación")}</small>${right ? badge(right.evaluation.status) : t("No incluido")}</span><span class="change-label">${esc(verdict(left, right))}</span></summary><div class="comparison-evidence"><div class="answer-grid">${[left, right].map((r, index) => `<div>${r ? answerPanel(index ? "C" : "R", r.answer, index ? t("Ejecución a comparar") : t("Ejecución de referencia")) + `<p class="evidence-context"><strong>${t("Instrucción:")}</strong> ${esc(r.snapshot.prompt)}</p><ul class="evidence-rules">${r.snapshot.rules.map((rule) => `<li>${esc(ruleDescription(rule))}</li>`).join("")}</ul>` : `<p class="muted">${t("Este caso no está incluido en esta ejecución.")}</p>`}</div>`).join("")}</div><p class="help">${t("R: referencia · C: comparación. Cada columna conserva la instrucción y las reglas usadas en esa ejecución.")}</p></div></details>`).join("")}</div><p class="metric-note">${t("La revisión humana permanece en cada ejecución. Un empate global puede ocultar mejoras en unos casos y retrocesos en otros.")}</p><div class="compare-links"><button class="button secondary" data-action="open-run" data-id="${a.id}">${t("Abrir referencia")}</button><button class="button secondary" data-action="open-run" data-id="${b.id}">${t("Abrir comparación")}</button></div>`
  );
}
async function render() {
  const token = ++renderToken;
  $("#breadcrumb").textContent = t(labels[view]);
  $("#case-count").textContent = state.cases.length;
  $("#run-count").textContent = state.runs.length;
  document.querySelectorAll("nav button").forEach((button) => {
    if (button.dataset.view === view)
      button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  try {
    if (view === "guide") $("#main").innerHTML = guideView();
    else if (view === "cases") $("#main").innerHTML = caseView();
    else if (view === "runs" && !selectedRun) $("#main").innerHTML = runView();
    else if (view === "runs") {
      const run = await api(`/api/run?id=${encodeURIComponent(selectedRun)}`);
      if (token === renderToken) $("#main").innerHTML = runDetail(run);
    } else if (state.runs.length < 2)
      $("#main").innerHTML =
        header(
          t("03 / CONTRASTAR LA EVIDENCIA"),
          t("Comparar ejecuciones"),
          t("Necesitas dos ejecuciones para ver qué cambió."),
        ) +
        `<div class="empty"><span class="empty-symbol" aria-hidden="true">⇄</span><h2>${t("Prueba A, después B")}</h2><p>${t("Mantén los mismos casos y reglas entre ambas ejecuciones.")}</p>${runButton()}</div>`;
    else {
      if (!comparison.length) comparison = [state.runs[1].id, state.runs[0].id];
      const runs = await Promise.all(
        comparison.map((id) => api(`/api/run?id=${encodeURIComponent(id)}`)),
      );
      if (token === renderToken) $("#main").innerHTML = compareView(...runs);
    }
  } catch (error) {
    if (token === renderToken) showError(error);
  }
}
function caseForm(id) {
  const c = state.cases.find((item) => item.id === id);
  const rules = c?.rules || [{ type: "contains", value: [] }];
  const rule = (type) => rules.find((item) => item.type === type);
  const fields = [
    [
      "contains",
      t("Debe incluir"),
      t("Fragmentos separados por comas"),
      t("texto obligatorio"),
    ],
    [
      "excludes",
      t("No debe incluir"),
      t("Fragmentos separados por comas"),
      t("promesa absoluta"),
    ],
    ["max_length", t("Longitud máxima"), t("Número de caracteres"), "180"],
    [
      "json_fields",
      t("JSON con campos"),
      t("Nombres exactos, separados por comas"),
      t("titulo, prioridad"),
    ],
  ];
  openDialog(
    `<p class="eyebrow">${t("BIBLIOTECA DE PRUEBAS")}</p><h2 id="dialog-title">${c ? t("Revisar caso") : t("Nuevo caso")}</h2><p class="subtitle">${t("Una instrucción, dos respuestas y condiciones que puedas comprobar.")}</p><form id="case-form" data-id="${c?.id || ""}"><label>${t("Nombre del caso")}<input name="title" required maxlength="120" value="${esc(c?.title)}" placeholder="${t("Ej. Una respuesta breve y útil")}"></label><label>${t("Instrucción original")}<textarea name="prompt" required maxlength="3000" rows="2" placeholder="${t("¿Qué le pedirías a una IA?")}">${esc(c?.prompt)}</textarea></label><div class="form-grid"><label>${t("Respuesta A")}<textarea name="answer_a" maxlength="10000" rows="4" placeholder="${t("Pega o escribe una respuesta")}">${esc(c?.answer_a)}</textarea></label><label>${t("Respuesta B")}<textarea name="answer_b" maxlength="10000" rows="4" placeholder="${t("Prueba una alternativa")}">${esc(c?.answer_b)}</textarea></label></div><p class="help">${t("Son respuestas escritas o pegadas por ti. Una respuesta vacía también se puede evaluar.")}</p><fieldset class="rules"><legend>${t("Reglas de evaluación")}</legend>${fields.map(([type, label, hint, placeholder]) => `<div class="rule-editor"><label class="check-label"><input type="checkbox" name="rule-${type}" ${rule(type) ? "checked" : ""} data-rule="${type}">${label}</label><label class="rule-value">${hint}<input name="value-${type}" ${type === "max_length" ? 'type="number" min="1" max="10000" step="1"' : 'maxlength="2100"'} value="${esc(type === "max_length" ? rule(type)?.value || "" : rule(type)?.value?.join(", ") || "")}" placeholder="${placeholder}" ${rule(type) ? "required" : "disabled"}></label></div>`).join("")}</fieldset><p class="help">${t("El texto se busca por fragmentos sin distinguir mayúsculas. JSON exige nombres exactos en el primer nivel, sin validar sus valores. Estas reglas pueden equivocarse por falta de contexto.")}</p><label class="check-label"><input type="checkbox" name="active" ${c?.active !== false ? "checked" : ""}>${t("Incluir en las próximas ejecuciones")}</label><div class="form-actions">${c ? `<button type="button" class="text-button danger" data-action="delete-case" data-id="${c.id}" data-write>${t("Eliminar caso")}</button>` : ""}<button type="button" class="button secondary" data-action="close">${t("Cancelar")}</button><button type="submit" class="button primary">${t("Guardar caso")}</button></div></form>`,
  );
}
function newRun() {
  const active = state.cases.filter((c) => c.active).length;
  openDialog(
    `<p class="eyebrow">${t("UN EXPERIMENTO REPRODUCIBLE")}</p><h2 id="dialog-title">${t("Ejecutar evaluación")}</h2><p class="subtitle">${t("Se evaluarán los")} ${active} ${t("casos activos y se guardará una copia de sus reglas y respuestas.")}</p><form id="run-form"><label>${t("Nombre de la ejecución")}<input name="name" required maxlength="120" placeholder="${t("Ej. Primera revisión · A")}" value="${t("Evaluación")} ${state.runs.length + 1}"></label><label>${t("Respuestas que quieres probar")}<select name="variant"><option value="a">${t("Respuesta A de cada caso")}</option><option value="b">${t("Respuesta B de cada caso")}</option></select></label><p class="alert info">${t("No se llamará a ningún modelo de IA. Se comprobará el texto que ya está guardado en tus casos.")}</p><div class="form-actions"><button type="button" class="button secondary" data-action="close">${t("Cancelar")}</button><button type="submit" class="button primary" ${active ? "" : "disabled"}>${t("Evaluar")} ${active} ${t("casos")}</button></div>${!active ? `<p class="help">${t("Activa al menos un caso para continuar.")}</p>` : ""}</form>`,
  );
}
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || busy) return;
  const { action, id } = button.dataset;
  if (action === "close") closeDialog();
  if (action === "guide-section") {
    const section = document.getElementById(id);
    section.focus({ preventScroll: true });
    section.scrollIntoView({ block: "start" });
  }
  if (action === "select-case") {
    selectedCase = id;
    refreshCases();
    $("#inspector-title").focus({ preventScroll: true });
    if (matchMedia("(max-width: 760px)").matches)
      $("#case-inspector").scrollIntoView({ block: "start" });
  }
  if (action === "clear-search") {
    caseQuery = "";
    caseFilter = "all";
    await render();
    $("#case-search").focus();
  }
  if (action === "nav") {
    view = button.dataset.view;
    selectedRun = null;
    await render();
    if (!button.closest("nav")) {
      $("#main").focus({ preventScroll: true });
      $("#main").scrollIntoView({ block: "start" });
    }
  }
  if (action === "new-case" || action === "edit-case") caseForm(id);
  if (action === "new-run") newRun();
  if (action === "open-run") {
    view = "runs";
    selectedRun = id;
    await render();
  }
  if (action === "back-runs") {
    selectedRun = null;
    await render();
  }
  if (action === "delete-case") {
    const c = state.cases.find((item) => item.id === id);
    $("#dialog-content").innerHTML =
      `<p class="eyebrow">${t("ELIMINAR CASO")}</p><h2 id="dialog-title">${t("¿Eliminar «")}${esc(c.title)}${t("»?")}</h2><p class="subtitle">${t("Se retirará de la biblioteca. Las ejecuciones anteriores conservan sus resultados y la copia del caso. Esta acción no se puede deshacer.")}</p><div class="form-actions"><button class="button secondary" data-action="edit-case" data-id="${id}">${t("Cancelar")}</button><button class="button destructive" data-action="confirm-delete" data-id="${id}" data-write>${t("Confirmar eliminación")}</button></div>`;
  }
  if (action === "confirm-delete") {
    if (await write({ type: "delete_case", id })) {
      closeDialog();
      await render();
      notice(t("Caso eliminado; historial conservado"));
    }
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "case-search") {
    caseQuery = event.target.value;
    refreshCases();
  }
});

document.addEventListener("change", async (event) => {
  const input = event.target;
  if (input.id === "language") {
    if (!busy) await changeLanguage(input.value);
    return;
  }
  if (input.id === "case-filter") {
    caseFilter = input.value;
    refreshCases();
  }
  if (input.dataset.rule) {
    const field = dialog.querySelector(`[name="value-${input.dataset.rule}"]`);
    field.disabled = !input.checked;
    field.required = input.checked;
  }
  if (input.id === "compare-a" || input.id === "compare-b") {
    comparison = [$("#compare-a").value, $("#compare-b").value];
    await render();
  }
});
document.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const form = event.target,
    data = new FormData(form);
  if (form.id === "case-form") {
    const rules = ["contains", "excludes", "max_length", "json_fields"]
      .filter((type) => data.has(`rule-${type}`))
      .map((type) => ({
        type,
        value:
          type === "max_length"
            ? Number(data.get(`value-${type}`))
            : String(data.get(`value-${type}`))
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
      }));
    const command = {
      type: "save_case",
      ...(form.dataset.id ? { id: form.dataset.id } : {}),
      data: {
        title: data.get("title"),
        prompt: data.get("prompt"),
        answer_a: data.get("answer_a"),
        answer_b: data.get("answer_b"),
        rules,
        active: data.has("active"),
      },
    };
    const saved = await write(command);
    if (saved) {
      selectedCase = saved.id || form.dataset.id;
      caseQuery = "";
      caseFilter = "all";
      closeDialog();
      await render();
      notice(t("Caso guardado"));
    }
  }
  if (form.id === "run-form") {
    const result = await write({
      type: "run",
      name: data.get("name"),
      variant: data.get("variant"),
    });
    if (result) {
      closeDialog();
      selectedRun = result.id;
      view = "runs";
      comparison = [];
      await render();
      notice(t("Evaluación guardada"));
    }
  }
  if (form.classList.contains("review-form")) {
    if (
      await write({
        type: "review",
        id: form.dataset.result,
        decision: data.get("decision"),
        note: data.get("note"),
      })
    ) {
      const resultId = form.dataset.result;
      await render();
      const updated = document.querySelector(`[data-result="${resultId}"]`);
      updated.closest("details").open = true;
      updated.querySelector("button").focus();
      notice(t("Revisión guardada por separado"));
    }
  }
});
try {
  state = await api("/api/workspace");
  await render();
} catch (error) {
  $("#main").innerHTML =
    `<div class="empty"><h1>${t("No se pudo abrir EvalLab")}</h1><p>${esc(localizeMessage(error.message))}</p><a class="button primary" href="/">${t("Volver a intentar")}</a></div>`;
}
