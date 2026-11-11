/* One channel card in single-stream and workspace views. Native actions stay owned by Kick. */
(() => {
  const paths={download:'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5',stream:'M3 5h18v14H3zM10 9l5 3-5 3z',recording:'M4 3h16v18H4zM4 8h16M4 16h16M9 3v18',person:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2',stats:'M3 11h4v10H3zM10 3h4v18h-4zM17 15h4v6h-4z',chevron:'m6 9 6 6 6-6',viewers:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',notifications:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',follow:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',gift:'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8C5 8 5 2 8 3c3 0 4 5 4 5s1-5 4-5c3-1 3 5-4 5',subscribe:'m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3z',share:'m14 3 7 7-7 7m7-7H9a6 6 0 0 0-6 6v5',report:'m12 3 10 18H2zm0 6v5m0 3v1',brokenHeart:'M12 3 9 8l5 4-4 4 2 5M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',verified:'M9.15 1.43c.48-.57 1.18-.57 1.64 0l1.26 1.58c.1.1.18.14.33.1q.97-.29 1.96-.54c.7-.18 1.27.23 1.3.95q.09 1 .11 2.03 0 .22.19.27l1.86.7c.74.27.97.91.54 1.58l-1.1 1.67c-.08.13-.08.2 0 .33l1.12 1.72c.4.6.18 1.26-.48 1.6q-.94.38-1.88.72c-.12.04-.2.1-.2.27l-.11 2.07c-.02.7-.6 1.11-1.28.93l-1.99-.54c-.14-.04-.2 0-.29.1l-1.28 1.6c-.46.57-1.14.57-1.62 0l-1.28-1.6q-.1-.17-.29-.1c-.64.18-1.28.33-1.92.54-.8.25-1.39-.35-1.39-1.02 0-.66-.08-1.3-.1-1.96q.02-.22-.19-.27l-1.94-.75a.98.98 0 0 1-.5-1.47q.55-.89 1.14-1.75c.08-.15.08-.23 0-.36L1.64 8.12c-.4-.6-.18-1.24.48-1.51l1.92-.75c.13-.06.19-.12.19-.27q.03-1.04.1-2.07c.04-.74.58-1.1 1.47-.89l1.74.48q.23.08.37-.12zm5.36 5a1.4 1.4 0 0 0-1.98.09l-4.17 4.54-1.3-1.3a1.4 1.4 0 0 0-2.09 1.88l.1.1L7.4 14.1a1.4 1.4 0 0 0 2.03-.05l5.16-5.62a1.4 1.4 0 0 0-.09-1.99'};
  const icon=kind=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[kind]||paths.share);svg.append(path);return svg;};
  const styles=`
    .channel-panel{min-width:0;border:1px solid #ffffff10;border-radius:14px;background:linear-gradient(125deg,#16161c,#101014);overflow:clip;color:#f2f2f7}
    .channel-panel .multi-channel-card{position:relative;display:flex;align-items:flex-start;gap:20px;width:100%;padding:14px 20px 28px!important;min-height:108px!important;border:0!important;border-radius:0!important;background:transparent!important;text-align:left;box-sizing:border-box}
    .channel-panel .channel-identity{display:flex;flex-direction:row;align-items:center;gap:18px;flex:1;min-width:0}
    .channel-panel .channel-avatar{position:relative;display:grid;place-items:center;width:64px;height:64px;flex:0 0 64px;border:0;padding:0;border-radius:50%;background:#24242b;color:#ddd;isolation:isolate}
    .channel-panel .channel-avatar img{position:absolute;inset:0;display:block;width:100%;height:100%;min-width:0;min-height:0;max-width:100%;max-height:100%;aspect-ratio:1;object-fit:cover;object-position:center;border-radius:50%}
    .channel-panel[data-live=live] .channel-avatar{box-shadow:0 0 0 3px #101014,0 0 0 5px var(--accent),0 0 19px color-mix(in srgb,var(--accent) 15%,transparent)}
    .channel-panel .channel-live{position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);padding:2px 6px;border:2px solid #121216;border-radius:5px;background:var(--accent);color:#10200e;font:750 9px/1.2 system-ui;letter-spacing:.04em}
    .channel-panel .channel-words{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1}
    .channel-panel .channel-name-line{display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0}
    .channel-panel .channel-name{font-size:15px;font-weight:650;letter-spacing:-.015em;white-space:normal;color:#f2f2f7}
    .channel-panel .channel-name-button{display:inline-flex;align-items:center;gap:7px;padding:0;border:0;background:transparent;color:inherit;min-width:0;text-align:left}
    .channel-panel .channel-name-button:hover{color:var(--accent)}
    .channel-panel .channel-name-options{display:flex;flex-wrap:wrap;align-items:center;gap:4px;min-width:0}
    .channel-panel .channel-name-options button{display:inline-flex;align-items:center;gap:5px;max-width:100%;min-width:0;padding:3px 8px;border:1px solid transparent;border-radius:7px;background:transparent;color:#a9a9b9;font:650 14px/1.35 Inter,system-ui,sans-serif;cursor:pointer}
    .channel-panel .channel-name-options button:hover{background:#ffffff0a;color:#eeeef5}
    .channel-panel .channel-name-options button[aria-pressed=true]{border-color:color-mix(in srgb,var(--accent) 24%,transparent);background:color-mix(in srgb,var(--accent) 8%,transparent);color:var(--accent)}
    .channel-panel .channel-name-options button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .channel-panel .channel-name-options svg{width:14px;height:14px;flex:none;color:var(--accent)}
    .channel-panel .channel-pool-avatar,.channel-panel .channel-pool-title{display:none}
    .channel-panel[data-channel-pool]>.channel-name-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:6px;padding:10px 12px 4px}
    .channel-panel[data-channel-pool]>.channel-name-options button{gap:9px;padding:7px 9px;text-align:left;background:#ffffff03}
    .channel-panel[data-channel-pool]>.channel-name-options button:hover{background:#ffffff08}
    .channel-panel[data-channel-pool]>.channel-name-options button[aria-pressed=true]{background:color-mix(in srgb,var(--accent) 8%,transparent)}
    .channel-panel[data-channel-pool] .channel-pool-avatar{position:relative;display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:50%;background:#26262f;color:#bcbccc;font-size:12px}
    .channel-panel[data-channel-pool] .channel-pool-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%}
    .channel-panel[data-channel-pool] .channel-pool-copy{display:flex;flex-direction:column;min-width:0;gap:2px}
    .channel-panel[data-channel-pool] .channel-pool-name{display:flex;align-items:center;gap:5px;color:#ececf4}
    .channel-panel[data-channel-pool] button[aria-pressed=true] .channel-pool-name{color:var(--accent)}
    .channel-panel[data-channel-pool] .channel-pool-title{display:block;color:#9e9eaf;font-size:11px;font-weight:500}
    .channel-panel[data-channel-pool]>.multi-channel-card{display:block;min-height:0!important;padding:0 14px 31px!important}
    .channel-panel[data-channel-pool]>.multi-channel-card>.channel-identity{display:none}
    .channel-panel[data-channel-pool]:not([data-channel-expanded]) :is(.channel-actions,.channel-goals){display:none}
    .channel-panel[data-channel-pool]>.multi-channel-card>.channel-actions{flex-direction:row;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;max-width:none;padding:10px 0 3px}
    .channel-panel[data-channel-pool] .channel-primary-actions{justify-content:flex-start}
    .channel-panel[data-channel-pool] .channel-expand{display:flex;align-items:center;justify-content:center;gap:4px;width:auto;padding:2px 8px;font:600 11px/1 Inter,system-ui,sans-serif}
    .channel-panel .channel-title{display:block;font-size:clamp(15px,1.1vw,17px);font-weight:500;line-height:1.45;letter-spacing:-.005em;white-space:normal;word-break:normal;overflow-wrap:break-word;hyphens:none;color:#e3e3ed}
    .channel-panel .channel-title a{color:inherit;text-decoration:none}.channel-panel .channel-title a:hover{color:var(--accent);text-decoration:underline}.channel-panel .channel-title a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px}
    .channel-panel .channel-tags{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:12px;color:#a1a1b0;line-height:1.5}
    .channel-panel .channel-category{color:#aaaabc;text-decoration:none;font:inherit;white-space:normal}
    .channel-panel .channel-tag{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border:1px solid #ffffff0b;border-radius:5px;background:#ffffff04;font-size:10px;color:#a6a6b4;white-space:normal}
    .channel-panel .channel-badge{display:inline-flex;align-items:center;gap:5px;max-width:min(230px,100%);height:24px;box-sizing:border-box;padding:3px 7px;border:1px solid color-mix(in srgb,var(--accent) 20%,transparent);border-radius:999px;background:color-mix(in srgb,var(--accent) 4%,transparent);font:500 10px/16px Inter,system-ui,sans-serif;color:var(--accent);min-width:0}
    .channel-panel .channel-badge>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.channel-panel .channel-badge>svg{width:14px!important;height:14px!important;max-width:14px;max-height:14px;flex:0 0 14px}.channel-panel .channel-name-button>svg{width:17px;height:17px;color:var(--accent)}
    .channel-panel .channel-actions{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:0 0 auto;max-width:52%;min-width:0;padding-top:2px}
    .channel-panel .channel-primary-actions,.channel-panel .channel-secondary-actions{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:7px;min-width:0}
    .channel-panel .channel-action,.channel-panel .kr-support-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:38px;min-height:38px;width:auto;margin:0;padding:0 12px;border:1px solid #ffffff12;border-radius:8px;background:#ffffff05;color:#e7e7ed;font:600 12px/18px Inter,system-ui,sans-serif;text-decoration:none;white-space:nowrap;cursor:pointer;box-sizing:border-box}
    .channel-panel .channel-action svg,.channel-panel .kr-support-button svg{width:16px;height:16px;flex:none}.channel-panel .channel-action:disabled{opacity:.4;cursor:default}
    .channel-panel .channel-action>span,.channel-panel .kr-support-button>span{font:inherit;color:inherit;white-space:nowrap}
    .channel-panel .channel-primary-actions .channel-action:not([data-icon-only]),.channel-panel .channel-primary-actions .kr-support-button{min-width:112px}.channel-panel .kr-support-button svg{color:var(--accent)}
    .channel-panel .channel-action .channel-unfollow-icon{display:none}.channel-panel .channel-action[data-kind=follow][aria-pressed=true]:is(:hover,:focus-visible)>svg:not(.channel-unfollow-icon){display:none}.channel-panel .channel-action[data-kind=follow][aria-pressed=true]:is(:hover,:focus-visible)>.channel-unfollow-icon{display:block}
    .channel-panel .channel-action:hover,.channel-panel .kr-support-button:hover{background:#ffffff0a;border-color:#ffffff26}
    .channel-panel .channel-action[aria-pressed=true]{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 30%,transparent);background:color-mix(in srgb,var(--accent) 7%,transparent)}
    .channel-panel .channel-action[data-kind=subscribe]{background:var(--accent);border-color:transparent;color:#14200e}.channel-panel .channel-action[data-kind=subscribe]:hover{filter:brightness(1.05)}
    .channel-panel .channel-action[data-icon-only]{width:38px;padding:0}.channel-panel .channel-secondary-actions .channel-action{height:28px;min-height:28px;width:28px;padding:5px;border-color:transparent;background:transparent;color:#9e9ead}
    .channel-panel .channel-viewers{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;color:var(--accent);font-size:12px;font-weight:600;margin-right:4px}.channel-panel .channel-viewers svg{width:15px;height:15px}
    .channel-panel .channel-expand{position:absolute;bottom:3px;left:50%;transform:translateX(-50%);display:grid;place-items:center;width:48px;height:21px;padding:2px 12px;border:0;border-radius:6px;background:transparent;color:#89899b;cursor:pointer}.channel-panel .channel-expand:hover{background:#ffffff07;color:var(--accent)}
    .channel-panel .channel-expand svg{width:17px;height:17px;transition:transform .15s}.channel-panel .channel-expand[aria-expanded=true] svg{transform:rotate(180deg);color:var(--accent)}
    .channel-panel :is(button,a):focus-visible{outline:2px solid var(--accent);outline-offset:3px}.channel-panel .multi-expanded-profile{padding:22px;border-top:1px solid #ffffff0b;min-width:0}
    .channel-panel .channel-profile-region{padding:16px clamp(12px,2vw,22px) 20px;border-top:1px solid #ffffff0b}
    .channel-panel .channel-profile-region>.multi-expanded-profile{padding:18px 0 0;border:0}
    .channel-panel .channel-profile-region [hidden]{display:none!important}
    .channel-panel .channel-goals{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:12px;padding:16px 20px;border-top:1px solid #ffffff0b}
    .channel-panel .channel-goal{min-width:0;display:flex;flex-direction:column;gap:10px;padding:13px 14px;border:1px solid #ffffff0b;border-radius:10px;background:#ffffff03}
    .channel-panel .channel-goal-heading,.channel-panel .channel-goal-footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.channel-panel .channel-goal-title{font:600 13px/1.4 Inter,system-ui,sans-serif;color:#e7e7ed}.channel-panel .channel-goal-time{font-size:11px;color:#9696a6}
    .channel-panel .channel-goal-action{display:grid;place-items:center;width:30px;height:30px;flex:none;padding:6px;border:1px solid #ffffff10;border-radius:7px;background:#ffffff05;color:var(--accent);cursor:pointer}.channel-panel .channel-goal-action:hover{background:#ffffff0d}.channel-panel .channel-goal-action svg{width:16px;height:16px}
    .channel-panel .channel-goal progress{appearance:none;width:100%;height:6px;border:0;border-radius:999px;overflow:hidden;background:#ffffff0b;color:var(--accent)}.channel-panel .channel-goal progress::-webkit-progress-bar{background:#ffffff0b}.channel-panel .channel-goal progress::-webkit-progress-value{background:var(--accent);border-radius:999px}.channel-panel .channel-goal progress::-moz-progress-bar{background:var(--accent);border-radius:999px}
    .channel-panel .channel-goal-count{font-size:11px;font-weight:600;color:var(--accent);margin-left:auto}.channel-panel .channel-goal-footer img{width:24px;height:24px;object-fit:cover;border-radius:50%}
    .channel-panel .profile-panels{grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))}
    @container channel-card (max-width:680px){.channel-panel .multi-channel-card{flex-wrap:wrap;gap:12px;padding:14px 16px 28px!important}.channel-panel .channel-identity{flex-basis:100%}.channel-panel .channel-actions{max-width:100%;flex-basis:100%;align-items:flex-start;padding:0}.channel-panel .channel-primary-actions,.channel-panel .channel-secondary-actions{justify-content:flex-start}.channel-panel .channel-avatar{width:52px;height:52px;flex-basis:52px}.channel-panel .channel-title{font-size:16px}.channel-panel .channel-identity{gap:15px}.channel-panel .multi-expanded-profile{padding:18px}}
    @media(prefers-reduced-motion:reduce){.channel-panel .channel-expand svg{transition:none}}
  `;
  const bounded=value=>typeof value==='string'?value.trim().slice(0,600):'';
  function cloneVisual(node){const clone=node.cloneNode(true),elements=[clone,...clone.querySelectorAll('*')],ids=new Map(),prefix=`channel-${crypto.randomUUID()}-`;for(const element of elements)if(element.id){ids.set(element.id,prefix+ids.size);element.id=ids.get(element.id);}for(const element of elements){element.removeAttribute('class');element.removeAttribute('style');for(const attr of [...element.attributes]){if(/^on/i.test(attr.name)||['aria-controls','aria-describedby'].includes(attr.name))element.removeAttribute(attr.name);else if(attr.name!=='id'){let value=attr.value;for(const [old,next]of ids){value=value.replaceAll(`url(#${old})`,`url(#${next})`);if(value===`#${old}`)value=`#${next}`;}if(value!==attr.value)element.setAttribute(attr.name,value);}}}for(const element of clone.querySelectorAll('script,style,iframe,object,embed,foreignObject'))element.remove();return clone;}
  function verificationBadge(source){const badge=source?cloneVisual(source):icon('verified');if(!source)badge.setAttribute('viewBox','0 0 20 20');badge.setAttribute('fill','currentColor');badge.setAttribute('stroke','none');badge.setAttribute('fill-rule','evenodd');for(const element of [badge,...badge.querySelectorAll('*')]){for(const attr of ['fill','stroke'])if(element.hasAttribute(attr)&&element.getAttribute(attr)!=='none')element.setAttribute(attr,'currentColor');if(element.tagName.toLowerCase()==='stop')element.setAttribute('stop-color','currentColor');}badge.setAttribute('aria-label','Verified channel');return badge;}
  function syncFollowing(button,node){if(button.dataset.kind!=='follow')return;const state=node.getAttribute('aria-pressed');const label=[node.getAttribute('aria-label'),node.title,node.textContent,node.querySelector('svg')?.getAttribute('data-ds-icon')].join(' ');button.setAttribute('aria-pressed',String(state!==null?state==='true':/unfollow|following|heartfilled|heartfull/i.test(label)));}
  function classify(node){const value=[node.dataset.testid,node.getAttribute('aria-label'),node.getAttribute('title'),node.textContent,node.querySelector('svg')?.getAttribute('data-ds-icon')].join(' ').toLowerCase();return /download/.test(value)?'download':/watch livestream/.test(value)?'stream':/watch full video/.test(value)?'recording':/gift/.test(value)?'gift':/subscr|sub-button/.test(value)?'subscribe':/notif|bell/.test(value)?'notifications':/follow|heart/.test(value)?'follow':/share/.test(value)?'share':/report/.test(value)?'report':'other';}
  function isAction(node){
    if(classify(node)==='other'||node.matches('[data-kr-support]')||node.closest('[role="dialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper]'))return false;
    if(node.matches('a')){try{if(new URL(node.href).origin!==location.origin)return false;}catch{return false;}}
    return true;
  }
  function bio(slug,meta,panels,{fullProfile=false}={}){
    const profile=document.createElement('section');profile.className='multi-expanded-profile';profile.id=`multi-profile-${slug}`;profile.setAttribute('role','region');profile.setAttribute('aria-label',`About ${meta.title||slug}`);
    const followerCount=String(meta.followers??'').replace(/\s+followers?\s*$/i,'').trim();
    if(followerCount){
      const followers=document.createElement('p');followers.className='profile-followers';
      const value=document.createElement('strong');value.textContent=followerCount;
      const label=document.createElement('span');label.textContent='Followers';
      followers.append(icon('person'),value,' ',label);profile.append(followers);
    }
    const text=document.createElement('div');text.className='profile-rich-text profile-bio';KickRefinedProfile.formatted(text,meta.bio||'No bio available.');profile.append(text);
    const socials=document.createElement('div');socials.className='profile-socials';for(const social of meta.socials||[]){const link=KickRefinedProfile.link(social.href);if(link){link.textContent=social.label;socials.append(link);}}
    const open=KickRefinedProfile.link(`${location.origin}/${slug}${fullProfile?'?tab=overview':''}`);open.textContent=fullProfile?'Open full profile ↗':'Open channel ↗';socials.append(open);profile.append(socials);
    const grid=document.createElement('div');grid.className='profile-panels';if(!panels){const message=document.createElement('p');message.className='profile-muted';message.textContent='Loading channel panels…';grid.append(message);}else for(const item of panels){if(!item.title&&!item.description&&!item.image)continue;const panel=document.createElement('article');panel.className='profile-panel';if(item.image){const image=KickRefinedProfile.image(item.image,item.title||'Channel panel');if(image){const link=KickRefinedProfile.link(item.href);if(link){link.append(image);panel.append(link);}else panel.append(image);}}if(item.title){const heading=document.createElement('h4');heading.textContent=item.title;panel.append(heading);}if(item.description){const description=document.createElement('div');description.className='profile-rich-text';KickRefinedProfile.formatted(description,item.description);panel.append(description);}grid.append(panel);}profile.append(grid);KickRefinedProfile.decorateSocials(profile);return profile;
  }
  function create({support,enabled=true,onChange,integratedProfile=false}={}){
    let source=null,host=null,shadow=null,signature='',version=0,slug='',expanded=false,details=null,nativeData=null,destroyed=false,pendingBio=0,activeAction=null,activePopover=null,verifiedVisual=null,profileHeaders=[],observedHeaders=[];
    const marked=new Set(),actionButtons=new Map();
    const sourceObserver=new MutationObserver(()=>onChange?.());
    const sourceStyle=document.createElement('style');sourceStyle.textContent='html[data-kr-enabled="true"] :is([data-kr-channel-source],[data-kr-channel-goal-source]){display:none!important}html[data-kr-enabled="true"]:has(main[data-kr-multi-active="true"]) #kr-channel-root:not([data-profile-open]){display:none!important}[data-kr-channel-popover]{position:fixed!important;transform:none!important;left:var(--kr-channel-popover-left)!important;top:var(--kr-channel-popover-top)!important;max-width:calc(100vw - 16px)!important}';document.head.append(sourceStyle);
    function clearPopover(){if(activePopover){activePopover.removeAttribute('data-kr-channel-popover');activePopover.style.removeProperty('--kr-channel-popover-left');activePopover.style.removeProperty('--kr-channel-popover-top');activePopover=null;}}
    function positionPopover(){if(!activeAction)return;const node=activeAction.node;if(!node.isConnected||node.getAttribute('aria-expanded')==='false'){clearPopover();activeAction=null;return;}const popup=document.getElementById(node.getAttribute('aria-controls'))?.closest('[data-radix-popper-content-wrapper]');if(!popup)return;if(popup!==activePopover){clearPopover();activePopover=popup;}const size=popup.getBoundingClientRect(),anchor=activeAction.rect;popup.setAttribute('data-kr-channel-popover','');popup.style.setProperty('--kr-channel-popover-left',`${Math.max(8,Math.min(anchor.right-size.width,innerWidth-size.width-8))}px`);popup.style.setProperty('--kr-channel-popover-top',`${Math.max(8,Math.min(anchor.bottom+8,innerHeight-size.height-8))}px`);}
    function invoke(node,button){clearPopover();activeAction=node.hasAttribute('aria-controls')?{node,rect:button.getBoundingClientRect()}:null;node.click();requestAnimationFrame(()=>{if(!destroyed){positionPopover();onChange?.();}});}
    function popup(channel){window.open(`https://kick.com/${channel}`,'_blank','popup,width=1000,height=820,noopener,noreferrer');}
    function syncActions(){for(const [node,buttons]of actionButtons){for(const button of buttons){if(!button.isConnected){buttons.delete(button);continue;}button.disabled=node.disabled||node.getAttribute('aria-disabled')==='true';for(const attr of ['aria-pressed','aria-expanded','aria-haspopup']){const value=node.getAttribute(attr);if(value===null)button.removeAttribute(attr);else if(button.getAttribute(attr)!==value)button.setAttribute(attr,value);}syncFollowing(button,node);const label=node.getAttribute('aria-label')||node.title;if(label){button.setAttribute('aria-label',label);button.title=label;}const visual=node.querySelector('svg'),key=visual?.outerHTML||'';if(button._nativeVisual!==key){const previous=button.querySelector('svg:not(.channel-unfollow-icon)');if(visual)previous?.replaceWith(cloneVisual(visual));button._nativeVisual=key;}const text=button.querySelector('span'),value=bounded(node.textContent);if(text&&value&&text.textContent!==value)text.textContent=value;}if(!buttons.size||!node.isConnected)actionButtons.delete(node);}}
    function syncLegacyPanels(){
      if(!source||!host?._panels?.length)return;
      const imageKey=value=>{try{let url=new URL(value,location.origin);for(let i=0;i<2&&url.searchParams.has('url');i++)url=new URL(url.searchParams.get('url'),location.origin);return url.protocol==='https:'?url.origin+url.pathname:'';}catch{return '';}};
      const keys=new Set(host._panels.map(panel=>imageKey(panel.image)).filter(Boolean));if(!keys.size)return;
      const matches=image=>keys.has(imageKey(image.currentSrc||image.src))||keys.has(imageKey(image.getAttribute('src')));
      const main=source.closest('main')||document.querySelector('main');if(!main)return;
      for(const image of main.querySelectorAll('img')){
        if(!matches(image))continue;let item=image.closest('a')||image;
        for(let depth=0;depth<5;depth++){
          const parent=item.parentElement;if(!parent||parent===main||parent.contains(source)||parent.contains(host)||parent.querySelector('video,#video-player,#channel-chatroom,nav,aside'))break;
          if([...parent.querySelectorAll('img')].some(node=>!matches(node)))break;item=parent;
        }
        if(item===image)item=image.parentElement;if(!item||item===main||item.contains(source)||item.contains(host))continue;
        if(!item.hasAttribute('data-kr-channel-source'))item.setAttribute('data-kr-channel-source','');marked.add(item);
      }
    }
    function readGoals(header){
      const scope=header.closest('main')||document.querySelector('main');if(!scope)return [];
      const goalTitle=/^[\d,.]+\s*(followers?|KICKs?|subscriptions?|subs?)\s+to go!?$/i;
      const candidates=[...scope.querySelectorAll('h2,h3,h4,p,span,div')].filter(node=>!node.closest('[data-kr-library-source],[data-kr-library-shell]')&&goalTitle.test(bounded(node.textContent))&&![...node.children].some(child=>goalTitle.test(bounded(child.textContent))));
      const goals=[],seen=new Set();
      const number=value=>{const match=value.replaceAll(',','').match(/^([\d.]+)\s*([kmb])?/i);return match?Number(match[1])*({k:1e3,m:1e6,b:1e9}[match[2]?.toLowerCase()]||1):0;};
      for(const heading of candidates){
        let node=heading;
        while(node&&node!==scope){
          const text=bounded(node.textContent);
          if(node.contains(header)||node.contains(host)||node.querySelector('video,#channel-chatroom')||candidates.some(other=>other!==heading&&node.contains(other)))break;
          const count=text.match(/([\d,.]+\s*[kmb]?)\s*\/\s*([\d,.]+\s*[kmb]?)/i),progress=node.querySelector('[role=progressbar],progress');
          if(count||progress){
            if(!seen.has(node)){
              seen.add(node);const title=bounded(heading.textContent).replace(/^([\d,.]+)\s*/,'$1 '),kind=/follow/i.test(title)?'follow':/kick/i.test(title)?'gift':'subscribe';
              const current=count?number(count[1]):Number(progress.getAttribute('aria-valuenow')||progress.value||0),target=count?number(count[2]):Number(progress.getAttribute('aria-valuemax')||progress.max||1);
              const button=node.querySelector('button,a'),image=node.querySelector('img');
              goals.push({node,title,kind,current,target,count:count?`${count[1].trim()} / ${count[2].trim()}`:`${current.toLocaleString()} / ${target.toLocaleString()}`,time:text.match(/in\s+\d+\s+(?:hours?|minutes?|days?)/i)?.[0]||'',button,image:image?.currentSrc||image?.src||'',imageAlt:image?.alt||''});
              if(!node.hasAttribute('data-kr-channel-goal-source'))node.setAttribute('data-kr-channel-goal-source','');marked.add(node);
            }
            break;
          }
          node=node.parentElement;
        }
      }
      for(const previous of marked)if(previous.hasAttribute('data-kr-channel-goal-source')&&!seen.has(previous)){previous.removeAttribute('data-kr-channel-goal-source');marked.delete(previous);}
      return goals;
    }
    function goalsRow(channel,goals){
      const row=document.createElement('section');row.className='channel-goals';row.setAttribute('aria-label','Channel goals');
      for(const goal of goals){
        const item=document.createElement('article');item.className='channel-goal';const heading=document.createElement('div');heading.className='channel-goal-heading';const words=document.createElement('div'),title=document.createElement('div');title.className='channel-goal-title';title.textContent=goal.title;words.append(title);if(goal.time){const time=document.createElement('div');time.className='channel-goal-time';time.textContent=goal.time;words.append(time);}heading.append(words);
        const button=document.createElement('button');button.type='button';button.className='channel-goal-action';button.setAttribute('aria-label',`${{follow:'Follow',gift:'Send KICKs',subscribe:'Subscribe'}[goal.kind]} ? ${goal.title}`);const visual=goal.button?.querySelector('svg');button.append(visual?cloneVisual(visual):icon(goal.kind));button.addEventListener('click',()=>goal.button?.isConnected?invoke(goal.button,button):popup(channel));heading.append(button);item.append(heading);
        if(goal.target>0){const progress=document.createElement('progress');progress.max=goal.target;progress.value=Math.max(0,Math.min(goal.current,goal.target));progress.setAttribute('aria-label',goal.title);item.append(progress);}
        const footer=document.createElement('div');footer.className='channel-goal-footer';if(goal.image){const image=KickRefinedProfile.image(goal.image,goal.imageAlt||'Latest contributor');if(image)footer.append(image);}const count=document.createElement('span');count.className='channel-goal-count';count.textContent=goal.count;footer.append(count);item.append(footer);row.append(item);
      }
      return row;
    }
    function read(header){
      const username=header.querySelector('#channel-username,[data-testid=channel-username]')||globalThis.KickRefinedChannelPage?.username(header),avatar=header.querySelector('#channel-avatar,[data-testid=channel-avatar]')||globalThis.KickRefinedChannelPage?.avatar(header),streamTitle=header.querySelector('[data-testid="livestream-title"]');
      const nameButton=username?.closest('button,a'),nameLine=nameButton?.parentElement;
      const actionRoot=streamTitle?header.lastElementChild:header;
      const actions=[...actionRoot.querySelectorAll('button,a')].filter(node=>isAction(node)&&node!==nameButton&&!node.contains(username)&&!node.contains(avatar)&&!node.matches('a[href*="/category/"]')&&node.getAttribute('aria-disabled')!=='true').filter((node,index,nodes)=>nodes.findIndex(other=>classify(other)===classify(node))===index);
      // Profile pages can expose Subscribe/Follow in a second native header.
      // Keep one themed identity and forward each missing action to its real owner.
      const kinds=new Set(actions.map(classify));
      for(const variant of profileHeaders)if(variant!==header)for(const node of variant.querySelectorAll('button,a')){
        const kind=classify(node);if(!isAction(node)||kinds.has(kind))continue;
        kinds.add(kind);actions.push(node);
      }
      const categoryRow=[...header.querySelectorAll('a[href*="/category/"]')][0]?.parentElement||streamTitle?.parentElement?.nextElementSibling;
      const categoryLink=categoryRow?.querySelector('a');
      const live=avatar?(avatar.closest('button')?.textContent?.includes('LIVE')?'live':'offline'):details?.live||'unknown';
      const viewers=header.querySelector('[data-testid="viewer-count"]')?.textContent?.match(/[\d][\d,.\s]*[kKmM]?/)?.[0]?.trim();
      const title=bounded(username?.textContent)||details?.title||slug;let followers=header.textContent.match(/\d[\d.,]*\s?[kKmM]?\s+followers/i)?.[0]||'';
      for(const heading of document.querySelectorAll('main section :is(h2,h3,div[class*="font-bold"])'))if(!heading.closest('[data-kr-library-source]')&&heading.textContent.trim()===`About ${title}`){const section=heading.closest('section');if(section&&!section.contains(header)){if(location.pathname.replace(/\/$/,'').endsWith('/about')){if(marked.has(section)){section.removeAttribute('data-kr-channel-source');marked.delete(section);}}else{if(!section.hasAttribute('data-kr-channel-source'))section.setAttribute('data-kr-channel-source','');marked.add(section);followers=section.textContent.match(/\d[\d.,]*\s?[kKmM]?\s+Followers/i)?.[0]||'';}}}
      const clip=!!globalThis.KickRefinedChannelPage?.clipSlug(),recorded=clip||!!globalThis.KickRefinedChannelPage?.watchSlug();const recordingMeta=recorded?[...header.querySelectorAll('span')].filter(node=>!node.children.length&&(/^[\d,.]+\s?[kmb]?$/i.test(node.textContent.trim())&&node.hasAttribute('title')||/\bago\b|yesterday|today/i.test(node.textContent))).map(node=>/^[\d,.]+\s?[kmb]?$/i.test(node.textContent.trim())?node.textContent.trim()+' views':node.textContent.trim()).filter((value,index,all)=>all.indexOf(value)===index).join(' \u00b7 '):'';
      return {recorded,recordingKind:clip?'Clip':'Recording',recordingMeta,title,followers:followers||details?.followers||'',goals:recorded?[]:readGoals(header),streamTitle:bounded(streamTitle?.getAttribute('title')||streamTitle?.textContent)||details?.streamTitle||'',image:avatar?.currentSrc||avatar?.src||details?.image||'',live:recorded?'recorded':live,viewers:recorded?'':viewers||details?.viewers||'',category:bounded(categoryLink?.textContent)||details?.category||'',categoryHref:categoryLink?.href||'',tags:categoryRow?[...categoryRow.querySelectorAll('button[aria-disabled="true"]')].map(node=>bounded(node.textContent)).filter(Boolean):[],badges:nameLine?[...nameLine.children].filter(node=>node!==nameButton&&!node.contains(streamTitle)&&!node.contains(categoryLink)&&!node.matches('[data-testid=livestream-title]')):[],verified:nameButton?.querySelector('[data-ds-icon="VerifiedBadge"]')||null,nameButton,avatarButton:avatar?.closest('button'),actions};
    }
    function identity(channel,meta={}){
      const native=channel===slug?nativeData:null;
      return {title:native?.title||meta.title||channel,image:native?.image||meta.image||'',streamTitle:native?.streamTitle||meta.streamTitle||'',verified:native?.verified||meta.verified};
    }
    function card(channel,meta,{expanded=false,onToggle,onOpenProfile,panels,fullProfile=false,showPool=false}={}){
      const native=channel===slug?nativeData:null,info={...meta,...native};for(const key of ['streamTitle','image','category','viewers','verified','followers'])if(!info[key])info[key]=meta[key];if(info.live==='unknown')info.live=meta.live;
      const entry=document.createElement('div');entry.className='multi-channel-entry channel-panel';entry.dataset.live=info.live||'unknown';entry.style.containerType='inline-size';entry.style.containerName='channel-card';
      const header=document.createElement('div');header.className='multi-channel-card';header.dataset.channel=channel;
      const identity=document.createElement('div');identity.className='channel-identity';const avatar=document.createElement(onOpenProfile||native?.avatarButton?'button':'div');avatar.className='channel-avatar';if(onOpenProfile||native?.avatarButton){avatar.type='button';avatar.setAttribute('aria-label',`${info.title||channel} profile`);avatar.addEventListener('click',()=>onOpenProfile?onOpenProfile():native.avatarButton.isConnected&&invoke(native.avatarButton,avatar));}if(info.image){const image=KickRefinedProfile.image(info.image,'');if(image)avatar.append(image);}else avatar.textContent=(info.title||channel).slice(0,1).toUpperCase();if(info.live==='live'){const live=document.createElement('span');live.className='channel-live';live.textContent='LIVE';avatar.append(live);}identity.append(avatar);
      const words=document.createElement('div');words.className='channel-words';const nameLine=document.createElement('div');nameLine.className='channel-name-line';
      const clickableName=onOpenProfile||native?.nameButton;
      const name=document.createElement(clickableName?'button':'span');name.className='channel-name-button';
      if(clickableName){name.type='button';name.addEventListener('click',()=>onOpenProfile?onOpenProfile():native.nameButton.isConnected&&invoke(native.nameButton,name));}
      const label=document.createElement('strong');label.className='channel-name';label.textContent=info.title||channel;name.append(label);
      if(info.verified)name.append(verificationBadge(info.verified instanceof Element?info.verified:verifiedVisual));
      nameLine.append(name);
      for(const badge of info.badges||[]){
        const target=badge.matches('button,a')?badge:badge.querySelector('button,a');let label=bounded((target||badge).textContent).replace(/\s+/g,' ');if(!label)continue;const ranking=/^#\d+/.test(label);if(ranking)label=label.replace(/^(#\d+)\s*/,'$1 ').replace(/([a-z])([A-Z])/g,'$1 $2');
        const wrapper=document.createElement(target?'button':'span');wrapper.className='channel-badge';wrapper.title=label;wrapper.setAttribute('aria-label',label);if(target){wrapper.type='button';wrapper.disabled=target.disabled||target.getAttribute('aria-disabled')==='true';wrapper.addEventListener('click',()=>target.isConnected&&invoke(target,wrapper));}
        const visual=badge.querySelector('svg');if(ranking){const glyph=icon('stats');glyph.setAttribute('fill','currentColor');glyph.setAttribute('stroke','none');wrapper.append(glyph);}else if(visual){const glyph=cloneVisual(visual);if(!glyph.hasAttribute('fill'))glyph.setAttribute('fill','currentColor');wrapper.append(glyph);}const text=document.createElement('span');text.textContent=label;wrapper.append(text);nameLine.append(wrapper);
      }words.append(nameLine);
      const title=document.createElement('span');title.className='channel-title';const titleText=(info.streamTitle||(info.live==='offline'?'Offline':'Stream title unavailable')).replace(/\s+/g,' ');let cursor=0;
      for(const match of titleText.matchAll(/(^|[^\p{L}\p{N}_@/])@([a-zA-Z0-9_]+(?:-[a-zA-Z0-9_]+)*)/gu)){
        const start=match.index+match[1].length;title.append(document.createTextNode(titleText.slice(cursor,start)));const link=document.createElement('a');link.href=`https://kick.com/${match[2].toLowerCase()}`;link.textContent=`@${match[2]}`;title.append(link);cursor=start+link.textContent.length;
      }
      title.append(document.createTextNode(titleText.slice(cursor)));title.title=titleText;words.append(title);
      const tags=document.createElement('div');tags.className='channel-tags';if(info.category){const category=document.createElement(info.categoryHref?'a':'span');category.className='channel-category';category.textContent=info.category;if(info.categoryHref)category.href=info.categoryHref;tags.append(category);}const tagValues=info.tags?.length?info.tags:[info.language,info.mature?'18+':''].filter(Boolean);for(const value of tagValues){const tag=document.createElement('span');tag.className='channel-tag';tag.textContent=value;tags.append(tag);}words.append(tags);identity.append(words);header.append(identity);
      const actions=document.createElement('div');actions.className='channel-actions';const primary=document.createElement('div');primary.className='channel-primary-actions';const secondary=document.createElement('div');secondary.className='channel-secondary-actions';
      const addAction=(kind,label,node)=>{const button=document.createElement('button');button.type='button';button.className='channel-action';button.dataset.kind=kind;button.title=node?node.getAttribute('aria-label')||node.title||label:`${label} for ${info.title||channel} — open channel controls`;button.setAttribute('aria-label',node?.getAttribute('aria-label')||label);const visual=node?.querySelector('svg');button.append(visual?cloneVisual(visual):icon(kind));if(kind==='follow'){const broken=icon('brokenHeart');broken.classList.add('channel-unfollow-icon');button.append(broken);}if(['notifications','follow','share','download','report'].includes(kind))button.dataset.iconOnly='';else{const text=document.createElement('span');text.textContent=bounded(node?.textContent)||label;button.append(text);}if(node){button.disabled=node.disabled||node.getAttribute('aria-disabled')==='true';for(const attr of ['aria-pressed','aria-expanded','aria-haspopup'])if(node.hasAttribute(attr))button.setAttribute(attr,node.getAttribute(attr));}if(node){syncFollowing(button,node);if(!actionButtons.has(node))actionButtons.set(node,new Set());for(const previous of actionButtons.get(node))if(!previous.isConnected)actionButtons.get(node).delete(previous);actionButtons.get(node).add(button);button._nativeVisual=node.querySelector('svg')?.outerHTML||'';}button.addEventListener('click',()=>{if(node?.isConnected)invoke(node,button);else popup(channel);});(['share','download','report'].includes(kind)?secondary:primary).append(button);};
      if(native){for(const node of native.actions){const kind=classify(node);addAction(kind,{notifications:'Notifications',follow:'Follow',gift:'Gift Subs',subscribe:'Subscribe',share:'Share',report:'Report',download:'Download clip',stream:'Watch livestream',recording:'Watch full video',other:bounded(node.textContent)||'Channel action'}[kind],node);}}
      else for(const [kind,label]of [['notifications','Notifications'],['follow','Follow'],['gift','Gift Subs'],['subscribe','Subscribe'],['share','Share'],['report','Report']])addAction(kind,label,null);
      if(support)primary.insertBefore(support.makeButton(channel),primary.querySelector('[data-kind=subscribe]'));if(info.viewers||info.recorded){const viewers=document.createElement('span');viewers.className='channel-viewers';viewers.append(icon('viewers'),document.createTextNode(info.recorded?`${info.recordingKind||'Recording'}${info.recordingMeta?' \u00b7 '+info.recordingMeta:''}`:`${info.viewers} watching`));secondary.prepend(viewers);}actions.append(primary,secondary);header.append(actions);
      const regionId=`${onOpenProfile?'channel':'multi'}-profile-${channel}`;
      if(onOpenProfile)for(const button of [avatar,name]){button.setAttribute('aria-expanded',String(expanded));button.setAttribute('aria-controls',regionId);}
      const toggle=document.createElement('button');toggle.type='button';toggle.className='channel-expand';toggle.dataset.channel=channel;toggle.setAttribute('aria-label',`Channel details for ${channel}`);toggle.title=expanded?'Collapse channel profile':'Expand channel profile';toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-controls',regionId);if(showPool)toggle.append(document.createTextNode(expanded?'Hide details':'Details'));toggle.append(icon('chevron'));toggle.addEventListener('click',onToggle);header.append(toggle);entry.append(header);if(info.goals?.length)entry.append(goalsRow(channel,info.goals));if(expanded&&!onOpenProfile)entry.append(bio(channel,info,panels,{fullProfile}));return entry;
    }
    let profileLocation='',profileView=null;
    function setExpanded(value){
      if(expanded===value)return;
      expanded=value;profileView=null;refresh();onChange?.();
      if(expanded)loadBio();
    }
    function renderNative(){
      if(!host||!source)return;
      const focused=shadow.activeElement,kind=focused?.dataset.kind;
      const focusedControl=['channel-expand','channel-name-button','channel-avatar'].find(name=>focused?.classList.contains(name));
      const managed=integratedProfile&&!!KickRefinedChannelPage.routeSlug();
      const toggleProfile=()=>setExpanded(!expanded);
      const next=card(slug,details||{},{expanded,onToggle:toggleProfile,onOpenProfile:managed?toggleProfile:null,panels:host._panels});
      let entry=shadow.querySelector('.channel-panel');
      host.style.containerType='inline-size';
      if(!managed||!entry){entry?.remove();entry=next;shadow.append(entry);}
      else {
        entry.dataset.live=next.dataset.live;
        entry.firstElementChild.replaceWith(next.firstElementChild);
        entry.querySelector(':scope > .channel-goals')?.remove();
        const goals=next.querySelector('.channel-goals');if(goals)entry.firstElementChild.after(goals);
      }
      host.toggleAttribute('data-profile-open',managed&&expanded);
      let region=entry.querySelector(':scope > .channel-profile-region');
      if(managed&&expanded){
        if(!region){
          region=document.createElement('section');region.className='channel-profile-region';region.id=`channel-profile-${slug}`;region.setAttribute('aria-label',`${nativeData?.title||slug} profile`);
          const slot=document.createElement('div');slot.className='channel-library-slot';region.append(slot);entry.append(region);
        }
        const profile=bio(slug,{...details,...nativeData},host._panels);
        profile.hidden=profileView!==null&&profileView!=='about';
        region.querySelector(':scope > .multi-expanded-profile')?.remove();region.append(profile);
      }else region?.remove();
      if(focusedControl)shadow.querySelector(`.${focusedControl}`)?.focus({preventScroll:true});else if(kind)shadow.querySelector(`.channel-action[data-kind="${kind}"]`)?.focus({preventScroll:true});
    }
    function getProfileMount(tab){
      const region=shadow?.querySelector('.channel-profile-region');
      if(!region)return null;
      profileView=tab;
      region.querySelector('.multi-expanded-profile').hidden=tab!=='about';
      return region.querySelector('.channel-library-slot');
    }
    async function loadBio(){const revision=++pendingBio,current=slug;try{const results=await Promise.allSettled([support.channel(current),support.panels(current)]);if(destroyed||!enabled||current!==slug||revision!==pendingBio)return;if(results[0].status==='fulfilled')details=results[0].value;if(results[1].status==='fulfilled')host._panels=results[1].value;else host._panels=[];nativeData=read(source);syncLegacyPanels();renderNative();}catch{}}
    function observeHeaders(headers){
      const next=[...new Set([source,...headers])].filter(Boolean);if(next.length===observedHeaders.length&&next.every((node,index)=>node===observedHeaders[index]))return;
      sourceObserver.disconnect();observedHeaders=next;
      for(const node of next)sourceObserver.observe(node,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-pressed','aria-label','title','aria-expanded','disabled','src','data-state']});
      const main=source?.closest('main');if(main)sourceObserver.observe(main,{subtree:true,attributes:true,attributeFilter:['src','srcset']});
    }
    function unmount(){pendingBio++;clearPopover();activeAction=null;sourceObserver.disconnect();observedHeaders=[];host?.remove();host=shadow=null;for(const node of marked){node.removeAttribute('data-kr-channel-source');node.removeAttribute('data-kr-channel-goal-source');}marked.clear();source=null;signature='';nativeData=null;actionButtons.clear();}
    function refresh(){
      if(destroyed)return false;positionPopover();const next=globalThis.KickRefinedChannelPage?.routeSlug()||globalThis.KickRefinedChannelPage?.watchSlug()||globalThis.KickRefinedChannelPage?.clipSlug()||KickRefined.channelSlug(location.pathname,location.origin)||'';if(!enabled||!next){unmount();profileLocation='';return false;}if(next!==slug){unmount();slug=next;details=null;expanded=false;profileLocation='';profileView=null;}
      const tab=integratedProfile&&KickRefinedChannelPage.routeSlug()?KickRefinedChannelPage.profileTab():null;
      const nextLocation=`${location.pathname}:${tab||''}`;
      if(profileLocation!==nextLocation){if(tab)expanded=true;else if(profileLocation&&location.pathname!==`/${slug}`)expanded=false;profileLocation=nextLocation;}
      for(const node of marked)if(!node.isConnected){node.removeAttribute('data-kr-channel-source');node.removeAttribute('data-kr-channel-goal-source');marked.delete(node);}
      // Kick renders mobile and desktop variants, using data-testid rather than IDs.
      const headers=[];
      for(const title of document.querySelectorAll('[data-testid=livestream-title]')){
        let identity=null;
        for(let candidate=title.parentElement;candidate&&candidate!==document.body;candidate=candidate.parentElement){
          if(candidate.matches('main,nav,aside')||candidate.querySelector('video,#video-player,#injected-channel-player,#channel-chatroom')||candidate.querySelectorAll('[data-testid=livestream-title]').length>1)break;
          if(!candidate.querySelector('#channel-username,[data-testid=channel-username]'))continue;
          if(candidate.querySelector('#channel-avatar,[data-testid=channel-avatar]')&&candidate.querySelector('a[href*="/category/"]'))identity=candidate;
          if(candidate.querySelector('[data-testid=sub-button],[data-testid=follow-button],[data-testid=viewer-count]')){headers.push(candidate);identity=null;break;}
        }
        if(identity)headers.push(identity);
      }
      profileHeaders=globalThis.KickRefinedChannelPage?.findHeaders()||[];for(const variant of profileHeaders)if(!headers.includes(variant))headers.push(variant);
      const visibleWrapper=node=>{for(let parent=node.parentElement;parent&&parent!==document.body;parent=parent.parentElement)if(parent.hidden||getComputedStyle(parent).display==='none')return false;return true;};
      const visible=headers.filter(visibleWrapper),pool=visible.length?visible:headers;
      const header=pool.find(node=>node.querySelector('[data-testid=livestream-title]')&&node.querySelector('[data-testid=sub-button],[data-testid=follow-button]'))||pool.find(node=>node.querySelector('[data-testid=sub-button],[data-testid=follow-button]'))||pool[0]||document.querySelector('.stream-info');if(!header||globalThis.KickRefinedDOM?.isReady&&!KickRefinedDOM.isReady(header))return false;
      if(source!==header||!host?.isConnected){unmount();source=header;host=document.createElement('div');host.id='kr-channel-root';shadow=host.attachShadow({mode:'open'});const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=KickRefined.api.runtime.getURL('ui.css');const style=document.createElement('style');style.textContent=styles;shadow.append(sheet,style);const container=header.closest('#channel-content');if(container&&container!==header)container.prepend(host);else{let anchor=header;while(anchor.parentElement?.matches('[class~=contents]'))anchor=anchor.parentElement;anchor.before(host);}header.setAttribute('data-kr-channel-source','');marked.add(header);signature='';const current=slug;support.channel(current).then(meta=>{if(!destroyed&&enabled&&current===slug&&host){details=meta;signature='';onChange?.();}}).catch(()=>{});support.panels(current).then(panels=>{if(!destroyed&&enabled&&current===slug&&host){host._panels=panels;syncLegacyPanels();onChange?.();}}).catch(()=>{});}
      for(const variant of headers)if(variant!==header){if(!variant.hasAttribute('data-kr-channel-source'))variant.setAttribute('data-kr-channel-source','');marked.add(variant);}
      observeHeaders(headers);syncLegacyPanels();syncActions();const data=read(header),nextSignature=JSON.stringify([expanded,data.title,data.streamTitle,data.image,data.live,data.viewers,data.recorded,data.recordingKind,data.recordingMeta,data.followers,data.category,data.tags,data.badges.map(n=>n.outerHTML),data.verified?.outerHTML,data.goals.map(({title,current,target,time,count,image})=>[title,current,target,time,count,image]),data.actions.map(n=>classify(n))]);
      if(signature===nextSignature&&nativeData?.actions.every((node,index)=>node===data.actions[index])&&nativeData?.goals.every((goal,index)=>goal.node===data.goals[index]?.node&&goal.button===data.goals[index]?.button))return false;signature=nextSignature;nativeData=data;if(data.verified)verifiedVisual=cloneVisual(data.verified);version++;renderNative();return true;
    }
    return {card,identity,refresh,getProfileMount,get clipSource(){return nativeData?{slug,title:nativeData.title,streamTitle:nativeData.streamTitle,image:nativeData.image}:null;},get version(){return version;},setEnabled(value){enabled=value;if(!enabled){unmount();expanded=false;profileLocation='';profileView=null;}else refresh();},destroy(){destroyed=true;unmount();sourceStyle.remove();}};
  }
  globalThis.KickRefinedChannelPanel=Object.freeze({create,bio,styles,verificationBadge});
})();
