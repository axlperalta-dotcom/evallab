import http.client
import json
import tempfile
import threading
import unittest
from pathlib import Path
from http.server import ThreadingHTTPServer
from server import make_handler
from storage import Store


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory(prefix="evallab-http-")
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(Store(Path(cls.folder.name) / "test.sqlite3")))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.folder.cleanup()

    def request(self, path, method="GET", data=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        try:
            connection.request(method, path, body=data, headers=headers or {})
            response = connection.getresponse()
            return response.status, response.read(), dict(response.getheaders())
        finally:
            connection.close()

    def test_read_and_static_content_are_available(self):
        status, body, headers = self.request("/api/workspace")
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(body)["cases"]), 4)
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(self.request("/")[0], 200)

    def test_external_origin_and_host_are_blocked(self):
        self.assertEqual(self.request("/api/workspace", headers={"Host": "attacker.example"})[0], 403)
        self.assertEqual(self.request("/api/command", "POST", "{}", {"Content-Type": "application/json", "Origin": "https://attacker.example"})[0], 403)

    def test_data_and_path_traversal_are_not_served(self):
        for path in ("/../storage.py", "/%2e%2e/storage.py", "/.data/evallab.sqlite3", "/server.py"):
            self.assertEqual(self.request(path)[0], 404)

    def test_invalid_commands_are_explicit_client_errors(self):
        self.assertEqual(self.request("/api/command", "POST", "{}")[0], 415)
        for payload in ("invalid", "[]", '{"type":"unknown"}', '{"type":"run","variant":"c","name":"Test"}'):
            self.assertEqual(self.request("/api/command", "POST", payload, {"Content-Type": "application/json"})[0], 400)


if __name__ == "__main__":
    unittest.main()
