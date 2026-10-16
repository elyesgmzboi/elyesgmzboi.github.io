# Local server for the site: like `python -m http.server`, but tells the browser never to cache, so every reload
# runs the current files (ES modules are otherwise cached heuristically and an edit can go unseen).
import http.server, functools, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm',
                      '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, *a): pass

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8642
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(NoCache, directory=root)).serve_forever()
