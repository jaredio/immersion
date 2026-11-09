import {readFile} from 'node:fs/promises';
export async function workspaceFixtures(){
const media=`data:audio/wav;base64,${(await readFile('tests/silence.wav')).toString('base64')}`;
const video=`<div id="injected-channel-player" style="position:relative;aspect-ratio:16/9"><video id="video-player" src="${media}" muted loop autoplay playsinline style="width:100%;height:100%"></video><div class="z-controls bottom-0" style="position:absolute;bottom:0;width:100%"><button aria-label="Quality" aria-haspopup="menu">Quality</button></div></div>`;
const frame=`<!doctype html><html><head><meta charset="utf-8"></head><body><nav>Native navigation</nav><main>${video}</main><aside id="channel-chatroom"><div id="chatroom-messages"></div></aside></body></html>`;
const fixture=`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#09090b;color:white;font:14px system-ui}main{margin:20px;width:calc(100% - 370px)}#channel-chatroom{position:fixed;right:0;top:0;width:320px;height:900px}#chatroom-messages{height:820px;overflow:auto}[data-index]{padding:4px}</style></head><body><main>${video}<div class="stream-info"><h1 data-testid="channel-username">native</h1><h2 data-testid="livestream-title">Benchmark stream</h2><a href="/category/music">Music</a></div></main><aside id="channel-chatroom"><header><h2>Chat</h2></header><div id="chatroom-messages"></div></aside></body></html>`;
return {frame,fixture};
}
