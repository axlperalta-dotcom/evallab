"""Local-only development server. Python standard library; no cloud or model keys."""
import argparse
import json
import logging
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from evaluator import InvalidCase
from storage import Store, NotFound

ROOT = Path(__file__).resolve().parent
STATIC = {"/": ("index.html", "text/html; charset=utf-8"), "/app.js": ("app.js", "text/javascript; charset=utf-8"), "/styles.css": ("styles.css", "text/css; charset=utf-8"), "/favicon.svg": ("favicon.svg", "image/svg+xml")}


def make_handler(store):
    class Handler(BaseHTTPRequestHandler):
        def local(self):
            port = self.server.server_port
            hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
            host = self.headers.get("Host", "")
            origin = self.headers.get("Origin")
            return host in hosts and (origin is None or origin == f"http://{host}")

        def respond(self, status, body, content_type="application/json; charset=utf-8"):
            payload = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self):
            if not self.local():
                return self.respond(403, {"error": "Origen no permitido."})
            parsed = urlparse(self.path)
            try:
                if parsed.path in STATIC:
                    filename, mime = STATIC[parsed.path]
                    return self.respond(200, (ROOT / "static" / filename).read_bytes(), mime)
                if parsed.path == "/api/workspace":
                    return self.respond(200, store.snapshot())
                if parsed.path == "/api/run":
                    return self.respond(200, store.run_detail(parse_qs(parsed.query).get("id", [""])[0]))
                return self.respond(404, {"error": "No se encontró esta página."})
            except NotFound as exc:
                return self.respond(404, {"error": str(exc)})
            except Exception:
                logging.exception("Read failed")
                return self.respond(500, {"error": "No se pudieron cargar los datos."})

        def do_POST(self):
            if not self.local():
                return self.respond(403, {"error": "Origen no permitido."})
            if urlparse(self.path).path != "/api/command":
                return self.respond(404, {"error": "Ruta no encontrada."})
            if self.headers.get_content_type() != "application/json":
                return self.respond(415, {"error": "Se requiere JSON."})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 150000:
                    return self.respond(413, {"error": "Contenido vacío o demasiado grande."})
                command = json.loads(self.rfile.read(length))
                result = store.command(command)
                return self.respond(200, result)
            except NotFound as exc:
                return self.respond(404, {"error": str(exc)})
            except (InvalidCase, ValueError, UnicodeDecodeError, RecursionError) as exc:
                return self.respond(400, {"error": str(exc) if isinstance(exc, InvalidCase) else "Contenido inválido."})
            except Exception:
                logging.exception("Command failed")
                return self.respond(500, {"error": "No se pudo guardar. Revisa los registros del servidor."})
    return Handler


def main():
    parser = argparse.ArgumentParser(description="EvalLab, evaluación local de respuestas")
    parser.add_argument("--port", type=int, default=3001)
    args = parser.parse_args()
    store = Store(Path(os.environ.get("EVALLAB_DATA_DIR", ROOT / ".data")) / "evallab.sqlite3")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(store))
    print(f"EvalLab listo en http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
