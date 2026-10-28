/* Dedicated, read-only Social feed. Never shares the WWW Post reader state. */
(() => {
 'use strict';
 const $ = selector => document.querySelector(selector);
 const $$ = selector => [...document.querySelectorAll(selector)];
 const PREFIX = 'y1-social-v1-';
 const get = (key, fallback) => {try {return localStorage.getItem(PREFIX + key) ?? fallback;} catch {return fallback;}};
 const put = (key, value) => {try {localStorage.setItem(PREFIX + key, value);} catch { /* private browsing */ }};
 let index = null, tab = 'timeline', type = 'all', selected = new Set(),
     language = get('language', 'a') === 'h' ? 'h' : 'a',
     favorites = new Set(), limit = 20, serial = 0;
 const cache = new Map();
 try {favorites = new Set(JSON.parse(get('liked', '[]')).filter(x => /^\d{6,}$/.test(x)));} catch {favorites = new Set();}

 function textFor(entry) {
   const parts = entry.content.replace(/\r\n|\r/g, '\n').split(/^(?:user|ChatGPT)[ \t]*$/gim);
   const human = (parts[1] || '').replace(/^\n|\n$/g, '');
   const ai = (parts[2] || '').replace(/^\n|\n$/g, '');
   if (language === 'a') return ai;
   // The established WWW Human view hides prompt instructions until a separator.
   const output = []; let hidden = false;
   human.split('\n').forEach(line => {
     const t = line.trim();
     if (/^[!！]end$/i.test(t)) {output.push('（完結）'); hidden = false; return;}
     if (t.startsWith('!') || t.startsWith('！')) {hidden = true; return;}
     if (['/', '\\', '／', '＼'].includes(t)) {hidden = false; return;}
     if (!hidden) output.push(line);
   });
   return output.join('\n');
 }

 function relative(iso) {
   const delta = Date.parse(iso) - Date.now();
   const hours = Math.floor(Math.abs(delta) / 3600000);
   const quantity = hours < 24 ? hours + 'h' : Math.floor(hours / 24) + 'd';
   return quantity + (delta > 0 ? ' later' : ' ago');
 }

 function visible() {
   return (index?.entries || []).filter(x => {
     if (tab === 'liked') return favorites.has(x.murmur_id);
     if (tab !== 'filter') return true; // Timeline never inherits Filter conditions.
     return (type === 'all' || x.category === type)
       && (!selected.size || [...selected].some(name => x.characters.includes(name)));
   });
 }

 async function page(number) {
   if (!cache.has(number)) {
     const url = 'data/pages/' + String(number).padStart(5, '0') + '.json?v=' + encodeURIComponent(index.version);
     cache.set(number, fetch(url).then(response => {if (!response.ok) throw Error('Cannot load murmurs'); return response.json();})
       .catch(err => {cache.delete(number); throw err;}));
   }
   return cache.get(number);
 }

 function icons() {try {window.lucide?.createIcons?.();} catch { /* fallback remains visible */ }}

 async function draw() {
   const nonce = ++serial;
   const root = $('#social-main'); const items = visible(); const showing = items.slice(0, limit);
   const resultCount = $('#social-filter-results');
   if (resultCount) resultCount.textContent = !items.length ? 'No matches' :
     items.length === 1 ? '1 result' : items.length + ' results';
   $('#load-more').hidden = showing.length >= items.length;
   root.setAttribute('aria-busy', 'true');
   if (!showing.length) {root.innerHTML = '<p class="social-message">No murmurs found.</p>'; root.setAttribute('aria-busy', 'false'); return;}
   try {
     const loaded = await Promise.all([...new Set(showing.map(item => item.page))].map(page));
     if (nonce !== serial) return;
     const byId = new Map(loaded.flatMap(p => p.entries).map(entry => [entry.murmur_id, entry]));
     const fragment = document.createDocumentFragment();
     showing.forEach(meta => {
       const item = byId.get(meta.murmur_id); if (!item) return;
       const article = document.createElement('article'); article.className = 'social-card'; article.dataset.murmurId = item.murmur_id;
       const deco = document.createElement('div'); deco.className = 'social-decoration';
       const color = /^#[0-9a-fA-F]{8}$/.test(item.color) ? item.color : '#5E5E5E70';
       // Old default pink follows the site's new peach identity visually.
       deco.style.color = /^#FA6699/i.test(color) ? '#FA6969' + color.slice(7) : color;
       const icon = document.createElement('i'); icon.dataset.lucide = /^[a-z][a-z0-9-]*$/.test(item.icon) ? item.icon : 'audio-lines';
       icon.textContent = '✦'; deco.append(icon); article.append(deco);
       const content = document.createElement('div'); content.className = 'social-content';
       content.textContent = textFor(item); article.append(content);
       const toolbar = document.createElement('div'); toolbar.className = 'social-tools';
       const time = document.createElement('time'); time.className = 'social-time';
       time.dateTime = item.post_at; time.textContent = relative(item.post_at); toolbar.append(time);
       const heart = document.createElement('button'); heart.className = 'social-heart'; heart.type = 'button';
       heart.dataset.like = item.murmur_id; heart.setAttribute('aria-pressed', String(favorites.has(item.murmur_id)));
       heart.setAttribute('aria-label', favorites.has(item.murmur_id) ? 'Remove from Liked' : 'Add to Liked');
       const heartIcon = document.createElement('i'); heartIcon.dataset.lucide = 'heart'; heartIcon.textContent = '♥';
       heart.append(heartIcon); toolbar.append(heart); article.append(toolbar);
       const rule = document.createElement('div'); rule.className = 'social-hr'; rule.setAttribute('aria-hidden', 'true'); article.append(rule);
       fragment.append(article);
     });
     root.replaceChildren(fragment); icons(); window.Y1SocialFonts?.apply?.();
   } catch (error) {
     if (nonce === serial) {root.innerHTML = '<p class="social-message">Murmurs could not be loaded. Please refresh.</p>'; console.error(error);}
   } finally {if (nonce === serial) root.setAttribute('aria-busy', 'false');}
 }

 function updateLanguage() {
   $$('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
   put('language', language); draw();
 }

 function renderCharacters() {
   const area = $('#social-characters'); area.replaceChildren();
   (index.characters || []).forEach(name => {
     const label = document.createElement('label'); const checkbox = document.createElement('input');
     checkbox.type = 'checkbox'; checkbox.value = name; checkbox.checked = selected.has(name);
     checkbox.addEventListener('change', () => {if (checkbox.checked) selected.add(name); else selected.delete(name); limit = 20; draw();});
     label.append(checkbox, document.createTextNode(name)); area.append(label);
   });
   if (!area.children.length) area.textContent = 'No public character keywords configured.';
 }

 $$('[data-language]').forEach(button => button.addEventListener('click', () => {language = button.dataset.language; updateLanguage();}));
 $$('[data-tab]').forEach(button => button.addEventListener('click', () => {
   if (tab === 'filter' && button.dataset.tab !== 'filter') {
     type = 'all';
     selected.clear();
     $$('[data-type]').forEach(x => x.classList.toggle('selected', x.dataset.type === 'all'));
     if (index) renderCharacters();
   }
   tab = button.dataset.tab; limit = 20;
   $$('[data-tab]').forEach(x => {
     x.classList.toggle('selected', x === button);
     x.setAttribute('aria-current', x === button ? 'page' : 'false');
   });
   $('#social-filters').hidden = tab !== 'filter';
   $('#filter-toggle').setAttribute('aria-expanded', String(tab === 'filter'));
   draw();
 }));
 $$('[data-type]').forEach(button => button.addEventListener('click', () => {
   type = button.dataset.type; limit = 20; $$('[data-type]').forEach(x => x.classList.toggle('selected', x === button)); draw();
 }));
 $('#clear-characters').addEventListener('click', () => {selected.clear(); renderCharacters(); limit = 20; draw();});
 $('#social-main').addEventListener('click', event => {
   const heart = event.target.closest('[data-like]'); if (!heart) return;
   const id = heart.dataset.like;
   if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
   put('liked', JSON.stringify([...favorites]));
   if (tab === 'liked') draw();
   else {heart.setAttribute('aria-pressed', String(favorites.has(id)));
         heart.setAttribute('aria-label', favorites.has(id) ? 'Remove from Liked' : 'Add to Liked');}
 });
 $('#load-more').addEventListener('click', () => {limit += 20; draw();});
 async function init() {
   updateLanguage();
   try {
     const response = await fetch('data/index.json', {cache: 'no-store'});
     if (!response.ok) throw Error('Cannot load Social index');
     index = await response.json(); renderCharacters(); draw();
   } catch (error) {$('#social-main').innerHTML = '<p class="social-message">Social is temporarily unavailable.</p>'; console.error(error);}
 }
 init();
 setInterval(() => $$('article[data-murmur-id]').forEach(card => {
   const time = card.querySelector('time'); if (time) time.textContent = relative(time.dateTime);
 }), 5 * 60 * 1000);
})();
