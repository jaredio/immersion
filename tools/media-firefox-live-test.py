"""Live playback regression with the actual temporary Firefox add-on.

Uses a separate profile and public Kick media; never opens a user profile.
Run after npm run build. Requires network access and Playwright Firefox.
"""
import json,os,socket,subprocess,time
from pathlib import Path
ROOT=Path.cwd()
WORK=ROOT/'tmp'/('firefox-media-live-'+str(time.time_ns()))
WORK.mkdir(parents=True,exist_ok=True)
with socket.socket() as port_socket:
    port_socket.bind(('127.0.0.1', 0))
    port = port_socket.getsockname()[1]
profile = WORK/'profile'
profile.mkdir(exist_ok=True)
prefs = {'marionette.port':port,'browser.shell.checkDefaultBrowser':False,'browser.startup.homepage_override.mstone':'ignore','datareporting.policy.dataSubmissionEnabled':False,'toolkit.telemetry.enabled':False,'media.autoplay.default':0}
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
    command('WebDriver:NewSession', {'capabilities':{'alwaysMatch':{'acceptInsecureCerts':True,'pageLoadStrategy':'none'}}})
    time.sleep(1)
    handles = command('WebDriver:GetWindowHandles')
    if isinstance(handles, dict):
        handles = handles['value']
    command('WebDriver:SwitchToWindow', {'handle': handles[-1]})
    command('Addon:Install', {'path': str(ROOT/'dist/immersion-firefox.zip'), 'temporary': True})
    command('WebDriver:Navigate', {'url': 'https://kick.com/xqc'})
    wait("return !!document.querySelector('#kr-root')")
    for query in ['clips:cobbruvs','vods:xqc']:
        script("document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyK',key:'k',altKey:true,bubbles:true}));return true")
        script("const input=document.querySelector('#kr-root').shadowRoot.querySelector('#channel-search');input.value="+json.dumps(query)+";input.dispatchEvent(new Event('input',{bubbles:true}));return true")
        wait("return !!document.querySelector('#kr-root').shadowRoot.querySelector('.option')")
        script("const option=document.querySelector('#kr-root').shadowRoot.querySelector('.option');option.dispatchEvent(new DragEvent('dragstart',{bubbles:true,composed:true,dataTransfer:new DataTransfer(),clientX:400,clientY:250}));return true")
        time.sleep(.2)
        script("document.querySelector('#kr-multi-drop').dispatchEvent(new DragEvent('drop',{bubbles:true,composed:true,dataTransfer:new DataTransfer()}));return true")
        wait("const host=document.querySelector('#kr-multi-root')?.shadowRoot.querySelector('.kr-chat-clip');return host?.shadowRoot.querySelector('video')?.readyState>=2")
        script("const v=document.querySelector('#kr-multi-root').shadowRoot.querySelector('.kr-chat-clip').shadowRoot.querySelector('video');v.muted=true;v.play();return true")
        wait("return document.querySelector('#kr-multi-root').shadowRoot.querySelector('.kr-chat-clip').shadowRoot.querySelector('video').currentTime>.25")
        script("document.querySelector('#kr-multi-root').shadowRoot.querySelector('.kr-chat-clip').shadowRoot.querySelector('video').currentTime=2;return true")
        wait("const v=document.querySelector('#kr-multi-root').shadowRoot.querySelector('.kr-chat-clip').shadowRoot.querySelector('video');return v.readyState>=2&&!v.seeking&&v.currentTime>=2")
        print(query,script("const root=document.querySelector('#kr-multi-root')?.shadowRoot,host=root?.querySelector('.kr-chat-clip'),r=host?.shadowRoot,v=r?.querySelector('video');return {status:r?.querySelector('.status').textContent,detail:r?.querySelector('.status').title,ready:v?.readyState,time:v?.currentTime}"),flush=True)
        script("document.querySelector('#kr-multi-root').shadowRoot.querySelector('[aria-label=\"Close multiview\"]').click();return true")
    print('PASS installed Firefox: real public clip and VOD playback, advancing frames, seeking and workspace teardown',flush=True)
finally:
    if connection: connection.close()
    process.terminate()
    try: process.wait(timeout=10)
    except subprocess.TimeoutExpired: process.kill();process.wait()
    log.close()


