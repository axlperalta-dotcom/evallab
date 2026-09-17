import en from "/en.js";

const storageKey = "evallab.language";
let current = "es";
try {
  if (localStorage.getItem(storageKey) === "en") current = "en";
} catch {
  // The UI still works when browser storage is unavailable.
}

export const language = () => current;
export const t = (source) =>
  current === "en" ? (en[source] ?? source) : source;

export function setLanguage(value) {
  current = value === "en" ? "en" : "es";
  try {
    localStorage.setItem(storageKey, current);
    return true;
  } catch {
    return false;
  }
}

// Historical evaluations keep their original data. Only known engine messages
// are localized for display; interpolated rule terms remain exactly as stored.
export function localizeMessage(source) {
  if (current !== "en") return source;
  if (Object.hasOwn(en, source)) return en[source];
  const prefixes = [
    ["Falta: ", "Missing: "],
    ["Se encontró: ", "Found: "],
    ["Faltan campos: ", "Missing fields: "],
  ];
  for (const [from, to] of prefixes) {
    if (source.startsWith(from)) return to + source.slice(from.length);
  }
  const length = source.match(/^(\d+) de (\d+) caracteres permitidos\.$/);
  if (length) return `${length[1]} of ${length[2]} characters allowed.`;
  const field = source.match(
    /^Revisa (.+): máximo (\d+) caracteres( y no puede quedar vacío\.|\.)$/,
  );
  if (field) {
    const names = {
      "el título": "the title",
      "la instrucción": "the prompt",
      "la respuesta A": "answer A",
      "la respuesta B": "answer B",
      "el identificador": "the identifier",
      "el nombre de la ejecución": "the run name",
      "tu explicación": "your explanation",
    };
    return `Check ${names[field[1]] || field[1]}: maximum ${field[2]} characters${field[3] === "." ? "." : "; it cannot be empty."}`;
  }
  return source;
}
