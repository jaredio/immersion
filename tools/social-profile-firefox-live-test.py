"""Check GEWN's real profile hovers in a fresh Firefox with the packaged add-on."""
import base64,json,os,socket,subprocess,sys,time
from pathlib import Path

ROOT=Path.cwd()
PHOTO_ONLY='--photo-only' in sys.argv
X_ONLY='--x-only' in sys.argv
WORK=ROOT/'tmp'/('firefox-social-live-'+str(time.time_ns()))
WORK.mkdir(parents=True)
with socket.socket() as reserved:
    reserved.bind(('127.0.0.1',0))
    port=reserved.getsockname()[1]
profile=WORK/'profile'
profile.mkdir()
prefs={'marionette.port':port,'browser.shell.checkDefaultBrowser':False,'browser.startup.homepage_override.mstone':'ignore','datareporting.policy.dataSubmissionEnabled':False,'toolkit.telemetry.enabled':False,'media.autoplay.default':5}
(profile/'user.js').write_text('\n'.join('user_pref('+json.dumps(k)+','+json.dumps(v)+');' for k,v in prefs.items()))
binary=next((Path(os.environ['LOCALAPPDATA'])/'ms-playwright').glob('firefox-*/firefox/firefox.exe'))
log=(WORK/'browser.log').open('w')
process=subprocess.Popen([str(binary),'-headless','-no-remote','-marionette','-profile',str(profile),'about:blank'],env={**os.environ,'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS':'1'},stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
connection=None
try:
    deadline=time.monotonic()+25
    while time.monotonic()<deadline:
        try:
            connection=socket.create_connection(('127.0.0.1',port),timeout=1)
            break
        except OSError:
            time.sleep(.2)
    if not connection:
        raise RuntimeError('Firefox Marionette did not start')
    connection.settimeout(35)
    stream=connection.makefile('rb')
    def receive():
        prefix=b''
        while not prefix.endswith(b':'):
            part=stream.read(1)
            if not part:
                raise RuntimeError('Firefox disconnected')
            prefix+=part
        return json.loads(stream.read(int(prefix[:-1])))
    receive()
    sequence=0
    def command(name,args=None):
        global sequence
        sequence+=1
        body=json.dumps([0,sequence,name,args or {}]).encode()
        connection.sendall(str(len(body)).encode()+b':'+body)
        reply=receive()
        if reply[2]:
            raise RuntimeError(str(reply[2]))
        return reply[3]
    def script(value):
        return command('WebDriver:ExecuteScript',{'script':value,'args':[],'newSandbox':True,'sandbox':'default'})['value']
    def wait(value,timeout=30):
        deadline=time.monotonic()+timeout
        while time.monotonic()<deadline:
            result=script(value)
            if result:
                return result
            time.sleep(.15)
        raise AssertionError('Timed out: '+value)
    command('WebDriver:NewSession',{'capabilities':{'alwaysMatch':{'acceptInsecureCerts':True,'pageLoadStrategy':'none'}}})
    handles=command('WebDriver:GetWindowHandles')
    if isinstance(handles,dict):
        handles=handles['value']
    command('WebDriver:SwitchToWindow',{'handle':handles[-1]})
    command('Addon:Install',{'path':str(ROOT/'dist/immersion-firefox.zip'),'temporary':True})
    command('WebDriver:Navigate',{'url':'https://kick.com/gewn'})
    wait("return !!document.querySelector('#kr-channel-root')?.shadowRoot.querySelector('.channel-expand')")
    script("const r=document.querySelector('#kr-channel-root').shadowRoot,b=r.querySelector('.channel-expand');if(b.getAttribute('aria-expanded')!=='true')b.click();return true")
    wait("return !!document.querySelector('#kr-channel-root')?.shadowRoot.querySelector('#kr-channel-library')")
    script("document.querySelector('#kr-channel-root').shadowRoot.querySelector('#kr-channel-library').shadowRoot.querySelector('[data-tab=about]').click();return true")
    links=wait("const r=document.querySelector('#kr-channel-root')?.shadowRoot,a=[...r.querySelectorAll('.profile-socials a[data-social-platform]')];return a.length>=3?a.map(n=>({platform:n.dataset.socialPlatform,href:n.href})):null")
    print(json.dumps({'links':links}),flush=True)
    failed=[]
    for provider in (['X'] if X_ONLY else [] if PHOTO_ONLY else ['Instagram','TikTok','Discord','YouTube']):
        selector=json.dumps('.profile-socials a[data-social-platform="'+provider+'"]')
        point=script("const a=document.querySelector('#kr-channel-root').shadowRoot.querySelector("+selector+");if(!a)throw Error('Missing social button');a.scrollIntoView({block:'center'});const r=a.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}")
        command('WebDriver:PerformActions',{'actions':[{'type':'pointer','id':'mouse','parameters':{'pointerType':'mouse'},'actions':[{'type':'pointerMove','duration':0,'origin':'viewport','x':int(point['x']),'y':int(point['y'])},{'type':'pause','duration':250}]}]})
        result=wait("const r=document.querySelector('#kr-social-preview')?.shadowRoot,c=r?.querySelector('.card');return c?.getAttribute('aria-busy')==='false'?{name:r.querySelector('.name').textContent,status:r.querySelector('.status').textContent,stats:r.querySelector('.stats').textContent,photos:r.querySelectorAll('img').length,posts:r.querySelectorAll('.gallery a').length,uploads:r.querySelector('.uploads-note').textContent,cover:r.querySelector('.cover').getBoundingClientRect().height}:null",timeout=25)
        print(json.dumps({'provider':provider,**result}),flush=True)
        if result['status']:
            failed.append(provider)
        if provider in ['Instagram','TikTok']:
            assert result['cover']<=42,'Profile without a banner has excess header spacing'
        shot=command('WebDriver:TakeScreenshot',{'full':False})
        if isinstance(shot,dict):
            shot=shot['value']
        (ROOT/'artifacts').mkdir(exist_ok=True)
        (ROOT/'artifacts'/('firefox-gewn-'+provider.lower()+'-hover.png')).write_bytes(base64.b64decode(shot))
        script("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return true")
    assert not failed,'Failed social profiles: '+', '.join(failed)
    if X_ONLY:
        print('PASS installed Firefox: real GEWN X profile hover with current public profile endpoint',flush=True)
        sys.exit(0)
    # Add a local test row to this isolated browser's chat DOM; never send a chat message.
    script("const list=document.querySelector('#chatroom-messages'),row=document.createElement('div');row.id='test-tiktok-photo';row.dataset.index='9000001';const a=document.createElement('a');a.href='https://www.tiktok.com/@grizzthe1rizz_009/photo/7701411034199805214';a.textContent=a.href;row.append(a);list.append(row);row.scrollIntoView({block:'center'});return true")
    try:
        metadata=wait("const row=document.querySelector('#test-tiktok-photo'),h=row?.querySelector('.kr-media-embed');h?.scrollIntoView({block:'center'});const r=h?.shadowRoot,c=r?.querySelector('.card');return c?.getAttribute('aria-busy')==='false'?{label:r.querySelector('.video-preview')?.getAttribute('aria-label'),text:c.textContent.slice(0,250)}:null")
    except AssertionError:
        print(json.dumps({'photoDiagnostic':script("const row=document.querySelector('#test-tiktok-photo'),h=row?.querySelector('.kr-media-embed');return {row:row?.outerHTML,card:h?.shadowRoot?.innerHTML,chat:!!document.querySelector('#chatroom-messages'),visible:document.visibilityState}")}),flush=True)
        raise
    print(json.dumps({'photoMetadata':metadata}),flush=True)
    assert metadata.get('label')=='View TikTok photos','Photo metadata did not load: '+str(metadata)
    script("document.querySelector('#test-tiktok-photo .kr-media-embed').shadowRoot.querySelector('[aria-label=\"View TikTok photos\"]').click();return true")
    player=wait("const f=document.querySelector('#test-tiktok-photo .kr-media-embed')?.shadowRoot.querySelector('iframe');return f?{src:f.src,title:f.title}:null")
    print(json.dumps({'photoPlayer':player}),flush=True)
    assert player['src'].startswith('https://www.tiktok.com/player/v1/7701411034199805214?'),'Incorrect public TikTok player'
    assert player['title']=='TikTok photo player'
    script("document.querySelector('#test-tiktok-photo').remove();return true")
    for channel in ([] if PHOTO_ONLY else ['shoovy','gewn','shoovy']):
        command('WebDriver:Navigate',{'url':'https://kick.com/'+channel})
        title=wait("const h=document.querySelector('#kr-channel-root'),r=h?.shadowRoot,t=r?.querySelector('.channel-title'),n=r?.querySelector('.channel-name');return h&&!h.hidden&&h.getBoundingClientRect().height>0&&t?.getBoundingClientRect().height>0&&n?.textContent?{name:n.textContent,title:t.textContent}:null")
        print(json.dumps({'stream':channel,**title}),flush=True)
    print('PASS installed Firefox: '+('real TikTok photo metadata and official player launch' if PHOTO_ONLY else 'GEWN social previews, compact profile headers, TikTok photo metadata/player launch, and repeated GEWN/Shoovy title loads'),flush=True)
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
