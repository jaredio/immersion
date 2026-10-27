"""Real temporary Firefox add-on check, with local HTTPS fixtures behind an isolated proxy.

No user browser profile, provider session or payment is used. Requires the existing
Playwright Firefox binary and Python cryptography for a disposable fixture certificate.
"""
import datetime
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'tmp' / 'firefox-support-installed'
WORK.mkdir(parents=True, exist_ok=True)
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Immersion local test')])
now = datetime.datetime.now(datetime.timezone.utc)
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
        .serial_number(x509.random_serial_number()).not_valid_before(now-datetime.timedelta(minutes=1))
        .not_valid_after(now+datetime.timedelta(days=1)).add_extension(x509.SubjectAlternativeName([
            x509.DNSName('kick.com'), x509.DNSName('kickbot.com'), x509.DNSName('streamelements.com')]), critical=False).sign(key, hashes.SHA256()))
(WORK/'key.pem').write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
(WORK/'cert.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
tls.load_cert_chain(WORK/'cert.pem', WORK/'key.pem')
fixture = (ROOT/'tests/fixture.html').read_text(encoding='utf-8').replace('<button>Follow</button>', '<div style="display:flex;gap:8px"><button data-testid="follow-button">Follow</button><button data-testid="sub-button">Subscribe</button></div>')
# Client-rendered checkout controls without a literal form reproduce the missed-ready regression.
form = '''<!doctype html><html><head><title>KickBot checkout fixture</title><script>window.fixtureInlineScriptExecuted=true</script></head><body><header class="fixed"><a href="/">Provider navigation</a></header><main><div><div><section><div><h1>KickBot checkout fixture</h1><p>$1 for TTS</p></div></section><section aria-labelledby="tip-amount-title"><h2 id="tip-amount-title">Amount</h2><div><div><button aria-pressed="false">$5</button></div><div><label>Amount<input id="custom-tip-amount" name="amount" min="1" max="500"></label></div></div></section><section aria-labelledby="tip-message-title"><h2 id="tip-message-title">Your message</h2><div><div><label>Name<input id="tip-name" name="username"></label></div><div><textarea id="tip-message" maxlength="150"></textarea></div></div></section></div><aside aria-labelledby="tip-summary-title"><div><h2 id="tip-summary-title">Your tip</h2><button role="checkbox" aria-checked="false" aria-labelledby="tip-terms"></button><p id="tip-terms">Provider terms <a href="/terms">Terms of service</a></p><button id="test-payment" disabled>Continue to payment</button></div></aside></div></main><footer><nav aria-label="Footer">Provider navigation</nav></footer></body></html>'''
se_form = '''<!doctype html><html><head><title>StreamElements checkout fixture</title><script>window.fixtureInlineScriptExecuted=true</script></head><body><div id="root"><div data-slot="page-background"><div><main data-slot="single-card"><form data-slot="tipping-form"><fieldset data-slot="tipping-form-group"><label data-slot="tip-preset-button"><input name="preset" type="radio" value="5">$5</label><label>Your name<div data-slot="input-group"><input name="tipperUsername"></div></label><label>Message<div data-slot="input-group"><textarea name="message"></textarea></div></label></fieldset><p>Provider terms</p><div data-slot="payment-cta-bar"><button disabled>Continue</button></div></form></main></div></div></div></body></html>'''

class Proxy(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_CONNECT(self):
        self.send_response(200)
        self.end_headers()
        try:
            self.connection = tls.wrap_socket(self.connection, server_side=True)
            self.rfile = self.connection.makefile('rb')
            self.wfile = self.connection.makefile('wb')
            self.handle_one_request()
        except (OSError, ssl.SSLError):
            pass
        self.close_connection = True

    def do_GET(self):
        host = self.headers.get('Host', '')
        blocked = host in ['kickbot.com','streamelements.com']
        if blocked:
            body, content_type = se_form if host=='streamelements.com' else form, 'text/html'
        elif self.path.startswith('/api/v2/channels/'):
            body, content_type = json.dumps({'user': {'username': 'aurora', 'bio': ''}, 'livestream': None}), 'application/json'
        elif self.path.endswith('/links'):
            body, content_type = json.dumps([{'title': 'Support', 'link': 'https://kickbot.com/tips/custom-brand'},{'title':'Tips','link':'https://streamelements.com/xqc/tip'}]), 'application/json'
        elif host == 'kick.com':
            body, content_type = fixture, 'text/html'
        else:
            body, content_type = '{}', 'application/json'
        data = body.encode()
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Connection', 'close')
        if blocked:
            self.send_header('X-Frame-Options', 'DENY')
            self.send_header('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; object-src 'none'")
        self.end_headers()
        self.wfile.write(data)
        self.close_connection = True

proxy = ThreadingHTTPServer(('127.0.0.1', 0), Proxy)
proxy.daemon_threads = True
threading.Thread(target=proxy.serve_forever, daemon=True).start()
with socket.socket() as port_socket:
    port_socket.bind(('127.0.0.1', 0))
    port = port_socket.getsockname()[1]
profile = WORK/'profile'
profile.mkdir(exist_ok=True)
prefs = {'marionette.port': port, 'network.proxy.type': 1, 'network.proxy.http': '127.0.0.1',
         'network.proxy.http_port': proxy.server_port, 'network.proxy.ssl': '127.0.0.1',
         'network.proxy.ssl_port': proxy.server_port, 'network.proxy.no_proxies_on': '',
         'network.trr.mode': 5, 'browser.shell.checkDefaultBrowser': False,
         'dom.disable_open_during_load': False,
         'browser.startup.homepage_override.mstone': 'ignore', 'datareporting.policy.dataSubmissionEnabled': False,
         'toolkit.telemetry.enabled': False, 'browser.newtabpage.enabled': False}
(profile/'user.js').write_text('\n'.join('user_pref('+json.dumps(k)+', '+json.dumps(v)+');' for k, v in prefs.items()))
binary = next((Path(os.environ['LOCALAPPDATA'])/'ms-playwright').glob('firefox-*/firefox/firefox.exe'))
env = {**os.environ, 'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS': '1'}
log = (WORK/'browser.log').open('w')
process = subprocess.Popen([str(binary), '-headless', '-no-remote', '-marionette', '-profile', str(profile), 'about:blank'], env=env, stdout=log, stderr=log, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
connection = None
try:
    deadline = time.monotonic()+25
    while time.monotonic()<deadline:
        try:
            connection = socket.create_connection(('127.0.0.1', port), timeout=1)
            break
        except OSError:
            time.sleep(.2)
    if not connection:
        raise RuntimeError('Firefox Marionette did not start')
    connection.settimeout(30)
    stream = connection.makefile('rb')
    def receive():
        prefix = b''
        while not prefix.endswith(b':'):
            part = stream.read(1)
            if not part:
                raise RuntimeError('Firefox disconnected')
            prefix += part
        return json.loads(stream.read(int(prefix[:-1])))
    receive()
    sequence = 0
    def command(name, args=None):
        global sequence
        sequence += 1
        body = json.dumps([0, sequence, name, args or {}]).encode()
        connection.sendall(str(len(body)).encode()+b':'+body)
        reply = receive()
        if reply[2]:
            raise RuntimeError(str(reply[2]))
        return reply[3]
    def script(value):
        return command('WebDriver:ExecuteScript', {'script': value, 'args': [], 'newSandbox': True, 'sandbox': 'default'})['value']
    def wait(value):
        deadline = time.monotonic()+20
        while time.monotonic()<deadline:
            result = script(value)
            if result:
                return result
            time.sleep(.15)
        raise AssertionError('Timed out: '+value)
    command('WebDriver:NewSession', {'acceptInsecureCerts': True})
    time.sleep(1)
    handles = command('WebDriver:GetWindowHandles')
    if isinstance(handles, dict):
        handles = handles['value']
    command('WebDriver:SwitchToWindow', {'handle': handles[-1]})
    command('Addon:Install', {'path': str(ROOT/'dist/immersion-firefox.zip'), 'temporary': True})
    command('WebDriver:Navigate', {'url': 'https://kick.com/aurora'})
    wait("return !!document.querySelector('[data-kr-support]')")
    script("document.querySelector('#kr-root').shadowRoot.querySelector('#kr-settings').click();return true")
    assert script("return document.querySelector('#kr-root').shadowRoot.querySelector('#settings-dialog').open"), 'settings remain available in the Firefox build'
    script("document.querySelector('#kr-root').shadowRoot.querySelector('#settings-dialog').close();return true")
    script("document.querySelector('[data-kr-support]').click();return true")
    wait("return !!document.querySelector('#kr-support-root')?.shadowRoot.querySelector('iframe')")
    wait("return document.querySelector('#kr-support-root').shadowRoot.querySelector('#support-status').hidden && !!document.querySelector('#kr-support-root').shadowRoot.querySelector('iframe')")
    frame = script("return document.querySelector('#kr-support-root').shadowRoot.querySelector('iframe')")
    command('WebDriver:SwitchToFrame', {'id': frame})
    wait("return document.querySelector('h1')?.textContent==='KickBot checkout fixture'")
    wait("return document.documentElement.dataset.immersionTip==='kickbot'")
    assert script("return !!document.querySelector('input[name=amount]')")
    assert script("return getComputedStyle(document.querySelector('input[name=amount]')).borderRadius==='9px'")
    assert script("return window.fixtureInlineScriptExecuted===undefined"), 'other CSP rules must remain enforced'
    assert script("return getComputedStyle(document.querySelector('header')).display==='none'"), 'provider navigation is hidden'
    assert script("return getComputedStyle(document.querySelector('footer')).display==='none'"), 'provider footer is hidden'
    assert script("return getComputedStyle(document.querySelector('#tip-terms')).display!=='none'"), 'provider terms stay visible'
    assert script("return document.querySelector('button[role=checkbox]').getAttribute('aria-checked')==='false'"), 'styling must not accept terms'
    assert script("return document.querySelector('#test-payment').disabled"), 'styling preserves checkout validation'
    script("document.querySelector('input[name=username]').value='preview-only';return true")
    command('WebDriver:SwitchToFrame', {'id': None})
    time.sleep(16)
    assert script("return document.querySelector('#kr-support-root').shadowRoot.querySelector('#support-status').hidden"), 'a visible checkout must not keep showing Loading'
    assert script("return document.querySelector('#kr-support-root').shadowRoot.querySelector('iframe')") == frame, 'the existing checkout must survive beyond the old timeout'
    command('WebDriver:SwitchToFrame', {'id': frame})
    assert script("return document.querySelector('input[name=username]').value==='preview-only'"), 'typed checkout data is preserved'
    command('WebDriver:SwitchToFrame', {'id': None})
    handles_before = command('WebDriver:GetWindowHandles')
    if isinstance(handles_before, dict):
        handles_before = handles_before['value']
    script("document.querySelector('#kr-support-root').shadowRoot.querySelector('#support-popout').click();return true")
    popup_handle = None
    for _ in range(50):
        handles = command('WebDriver:GetWindowHandles')
        if isinstance(handles, dict):
            handles = handles['value']
        popup_handle = next((handle for handle in handles if handle not in handles_before), None)
        if popup_handle:
            break
        time.sleep(.1)
    assert popup_handle, 'checkout popout opens'
    command('WebDriver:SwitchToWindow', {'handle': popup_handle})
    wait("return document.documentElement.dataset.immersionTip==='kickbot'")
    assert script("return window.opener===null"), 'popout remains isolated from the Kick page'
    assert script("return location.hash==='#immersion-checkout'"), 'only an explicitly opened popout opts into styling'
    command('WebDriver:CloseWindow')
    command('WebDriver:SwitchToWindow', {'handle': handles_before[-1]})
    # Navigate this same frame without a new intent: the one-use exception must be gone.
    command('WebDriver:SwitchToFrame', {'id': None})
    script("document.querySelector('#kr-support-root').shadowRoot.querySelector('iframe').src='https://kickbot.com/tips/unselected';return true")
    time.sleep(.5)
    frame = script("return document.querySelector('#kr-support-root').shadowRoot.querySelector('iframe')")
    command('WebDriver:SwitchToFrame', {'id': frame})
    assert not script("return !!document.querySelector('input[name=amount]')"), 'an unselected tip page must still be blocked'
    command('Marionette:SetContext', {'value': 'chrome'})
    wait("return Services.console.getMessageArray().some(m=>m.message.includes('frame-ancestors') && m.message.includes('https://kickbot.com/tips/unselected'))")
    command('Marionette:SetContext', {'value': 'content'})
    command('WebDriver:SwitchToFrame', {'id': None})
    script("const select=document.querySelector('#kr-support-root').shadowRoot.querySelector('#support-provider');select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));return true")
    wait("return document.querySelector('#kr-support-root').shadowRoot.querySelector('iframe')?.src==='https://streamelements.com/xqc/tip'")
    wait("return document.querySelector('#kr-support-root').shadowRoot.querySelector('#support-status').hidden")
    se_frame = script("return document.querySelector('#kr-support-root').shadowRoot.querySelector('iframe')")
    command('WebDriver:SwitchToFrame', {'id': se_frame})
    wait("return document.documentElement.dataset.immersionTip==='streamelements'")
    assert script("return !!document.querySelector('input[name=tipperUsername]')"), 'StreamElements checkout loads in the panel'
    assert script("return document.querySelector('[data-slot=payment-cta-bar] button').disabled"), 'StreamElements validation is preserved'
    assert script("return window.fixtureInlineScriptExecuted===undefined"), 'StreamElements retains its other security rules'
    print('PASS installed Firefox add-on: redesigned controls, visible terms, native validation, matching isolated popout, timeout/draft preservation and framing scope. No payment submitted.')
finally:
    if connection:
        connection.close()
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
    log.close()
    proxy.shutdown()
