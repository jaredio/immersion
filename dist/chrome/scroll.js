/* MAIN world: isolate Refined keyboard input and disable animated native chat scroll.
 * No access to extension APIs, player internals, messages, fetch, or sockets.
 * Reading the DOM flag makes the patch immediately reversible from settings.
 */
(() => {
  // A page-global shortcut listener sees shadow inputs as DIV hosts. Catch
  // Refined keystrokes before Kick installs its listeners, and relay them only
  // inside their shadow root. Trusted browser text editing still happens once;
  // a canceled local shortcut also cancels the original default action.
  if (typeof window !== 'undefined') {
    const owners = new Set(['kr-root', 'kr-multi-root', 'kr-sidebar-filter']);
    for (const type of ['keydown','keypress','keyup']) window.addEventListener(type, event => {
      const path = event.composedPath(), target = path[0];
      const root = target?.getRootNode?.();
      if (!(root instanceof ShadowRoot) || !owners.has(root.host.id)) return;
      event.stopImmediatePropagation();
      if (type !== 'keydown') return;
      // A distinct event type also avoids Firefox re-composing synthetic native
      // keyboard events across the shadow boundary and recursively intercepting.
      const local = new KeyboardEvent('kick-refined-keydown', {
        key:event.key, code:event.code, location:event.location, repeat:event.repeat,
        ctrlKey:event.ctrlKey, altKey:event.altKey, shiftKey:event.shiftKey, metaKey:event.metaKey,
        keyCode:event.keyCode, charCode:event.charCode, bubbles:true, cancelable:true, composed:false
      });
      if (!target.dispatchEvent(local)) event.preventDefault();
    }, { capture:true });
  }
  for (const name of ['scrollTo', 'scroll']) {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, name);
    if (!descriptor || typeof descriptor.value !== 'function' || !descriptor.configurable) continue;
    const original = descriptor.value;
    Object.defineProperty(Element.prototype, name, {
      ...descriptor,
      value: function (...args) {
        const root = document.documentElement;
        if (this.id === 'chatroom-messages' && root?.dataset.krEnabled === 'true' && root.dataset.krPerformance === 'true'
          && args[0] && typeof args[0] === 'object' && args[0].behavior === 'smooth') {
          args[0] = { ...args[0], behavior: 'instant' };
        }
        return Reflect.apply(original, this, args);
      }
    });
  }
})();
