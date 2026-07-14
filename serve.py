#!/usr/bin/env python3
"""Static file server for local development/preview.

Sends no-cache headers on every response. Without this, browsers can keep
serving a stale index.html/app.js/scores.js after an edit (especially inside
a proxied preview iframe), which looks like the page is "stuck" — e.g. a
cached scores.js from before an HTML change looking for an element id that no
longer exists, silently doing nothing. This is dev-only; GitHub Pages (the
real, public hosting for this site) serves the files as-is and isn't affected.
"""

import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    http.server.test(HandlerClass=NoCacheHandler, port=port)
