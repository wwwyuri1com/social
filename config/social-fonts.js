/* WWW Reader font controls, adapted to Social. Catalogue comes only from built CSS. */
(() => {
 'use strict';
 const $ = selector => document.querySelector(selector);
 const $$ = selector => [...document.querySelectorAll(selector)];
 const modal = $('#social-font-modal');
 const toggle = $('#social-font-toggle');
 // The backend writes the chosen default into built social.css at build time.
 // Browser overrides remain personal; Default returns to that CSS value.
 const cssAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
 const DEFAULT_THEME = /^#[0-9a-fA-F]{6}$/.test(cssAccent) ? cssAccent.toUpperCase() : '#F5005F';
 const themeKey = 'y1-social-v1-theme-color';
 const themePicker = $('#social-theme-picker');
 const themeHex = $('#social-theme-hex');
 let themeColor = DEFAULT_THEME;
 function setTheme(value, persist = false) {
   if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
     themeHex.value = themeColor;
     return;
   }
   themeColor = value.toUpperCase();
   document.documentElement.style.setProperty('--accent', themeColor);
   themePicker.value = themeColor;
   themeHex.value = themeColor;
   if (persist) {
     try {localStorage.setItem(themeKey, themeColor);} catch { /* private browsing */ }
   }
 }
 try {setTheme(localStorage.getItem(themeKey) || DEFAULT_THEME);} catch {setTheme(DEFAULT_THEME);}
 themePicker.addEventListener('input', () => setTheme(themePicker.value, true));
 themeHex.addEventListener('change', () => setTheme(themeHex.value.trim(), true));
 $('#social-theme-default').addEventListener('click', () => {
   setTheme(DEFAULT_THEME);
   try {localStorage.removeItem(themeKey);} catch { /* private browsing */ }
 });

 const fields = {
   en: ['social-font-en', 'english', 'system'],
   enSize: ['social-font-size-en', 'size', 'm'],
   enLine: ['social-font-line-en', 'lineHeight', 'system'],
   zh: ['social-font-zh', 'chinese', 'system'],
   zhSize: ['social-font-size-zh', 'size', 'm'],
   zhLine: ['social-font-line-zh', 'lineHeight', 'system']
 };
 const prefix = 'y1-social-v1-font-';
 const get = key => {try {return localStorage.getItem(prefix + key);} catch {return null;}};
 const put = (key, value) => {try {localStorage.setItem(prefix + key, value);} catch { /* private browser */ }};

 function catalogueFromCSS() {
   const source = getComputedStyle(document.documentElement)
     .getPropertyValue('--social-font-catalog').trim().replace(/^['"]|['"]$/g, '');
   if (!source || !/^[\w+/=]+$/.test(source)) throw Error('WWW font catalogue missing from Social CSS');
   const bytes = Uint8Array.from(atob(source), char => char.charCodeAt(0));
   const data = JSON.parse(new TextDecoder().decode(bytes));
   if (!['english', 'chinese', 'size', 'lineHeight'].every(key => Array.isArray(data[key]) && data[key].length))
     throw Error('WWW font catalogue invalid');
   return data;
 }

 let catalogue;
 try {catalogue = catalogueFromCSS();}
 catch (error) {console.warn('Social reading fonts:', error); toggle.disabled = true; return;}

 const option = (list, value) => catalogue[list].find(item => item.value === value);
 const selected = Object.fromEntries(Object.entries(fields).map(([key, [, list, fallback]]) =>
   [key, option(list, get(key)) ? get(key) : fallback]));

 function familyOf(item) {
   const name = String(item?.googleFamily || '');
   if (!name || !/^[\w\d -]+$/.test(name)) return '';
   const fallback = /^(sans-serif|serif|monospace|cursive|system-ui)$/.test(item.fallback)
     ? item.fallback : 'sans-serif';
   return `"${name}", ${fallback}`;
 }

 function loadFont(item) {
   const name = String(item?.googleFamily || '');
   if (!/^[\w\d -]+$/.test(name) || !name || document.querySelector(`link[data-social-google-font="${name}"]`)) return;
   const link = document.createElement('link');
   link.rel = 'stylesheet';
   link.dataset.socialGoogleFont = name;
   link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}&display=swap`;
   document.head.append(link);
 }

 function apply() {
   const style = document.documentElement.style;
   for (const language of ['en', 'zh']) {
     const list = language === 'en' ? 'english' : 'chinese';
     const font = option(list, selected[language]);
     const fontFamily = familyOf(font);
     const size = option('size', selected[language + 'Size']);
     const line = option('lineHeight', selected[language + 'Line']);
     const name = '--social-font-family-' + language;
     if (fontFamily) {style.setProperty(name, fontFamily); loadFont(font);}
     else style.removeProperty(name);
     style.setProperty('--social-font-size-' + language, (Number(size?.scale) || 1.1) + 'rem');
     style.setProperty('--social-font-line-' + language, line?.css || '1.75');
   }

   // WWW Reader's majority-CJK classification for an entire text block.
   $$('.social-content').forEach(block => {
     const value = block.textContent || '';
     const cjk = (value.match(/[\u2e80-\u2fff\u3000-\u303f\u3040-\u30ff\u3100-\u312f\u3130-\u318f\u31a0-\u31bf\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
     const latin = (value.match(/[A-Za-z]/g) || []).length;
     block.dataset.socialFontLang = cjk > latin ? 'zh' : 'en';
   });
 }

 window.Y1SocialFonts = {apply};

 function fillOptions() {
   Object.entries(fields).forEach(([, [id, list]]) => {
     const select = $('#' + id);
     catalogue[list].forEach(item => {
       const element = document.createElement('option');
       element.value = item.value;
       element.textContent = item.name;
       const font = familyOf(item);
       if (font) element.style.fontFamily = font;
       select.append(element);
     });
   });
 }

 function currentValues() {
   return Object.fromEntries(Object.entries(fields).map(([key, [id]]) => [key, $('#' + id).value]));
 }

 function updatePreview() {
   const values = currentValues();
   for (const language of ['en', 'zh']) {
     const list = language === 'en' ? 'english' : 'chinese';
     const item = option(list, values[language]);
     const family = familyOf(item);
     const size = Number(option('size', values[language + 'Size'])?.scale) || 1.1;
     const line = option('lineHeight', values[language + 'Line'])?.css || '1.75';
     const preview = $('#social-font-preview-' + language);
     const parts = language === 'en' ? [preview, $('#social-font-preview-note')] : [preview];
     parts.forEach(part => {
       part.style.fontFamily = family || '';
       part.style.fontSize = (16 * size) + 'px';
       part.style.lineHeight = line;
     });
     const select = $('#' + fields[language][0]);
     select.style.fontFamily = family || '';
     loadFont(item);
   }
 }

 fillOptions();
 Object.values(fields).forEach(([id]) => $('#' + id).addEventListener('change', updatePreview));
 toggle.addEventListener('click', () => {
   Object.entries(fields).forEach(([key, [id]]) => {$('#' + id).value = selected[key];});
   updatePreview();
   modal.showModal();
   toggle.setAttribute('aria-expanded', 'true');
 });
 $('#social-font-ok').addEventListener('click', () => {
   const values = currentValues();
   Object.entries(fields).forEach(([key, [, list, fallback]]) => {
     selected[key] = option(list, values[key]) ? values[key] : fallback;
     put(key, selected[key]);
   });
   apply();
   modal.close();
 });
 modal.addEventListener('close', () => {toggle.setAttribute('aria-expanded', 'false');toggle.focus();});
 modal.addEventListener('click', event => {if (event.target === modal) modal.close();});
 apply();
})();
