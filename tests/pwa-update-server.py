#!/usr/bin/env python3
"""Disposable deployment fixture for pwa-update-browser-check.js (localhost:8081)."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import os
import shutil
import subprocess
import tempfile
import time

project = Path(__file__).resolve().parents[1]
release = 'one'

with tempfile.TemporaryDirectory(prefix='0815-pwa-deploy-') as temp:
    root = Path(temp)
    source = root / 'source'
    source.mkdir()
    for name in ['bin', 'src', 'assets', 'index.html', 'manifest.webmanifest', 'sw.js', 'package.json']:
        if (project / name).is_dir():
            shutil.copytree(project / name, source / name)
        else:
            shutil.copy2(project / name, source / name)
    original_html = (source / 'index.html').read_text()
    original_signature = (source / 'assets/signature.css').read_text()
    for i, name in enumerate(['one', 'two', 'three']):
        (source / 'index.html').write_text(original_html.replace('<html lang="de">', f'<html lang="de" data-release="{name}">'))
        # Distinct stylesheet bytes expose stale asset caches as well as stale HTML.
        override = ['#2c2c29', '#20201e', None][i]
        stylesheet = original_signature + (f'\nhtml[data-theme="signature"] {{ --surface-page: {override}; }}\n' if override else '')
        (source / 'assets/signature.css').write_text(stylesheet)
        subprocess.run(['node', str(source / 'bin/build-pages')], check=True, capture_output=True)
        shutil.copytree(source / 'dist', root / name)
        # Model distinct release Last-Modified values, not three files in one second.
        stamp = time.time() - 300 + i * 60
        for file in (root / name).rglob('*'):
            if file.is_file():
                os.utime(file, (stamp, stamp))

    class Handler(SimpleHTTPRequestHandler):
        def do_GET(self):
            global release
            url = urlsplit(self.path)
            if url.path == '/__release':
                choice = parse_qs(url.query).get('version', [''])[0]
                if choice not in ['one', 'two', 'three']:
                    self.send_error(400)
                    return
                release = choice
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'ok')
                return
            if url.path == '/app':
                self.send_response(301)
                self.send_header('Location', '/app/')
                self.end_headers()
                return
            if not url.path.startswith('/app/'):
                self.send_error(404)
                return
            self.directory = str(root / release)
            self.path = url.path[4:]
            super().do_GET()

        def end_headers(self):
            self.send_header('Cache-Control', 'public, max-age=3600')
            super().end_headers()

        def log_message(self, *args):
            pass

    print('Disposable PWA deployment fixture: http://127.0.0.1:8081/app/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8081), Handler).serve_forever()
