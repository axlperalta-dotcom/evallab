"""SQLite persistence and immutable evaluation snapshots."""
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from contextlib import contextmanager
from evaluator import InvalidCase, evaluate, signature, summarize, validate_rules


def stamp():
    return datetime.now(timezone.utc).isoformat()


def text(value, name, limit, required=True):
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise InvalidCase(f"Revisa {name}: máximo {limit} caracteres" + (" y no puede quedar vacío." if required else "."))
    return value.strip() if required else value


class NotFound(ValueError):
    pass


class Store:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.executescript("""
              CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY);
              CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, title TEXT NOT NULL,
                prompt TEXT NOT NULL, answer_a TEXT NOT NULL, answer_b TEXT NOT NULL,
                rules TEXT NOT NULL, active INTEGER NOT NULL, created_at TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, name TEXT NOT NULL,
                variant TEXT NOT NULL, created_at TEXT NOT NULL, signature TEXT NOT NULL,
                summary TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS results (id TEXT PRIMARY KEY, run_id TEXT NOT NULL
                REFERENCES runs(id) ON DELETE CASCADE, case_id TEXT NOT NULL,
                snapshot TEXT NOT NULL, answer TEXT NOT NULL, evaluation TEXT NOT NULL,
                review TEXT, reviewed_at TEXT);
              CREATE INDEX IF NOT EXISTS result_run ON results(run_id);
            """)
            db.execute("BEGIN IMMEDIATE")
            if not db.execute("SELECT 1 FROM meta WHERE key='seed-v1'").fetchone():
                samples = [
                    ("Una respuesta breve y útil", "Explica para qué sirve una API. Incluye la palabra datos y usa como máximo 180 caracteres.", "Una API permite que dos aplicaciones intercambien datos mediante solicitudes y respuestas.", "Es una interfaz que conecta programas.", [{"type": "contains", "value": ["datos"]}, {"type": "max_length", "value": 180}]),
                    ("La estructura también importa", "Devuelve solo un objeto JSON con los campos titulo y prioridad.", '{"titulo":"Revisar formulario","prioridad":"alta"}', 'Aquí tienes: {"titulo":"Revisar formulario"}', [{"type": "json_fields", "value": ["titulo", "prioridad"]}]),
                    ("Evitar promesas absolutas", "Describe una prueba automatizada sin decir que garantiza cero errores.", "Una prueba detecta fallos conocidos, pero no garantiza cero errores.", "Una prueba verifica condiciones concretas; otras fallas todavía son posibles.", [{"type": "excludes", "value": ["garantiza cero errores"]}]),
                    ("Respuesta con demasiado detalle", "Resume el objetivo de este organizador en no más de 80 caracteres.", "Este organizador permite reunir las vacantes que interesan a una persona, planear distintos proyectos y registrar todos sus avances y evidencias en un mismo espacio.", "Organiza vacantes, proyectos y evidencias para tu portafolio.", [{"type": "max_length", "value": 80}]),
                ]
                for title, prompt, a, b, rules in samples:
                    db.execute("INSERT INTO cases VALUES (?,?,?,?,?,?,?,?)", (str(uuid.uuid4()), title, prompt, a, b, json.dumps(rules, ensure_ascii=False), 1, stamp()))
                db.execute("INSERT INTO meta VALUES ('seed-v1')")

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def case(row):
        return {"id": row["id"], "title": row["title"], "prompt": row["prompt"], "answer_a": row["answer_a"], "answer_b": row["answer_b"], "rules": json.loads(row["rules"]), "active": bool(row["active"]), "created_at": row["created_at"]}

    @staticmethod
    def run(row):
        return {**dict(row), "summary": json.loads(row["summary"])}

    def snapshot(self):
        with self.connection() as db:
            db.execute("BEGIN")
            return {"cases": [self.case(r) for r in db.execute("SELECT * FROM cases ORDER BY created_at,id")], "runs": [self.run(r) for r in db.execute("SELECT * FROM runs ORDER BY created_at DESC,id DESC")]}

    def run_detail(self, run_id):
        with self.connection() as db:
            db.execute("BEGIN")
            row = db.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone()
            if not row:
                raise NotFound("La ejecución no existe.")
            results = [{**dict(r), "snapshot": json.loads(r["snapshot"]), "evaluation": json.loads(r["evaluation"]), "review": json.loads(r["review"]) if r["review"] else None} for r in db.execute("SELECT * FROM results WHERE run_id=? ORDER BY rowid", (run_id,))]
            return {**self.run(row), "results": results}

    def command(self, command):
        if not isinstance(command, dict):
            raise InvalidCase("El comando debe ser un objeto.")
        kind = command.get("type")
        if kind not in ("save_case", "delete_case", "run", "review"):
            raise InvalidCase("Comando desconocido.")
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            if kind == "save_case":
                data = command.get("data")
                if not isinstance(data, dict):
                    raise InvalidCase("Faltan los datos del caso.")
                title = text(data.get("title"), "el título", 120)
                prompt = text(data.get("prompt"), "la instrucción", 3000)
                a = text(data.get("answer_a"), "la respuesta A", 10000, False)
                b = text(data.get("answer_b"), "la respuesta B", 10000, False)
                validate_rules(data.get("rules"))
                if type(data.get("active")) is not bool:
                    raise InvalidCase("El estado activo debe ser verdadero o falso.")
                case_id = command.get("id")
                if case_id is not None:
                    text(case_id, "el identificador", 36)
                    if not db.execute("SELECT 1 FROM cases WHERE id=?", (case_id,)).fetchone():
                        raise NotFound("El caso ya no existe.")
                    db.execute("UPDATE cases SET title=?,prompt=?,answer_a=?,answer_b=?,rules=?,active=? WHERE id=?", (title, prompt, a, b, json.dumps(data["rules"], ensure_ascii=False), int(data["active"]), case_id))
                else:
                    if db.execute("SELECT count(*) FROM cases").fetchone()[0] >= 200:
                        raise InvalidCase("Este prototipo admite hasta 200 casos.")
                    case_id = str(uuid.uuid4())
                    db.execute("INSERT INTO cases VALUES (?,?,?,?,?,?,?,?)", (case_id, title, prompt, a, b, json.dumps(data["rules"], ensure_ascii=False), int(data["active"]), stamp()))
                return {"id": case_id}
            if kind == "delete_case":
                case_id = text(command.get("id"), "el identificador", 36)
                if not db.execute("DELETE FROM cases WHERE id=?", (case_id,)).rowcount:
                    raise NotFound("El caso ya no existe.")
                return {"id": case_id}
            if kind == "run":
                name = text(command.get("name"), "el nombre de la ejecución", 120)
                variant = command.get("variant")
                if variant not in ("a", "b"):
                    raise InvalidCase("Elige respuesta A o B.")
                cases = [self.case(r) for r in db.execute("SELECT * FROM cases WHERE active=1 ORDER BY created_at,id")]
                if not cases:
                    raise InvalidCase("Activa al menos un caso antes de ejecutar.")
                results = [evaluate(case, case[f"answer_{variant}"]) for case in cases]
                run_id = str(uuid.uuid4())
                db.execute("INSERT INTO runs VALUES (?,?,?,?,?,?)", (run_id, name, variant, stamp(), signature(cases), json.dumps(summarize(results))))
                for case, result in zip(cases, results):
                    snapshot = {key: case[key] for key in ("id", "title", "prompt", "rules")}
                    db.execute("INSERT INTO results VALUES (?,?,?,?,?,?,NULL,NULL)", (str(uuid.uuid4()), run_id, case["id"], json.dumps(snapshot, ensure_ascii=False), case[f"answer_{variant}"], json.dumps(result, ensure_ascii=False)))
                return {"id": run_id}
            if kind == "review":
                result_id = text(command.get("id"), "el identificador", 36)
                decision = command.get("decision")
                if decision not in ("agree", "disagree", "unsure"):
                    raise InvalidCase("Elige una valoración de la revisión.")
                note = text(command.get("note"), "tu explicación", 2000)
                updated = db.execute("UPDATE results SET review=?,reviewed_at=? WHERE id=?", (json.dumps({"decision": decision, "note": note}, ensure_ascii=False), stamp(), result_id))
                if not updated.rowcount:
                    raise NotFound("El resultado no existe.")
                return {"id": result_id}
