const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const labels = { cases: "Casos", runs: "Ejecuciones", compare: "Comparar" };
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
const badge = (status) =>
  `<span class="badge ${esc(status)}"><span></span>${esc(statuses[status] || status)}</span>`;
const date = (value) =>
  new Date(value).toLocaleString("es-MX", {
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
    throw new Error(data.error || "No se pudo completar la operación.");
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
    $("#form-error").textContent = error.message;
    $("#form-error").hidden = false;
    $("#form-error").scrollIntoView({ block: "nearest" });
  } else {
    const node = document.createElement("p");
    node.className = "alert error";
    node.role = "alert";
    node.textContent = error.message;
    $("#main").prepend(node);
  }
}
async function write(command) {
  if (busy) return null;
  busy = true;
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
const runButton = `<button class="button primary" data-action="new-run" data-write><span aria-hidden="true">▷</span> Ejecutar evaluación</button>`;
function ruleDescription(rule) {
  if (rule.type === "contains") return "Incluye: " + rule.value.join(", ");
  if (rule.type === "excludes") return "Excluye: " + rule.value.join(", ");
  if (rule.type === "max_length") return `Máximo ${rule.value} caracteres`;
  return "Campos JSON: " + rule.value.join(", ");
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
function answerPanel(letter, answer, caption = "Respuesta guardada") {
  return `<section class="answer-panel"><div class="answer-heading"><span class="variant">${letter}</span><h3>${caption}</h3><span class="character-count">${[...answer].length} car.</span></div><pre>${esc(answer || "(Respuesta vacía)")}</pre></section>`;
}
function caseInspector(c) {
  if (!state.cases.length)
    return `<div class="empty inspector-empty"><span class="empty-symbol" aria-hidden="true">＋</span><h2>Tu primer experimento empieza aquí</h2><p>Usa «Nuevo caso» para escribir una instrucción, dos respuestas y una regla que quieras comprobar.</p></div>`;
  if (!c)
    return `<div class="empty inspector-empty"><span class="empty-symbol" aria-hidden="true">∅</span><h2>No hay casos que mostrar</h2><p>Prueba otra búsqueda o cambia el filtro.</p><button class="button secondary" data-action="clear-search">Mostrar todos los casos</button></div>`;
  const number = String(
    state.cases.findIndex((item) => item.id === c.id) + 1,
  ).padStart(2, "0");
  return `<article class="case-inspector" aria-labelledby="inspector-title"><header class="inspector-header"><div><p class="eyebrow">FICHA / ${number}</p><h2 id="inspector-title" tabindex="-1">${esc(c.title)}</h2></div><button class="button secondary small" data-action="edit-case" data-id="${c.id}" data-write>Editar caso ↗</button></header><div class="instruction"><span class="field-caption">01 / INSTRUCCIÓN</span><p>${esc(c.prompt)}</p></div><div class="response-section"><p class="field-caption">02 / DOS RESPUESTAS, UNA MISMA PRUEBA</p><div class="answer-grid">${answerPanel("A", c.answer_a)}${answerPanel("B", c.answer_b)}</div></div><section class="criteria-section"><p class="field-caption">03 / QUÉ VAS A COMPROBAR</p><ol class="criteria-list">${c.rules.map((r) => `<li>${esc(ruleDescription(r))}</li>`).join("")}</ol></section><aside class="inspector-note"><span aria-hidden="true">↳</span><p>Una regla comprueba una condición. <strong>Tu criterio completa la evaluación.</strong></p></aside></article>`;
}
function caseWorkspace() {
  const cases = visibleCases();
  if (!cases.some((c) => c.id === selectedCase))
    selectedCase = cases[0]?.id || null;
  return `<section class="case-index" aria-label="Biblioteca de casos"><div class="index-heading"><span>ÍNDICE DE CASOS</span><span aria-live="polite">${cases.length} / ${state.cases.length}</span></div><div class="case-list">${cases.map((c) => `<article class="case-card ${c.id === selectedCase ? "selected" : ""}"><button class="case-select" data-action="select-case" data-id="${c.id}" aria-pressed="${c.id === selectedCase}"><span class="case-number">${String(state.cases.indexOf(c) + 1).padStart(2, "0")}</span><span class="case-label"><strong>${esc(c.title)}</strong><span>${c.rules.length} ${c.rules.length === 1 ? "regla" : "reglas"} <span class="index-dot">·</span> <span class="${c.active ? "active-text" : "paused-text"}">${c.active ? "Activo" : "Pausado"}</span></span></span><span class="selection-arrow" aria-hidden="true">↗</span></button></article>`).join("") || `<p class="index-empty">Sin resultados.</p>`}</div><p class="index-footnote">Selecciona un caso para leer sus respuestas y criterios.</p></section><div id="case-inspector">${caseInspector(cases.find((c) => c.id === selectedCase))}</div>`;
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
      "01 / PREPARAR EL EXPERIMENTO",
      "Tus casos de prueba",
      "Pon dos respuestas frente a las mismas reglas. Después, cuestiona el resultado.",
      `<button class="button secondary" data-action="new-case" data-write>＋ Nuevo caso</button>`,
    ) +
    `<div class="case-toolbar"><label class="search-field"><span aria-hidden="true">⌕</span><input type="search" id="case-search" aria-label="Buscar casos" placeholder="Buscar por nombre, instrucción o regla…" value="${esc(caseQuery)}"></label><label class="filter-field">Mostrar<select id="case-filter" aria-label="Estado de los casos"><option value="all" ${caseFilter === "all" ? "selected" : ""}>Todos los casos</option><option value="active" ${caseFilter === "active" ? "selected" : ""}>Solo activos</option><option value="paused" ${caseFilter === "paused" ? "selected" : ""}>Solo pausados</option></select></label></div><div class="case-workspace" id="case-workspace">${caseWorkspace()}</div><div class="experiment-bar"><div><span class="ready-dot" aria-hidden="true"></span><strong>${active} ${active === 1 ? "caso listo" : "casos listos"}</strong><span>Se evalúan todos los activos, aunque estén ocultos por el filtro.</span></div>${runButton}</div>`
  );
}
function stats(summary) {
  return `<div class="score-sheet"><div class="score-total"><span class="field-caption">CUMPLIMIENTO</span><strong>${summary.rate === null ? "—" : summary.rate + "%"}</strong><span>${summary.passed} de ${summary.evaluated} casos evaluables</span></div><dl class="score-breakdown"><div><dt><span class="status-dot"></span>Cumplen</dt><dd>${summary.passed}</dd></div><div><dt><span class="status-dot failed-dot"></span>No cumplen</dt><dd>${summary.failed}</dd></div><div><dt><span class="status-dot error-dot"></span>Errores del evaluador</dt><dd>${summary.error}</dd></div></dl><p class="score-explainer">El porcentaje mide <strong>cumplimiento de reglas</strong>, no calidad general.<br>Los errores del evaluador se excluyen del cálculo.</p></div>`;
}
function runView() {
  return (
    header(
      "02 / REGISTRO DE EXPERIMENTOS",
      "Ejecuciones",
      "Conserva las respuestas y reglas exactas de cada evaluación.",
      runButton,
    ) +
    `<div class="run-list">${state.runs.map((r) => `<button class="run-row" data-action="open-run" data-id="${r.id}"><span class="run-symbol" aria-hidden="true">▷</span><span class="run-name"><strong>${esc(r.name)}</strong><small>Respuesta ${r.variant.toUpperCase()} · ${date(r.created_at)}</small></span><span class="run-counts">${r.summary.passed} cumplen <span>·</span> ${r.summary.failed} no cumplen <span>·</span> ${r.summary.error} errores</span><span class="run-rate">${r.summary.rate === null ? "—" : r.summary.rate + "%"}</span><span aria-hidden="true">›</span></button>`).join("") || `<div class="empty"><span class="empty-symbol" aria-hidden="true">▷</span><h2>Aún no hay resultados</h2><p>Ejecuta la respuesta A de los casos activos. Después prueba B para comparar.</p><button class="button primary" data-action="new-run" data-write>Primera evaluación</button></div>`}</div>`
  );
}
function resultCard(result) {
  const evaluation = result.evaluation;
  return `<details class="result-card"><summary><strong>${esc(result.snapshot.title)}</strong>${badge(evaluation.status)}${result.review ? `<span class="review-indicator">Revisión: ${esc(reviewLabels[result.review.decision])}</span>` : ""}</summary><div class="result-content"><p class="field-caption">INSTRUCCIÓN</p><p>${esc(result.snapshot.prompt)}</p><p class="field-caption">RESPUESTA EVALUADA</p><pre>${esc(result.answer || "(Respuesta vacía)")}</pre><h3>Comprobaciones</h3>${evaluation.status === "error" ? `<p class="alert error">${esc(evaluation.detail)}</p>` : evaluation.checks.map((check) => `<div class="check-row"><span class="check-icon ${check.passed ? "yes" : "no"}" aria-hidden="true">${check.passed ? "✓" : "×"}</span><div><strong>${esc(check.label)} · ${check.passed ? "Cumple" : "No cumple"}</strong><p>${esc(check.detail)}</p></div></div>`).join("")}
  <form class="review-form" data-result="${result.id}"><h3>Tu revisión</h3><p class="muted">¿Estás de acuerdo con la evaluación? Tu valoración se guarda por separado y no altera la puntuación automática.</p><label>Valoración<select name="decision"><option value="agree" ${result.review?.decision === "agree" ? "selected" : ""}>Estoy de acuerdo</option><option value="disagree" ${result.review?.decision === "disagree" ? "selected" : ""}>Estoy en desacuerdo</option><option value="unsure" ${!result.review || result.review.decision === "unsure" ? "selected" : ""}>Necesito revisarlo</option></select></label><label>Explicación<textarea name="note" required maxlength="2000" rows="2" placeholder="Ej. La regla detecta una frase, pero aquí se usa para negar una promesa.">${esc(result.review?.note || "")}</textarea></label><button type="submit" class="button secondary small">Guardar revisión</button><p class="review-error alert error" role="alert" hidden></p>${result.reviewed_at ? `<small class="muted">Última revisión: ${date(result.reviewed_at)}</small>` : ""}</form></div></details>`;
}
function runDetail(run) {
  return (
    `<button class="back" data-action="back-runs">← Todas las ejecuciones</button>` +
    header(
      "02 / INFORME DE EVALUACIÓN",
      esc(run.name),
      `Respuesta ${run.variant.toUpperCase()} · ${date(run.created_at)} · Reglas y respuestas conservadas`,
    ) +
    stats(run.summary) +
    `<div class="section-line"><h2>Resultados por caso</h2><span class="muted">Abre un resultado para revisarlo</span></div>${run.results.map(resultCard).join("")}`
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
    if (!left || !right) return "Caso añadido o retirado";
    if (
      JSON.stringify(left.snapshot.rules) !==
        JSON.stringify(right.snapshot.rules) ||
      left.snapshot.prompt !== right.snapshot.prompt
    )
      return "Criterios distintos";
    if ([left.evaluation.status, right.evaluation.status].includes("error"))
      return "Revisar evaluador";
    if (left.evaluation.status === right.evaluation.status)
      return "Sin cambio de estado";
    return right.evaluation.status === "passed"
      ? "Ahora cumple"
      : "Ahora no cumple";
  };
  return (
    header(
      "03 / CONTRASTAR LA EVIDENCIA",
      "Comparar ejecuciones",
      "Compara sobre los mismos casos y criterios antes de sacar conclusiones.",
    ) +
    `<div class="compare-selectors"><label>Ejecución de referencia<select id="compare-a">${comparisonOptions(a.id)}</select></label><span aria-hidden="true">→</span><label>Ejecución a comparar<select id="compare-b">${comparisonOptions(b.id)}</select></label></div>
  ${same ? `<p class="alert warning">Seleccionaste la misma ejecución. Elige dos distintas.</p>` : !comparable ? `<p class="alert warning">Los casos o criterios cambiaron. Las tasas no son comparables y no se calcula una diferencia global.</p>` : errors ? `<p class="alert warning">Hay errores del evaluador. Resuélvelos antes de interpretar una diferencia global.</p>` : `<div class="comparison-callout"><div><small>MISMOS CASOS Y CRITERIOS</small><h2>${delta === 0 ? "Mismo porcentaje, revisa cada caso." : `Diferencia: ${delta > 0 ? "+" : ""}${delta} puntos porcentuales`}</h2><p>${rateA}% → ${rateB}%. Este porcentaje mide reglas, no calidad general de un modelo.</p></div><span class="compare-mark" aria-hidden="true">⇄</span></div>`}
  <div class="comparison-ledger"><div class="ledger-heading"><span>CASO / ABRE PARA VER LAS RESPUESTAS</span><span>REFERENCIA</span><span>COMPARACIÓN</span><span>QUÉ CAMBIÓ</span></div>${[...pairs.values()].map(({ a: left, b: right }, i) => `<details class="comparison-row"><summary><strong><span class="case-number">${String(i + 1).padStart(2, "0")}</span>${esc((right || left).snapshot.title)}</strong><span class="ledger-status"><small>Referencia</small>${left ? badge(left.evaluation.status) : "No incluido"}</span><span class="ledger-status"><small>Comparación</small>${right ? badge(right.evaluation.status) : "No incluido"}</span><span class="change-label">${esc(verdict(left, right))}</span></summary><div class="comparison-evidence"><div class="answer-grid">${[left, right].map((r, index) => `<div>${r ? answerPanel(index ? "C" : "R", r.answer, index ? "Ejecución a comparar" : "Ejecución de referencia") + `<p class="evidence-context"><strong>Instrucción:</strong> ${esc(r.snapshot.prompt)}</p><ul class="evidence-rules">${r.snapshot.rules.map((rule) => `<li>${esc(ruleDescription(rule))}</li>`).join("")}</ul>` : `<p class="muted">Este caso no está incluido en esta ejecución.</p>`}</div>`).join("")}</div><p class="help">R: referencia · C: comparación. Cada columna conserva la instrucción y las reglas usadas en esa ejecución.</p></div></details>`).join("")}</div><p class="metric-note">La revisión humana permanece en cada ejecución. Un empate global puede ocultar mejoras en unos casos y retrocesos en otros.</p><div class="compare-links"><button class="button secondary" data-action="open-run" data-id="${a.id}">Abrir referencia</button><button class="button secondary" data-action="open-run" data-id="${b.id}">Abrir comparación</button></div>`
  );
}
async function render() {
  const token = ++renderToken;
  $("#breadcrumb").textContent = labels[view];
  $("#case-count").textContent = state.cases.length;
  $("#run-count").textContent = state.runs.length;
  document.querySelectorAll("nav button").forEach((button) => {
    if (button.dataset.view === view)
      button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  try {
    if (view === "cases") $("#main").innerHTML = caseView();
    else if (view === "runs" && !selectedRun) $("#main").innerHTML = runView();
    else if (view === "runs") {
      const run = await api(`/api/run?id=${encodeURIComponent(selectedRun)}`);
      if (token === renderToken) $("#main").innerHTML = runDetail(run);
    } else if (state.runs.length < 2)
      $("#main").innerHTML =
        header(
          "03 / CONTRASTAR LA EVIDENCIA",
          "Comparar ejecuciones",
          "Necesitas dos ejecuciones para ver qué cambió.",
        ) +
        `<div class="empty"><span class="empty-symbol" aria-hidden="true">⇄</span><h2>Prueba A, después B</h2><p>Mantén los mismos casos y reglas entre ambas ejecuciones.</p>${runButton}</div>`;
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
      "Debe incluir",
      "Fragmentos separados por comas",
      "texto obligatorio",
    ],
    [
      "excludes",
      "No debe incluir",
      "Fragmentos separados por comas",
      "promesa absoluta",
    ],
    ["max_length", "Longitud máxima", "Número de caracteres", "180"],
    [
      "json_fields",
      "JSON con campos",
      "Nombres exactos, separados por comas",
      "titulo, prioridad",
    ],
  ];
  openDialog(
    `<p class="eyebrow">BIBLIOTECA DE PRUEBAS</p><h2 id="dialog-title">${c ? "Revisar caso" : "Nuevo caso"}</h2><p class="subtitle">Una instrucción, dos respuestas y condiciones que puedas comprobar.</p><form id="case-form" data-id="${c?.id || ""}"><label>Nombre del caso<input name="title" required maxlength="120" value="${esc(c?.title)}" placeholder="Ej. Una respuesta breve y útil"></label><label>Instrucción original<textarea name="prompt" required maxlength="3000" rows="2" placeholder="¿Qué le pedirías a una IA?">${esc(c?.prompt)}</textarea></label><div class="form-grid"><label>Respuesta A<textarea name="answer_a" maxlength="10000" rows="4" placeholder="Pega o escribe una respuesta">${esc(c?.answer_a)}</textarea></label><label>Respuesta B<textarea name="answer_b" maxlength="10000" rows="4" placeholder="Prueba una alternativa">${esc(c?.answer_b)}</textarea></label></div><p class="help">Son respuestas escritas o pegadas por ti. Una respuesta vacía también se puede evaluar.</p><fieldset class="rules"><legend>Reglas de evaluación</legend>${fields.map(([type, label, hint, placeholder]) => `<div class="rule-editor"><label class="check-label"><input type="checkbox" name="rule-${type}" ${rule(type) ? "checked" : ""} data-rule="${type}">${label}</label><label class="rule-value">${hint}<input name="value-${type}" ${type === "max_length" ? 'type="number" min="1" max="10000" step="1"' : 'maxlength="2100"'} value="${esc(type === "max_length" ? rule(type)?.value || "" : rule(type)?.value?.join(", ") || "")}" placeholder="${placeholder}" ${rule(type) ? "required" : "disabled"}></label></div>`).join("")}</fieldset><p class="help">El texto se busca por fragmentos sin distinguir mayúsculas. JSON exige nombres exactos en el primer nivel, sin validar sus valores. Estas reglas pueden equivocarse por falta de contexto.</p><label class="check-label"><input type="checkbox" name="active" ${c?.active !== false ? "checked" : ""}>Incluir en las próximas ejecuciones</label><div class="form-actions">${c ? `<button type="button" class="text-button danger" data-action="delete-case" data-id="${c.id}" data-write>Eliminar caso</button>` : ""}<button type="button" class="button secondary" data-action="close">Cancelar</button><button type="submit" class="button primary">Guardar caso</button></div></form>`,
  );
}
function newRun() {
  const active = state.cases.filter((c) => c.active).length;
  openDialog(
    `<p class="eyebrow">UN EXPERIMENTO REPRODUCIBLE</p><h2 id="dialog-title">Ejecutar evaluación</h2><p class="subtitle">Se evaluarán los ${active} casos activos y se guardará una copia de sus reglas y respuestas.</p><form id="run-form"><label>Nombre de la ejecución<input name="name" required maxlength="120" placeholder="Ej. Primera revisión · A" value="Evaluación ${state.runs.length + 1}"></label><label>Respuestas que quieres probar<select name="variant"><option value="a">Respuesta A de cada caso</option><option value="b">Respuesta B de cada caso</option></select></label><p class="alert info">No se llamará a ningún modelo de IA. Se comprobará el texto que ya está guardado en tus casos.</p><div class="form-actions"><button type="button" class="button secondary" data-action="close">Cancelar</button><button type="submit" class="button primary" ${active ? "" : "disabled"}>Evaluar ${active} casos</button></div>${!active ? '<p class="help">Activa al menos un caso para continuar.</p>' : ""}</form>`,
  );
}
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || busy) return;
  const { action, id } = button.dataset;
  if (action === "close") closeDialog();
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
      `<p class="eyebrow">ELIMINAR CASO</p><h2 id="dialog-title">¿Eliminar «${esc(c.title)}»?</h2><p class="subtitle">Se retirará de la biblioteca. Las ejecuciones anteriores conservan sus resultados y la copia del caso. Esta acción no se puede deshacer.</p><div class="form-actions"><button class="button secondary" data-action="edit-case" data-id="${id}">Cancelar</button><button class="button destructive" data-action="confirm-delete" data-id="${id}" data-write>Confirmar eliminación</button></div>`;
  }
  if (action === "confirm-delete") {
    if (await write({ type: "delete_case", id })) {
      closeDialog();
      await render();
      notice("Caso eliminado; historial conservado");
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
      notice("Caso guardado");
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
      notice("Evaluación guardada");
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
      notice("Revisión guardada por separado");
    }
  }
});
try {
  state = await api("/api/workspace");
  await render();
} catch (error) {
  $("#main").innerHTML =
    `<div class="empty"><h1>No se pudo abrir EvalLab</h1><p>${esc(error.message)}</p><a class="button primary" href="/">Volver a intentar</a></div>`;
}
