"""Deterministic evaluation only: no model calls and no execution of answer text."""
import hashlib
import json
import unicodedata


class InvalidCase(ValueError):
    pass


def normalize(value):
    return unicodedata.normalize("NFKC", value).casefold()


def validate_rules(rules):
    if not isinstance(rules, list) or not 1 <= len(rules) <= 4:
        raise InvalidCase("Activa entre una y cuatro reglas para evaluar el caso.")
    seen = set()
    for rule in rules:
        if not isinstance(rule, dict):
            raise InvalidCase("Cada regla debe ser un objeto.")
        kind = rule.get("type")
        if kind not in ("contains", "excludes", "max_length", "json_fields"):
            raise InvalidCase("Tipo de regla desconocido.")
        if kind in seen:
            raise InvalidCase("No repitas el mismo tipo de regla.")
        seen.add(kind)
        value = rule.get("value")
        if kind == "max_length":
            if type(value) is not int or not 1 <= value <= 10000:
                raise InvalidCase("El límite debe ser un entero entre 1 y 10000 caracteres.")
        elif not isinstance(value, list) or not 1 <= len(value) <= 20 or any(
            not isinstance(term, str) or not term.strip() or len(term) > 100 for term in value
        ):
            raise InvalidCase("Indica entre uno y veinte términos o campos, de hasta 100 caracteres.")


def signature(cases):
    """Answers intentionally excluded: the same criteria may evaluate different variants."""
    definitions = [{"id": c["id"], "prompt": c["prompt"], "rules": c["rules"]} for c in cases]
    payload = json.dumps(sorted(definitions, key=lambda c: c["id"]), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()


def check_rule(rule, answer):
    kind, value = rule["type"], rule["value"]
    if kind == "contains":
        missing = [term for term in value if normalize(term) not in normalize(answer)]
        return {"label": "Texto obligatorio", "passed": not missing, "detail": "Falta: " + ", ".join(missing) if missing else "Aparecen todos los fragmentos requeridos."}
    if kind == "excludes":
        found = [term for term in value if normalize(term) in normalize(answer)]
        return {"label": "Texto no permitido", "passed": not found, "detail": "Se encontró: " + ", ".join(found) if found else "No aparecen los fragmentos excluidos."}
    if kind == "max_length":
        return {"label": "Longitud máxima", "passed": len(answer) <= value, "detail": f"{len(answer)} de {value} caracteres permitidos."}
    if kind == "json_fields":
        try:
            data = json.loads(answer, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
        except (ValueError, RecursionError):
            return {"label": "JSON con campos", "passed": False, "detail": "La respuesta no es JSON válido. No incluyas bloques de Markdown."}
        if not isinstance(data, dict):
            return {"label": "JSON con campos", "passed": False, "detail": "Se esperaba un objeto JSON, no una lista ni un valor simple."}
        missing = [field for field in value if field not in data]
        return {"label": "JSON con campos", "passed": not missing, "detail": "Faltan campos: " + ", ".join(missing) if missing else "Existen los campos solicitados en el primer nivel; sus valores no se califican."}
    raise InvalidCase("Regla desconocida.")


def evaluate(case, answer):
    try:
        validate_rules(case.get("rules"))
        if not isinstance(answer, str):
            raise InvalidCase("La respuesta debe ser texto.")
    except InvalidCase as exc:
        return {"status": "error", "error_kind": "configuration", "checks": [], "detail": str(exc)}
    try:
        checks = [check_rule(rule, answer) for rule in case["rules"]]
        return {"status": "passed" if all(c["passed"] for c in checks) else "failed", "error_kind": None, "checks": checks, "detail": ""}
    except Exception:
        # Technical details belong in diagnostics, not in a misleading answer score.
        import logging
        logging.exception("Evaluator failed for case %s", case.get("id"))
        return {"status": "error", "error_kind": "evaluator", "checks": [], "detail": "Falló el evaluador. Esta respuesta no se calificó; revisa el registro del servidor."}


def summarize(results):
    counts = {status: sum(r["status"] == status for r in results) for status in ("passed", "failed", "error")}
    evaluated = counts["passed"] + counts["failed"]
    return {**counts, "total": len(results), "evaluated": evaluated, "rate": round(100 * counts["passed"] / evaluated, 1) if evaluated else None}
