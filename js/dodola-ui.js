(function(){'use strict';
 // Shared customer-only shell, including pages without the legacy marketplace script.
 if(document.body.classList.contains('dodola')){
  const localeScript=document.createElement('script');localeScript.src='/js/dodola-i18n.js';document.head.append(localeScript);
  const paths=['M3 11 12 3l9 8v10h-6v-6H9v6H3z','M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z','M5 7h14l1 14H4L5 7z M8 7V5a4 4 0 0 1 8 0v2','M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M3 22v-2a9 9 0 0 1 18 0v2'];
  function ensureNav(){if(innerWidth>768||document.getElementById('mb-bottom-nav'))return;const nav=document.createElement('nav');nav.id='mb-bottom-nav';nav.setAttribute('aria-label','Asosiy navigatsiya');const page=location.pathname;nav.innerHTML=[['index.html','Bosh sahifa'],['shop.html','Katalog'],['shop-cart.html','Savat'],['account.html','Profil']].map(([href,label],i)=>{const active=page.endsWith(href)||(i===2&&/checkout|success/.test(page))||(i===3&&/profile-settings|favorites|payment|track-order|auth/.test(page));return '<a href="'+href+'" class="mb-nav-item'+(active?' mb-nav-item--active':'')+'"'+(active?' aria-current="page"':'')+'><span class="mb-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="'+paths[i]+'"/></svg></span><span class="mb-nav-label">'+label+'</span></a>';}).join('');document.body.append(nav);}
  ensureNav();addEventListener('resize',ensureNav);
 }
 function favoriteIds(){try{return JSON.parse(localStorage.getItem('dodola_favorites')||'[]').filter(x=>typeof x==='string');}catch{return [];}}
 function paintFavorites(){const ids=favoriteIds();document.querySelectorAll('[data-favorite]').forEach(b=>{const on=ids.includes(b.dataset.favorite);b.setAttribute('aria-pressed',String(on));b.textContent=on?'♥':'♡';});}
 paintFavorites();document.addEventListener('click',e=>{const b=e.target.closest('[data-favorite]');if(!b)return;e.preventDefault();const ids=favoriteIds(),id=b.dataset.favorite;localStorage.setItem('dodola_favorites',JSON.stringify(ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]));paintFavorites();document.dispatchEvent(new CustomEvent('dodola:favorites'));});
 if(location.pathname.endsWith('contact.html')){const section=document.createElement('section');section.id='returns';section.className='returns-help';section.innerHTML='<h2>Qaytarish bo‘yicha yordam</h2><p>Qaytarish uchun buyurtma raqamini ko‘rsatib, yordam xizmatiga murojaat qiling. So‘rovingiz alohida ko‘rib chiqiladi.</p><a class="d-secondary" href="tel:+998990020015">+998 99 002 00 15</a>';document.querySelector('.contact-page')?.append(section);if(location.hash==='#returns')requestAnimationFrame(()=>section.scrollIntoView());}
 new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&n.querySelector?.('[data-favorite]'))))paintFavorites();}).observe(document.body,{childList:true,subtree:true});
 const page=location.pathname.split('/').pop().replace('.html','')||'index';
 document.querySelectorAll('[data-nav-page]').forEach(a=>{if(a.dataset.navPage===page||(['payment','track-order'].includes(page)&&a.dataset.navPage==='account'))a.setAttribute('aria-current','page');});
 function badges(){let rows=[];try{rows=JSON.parse(localStorage.getItem('mujskoy_cart')||'[]');}catch{}const count=Array.isArray(rows)?rows.reduce((n,r)=>n+Math.max(0,Number(r.qty)||0),0):0;document.querySelectorAll('.dodola-header .js-cart-count').forEach(e=>e.textContent=count);}
 badges();addEventListener('storage',badges);document.addEventListener('mb:cart-updated',badges);
 let lastCount=0;try{lastCount=JSON.parse(localStorage.getItem('mujskoy_cart')||'[]').reduce((n,r)=>n+Number(r.qty||0),0);}catch{}
 let toastTimer;function notify(text){let el=document.getElementById('dodolaToast');if(!el){el=document.createElement('div');el.id='dodolaToast';el.className='d-toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2600);}
 document.addEventListener('mb:cart-updated',()=>{let count=0;try{count=JSON.parse(localStorage.getItem('mujskoy_cart')||'[]').reduce((n,r)=>n+Number(r.qty||0),0);}catch{}if(count>lastCount)notify('Mahsulot savatga qo‘shildi ✓');lastCount=count;});
 window.DodolaUI={notify};
 // Keyboard focus follows the existing catalog panels and returns to their opener.
 document.querySelectorAll('[role="dialog"]:not(dialog)').forEach(panel=>{
  let opened=false,opener=null;
  const isOpen=()=>[...panel.classList].some(name=>name==='open'||name==='is-open'||name.endsWith('--open'));
  const focusables=()=>[...panel.querySelectorAll('button,a[href],input,select,[tabindex="0"]')].filter(e=>!e.disabled&&e.checkVisibility({checkVisibilityCSS:true}));
  new MutationObserver(()=>{const next=isOpen();if(next===opened)return;opened=next;if(next){opener=document.activeElement;requestAnimationFrame(()=>focusables()[0]?.focus());}else if(opener?.isConnected)opener.focus();}).observe(panel,{attributes:true,attributeFilter:['class','style']});
  panel.addEventListener('keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();panel.querySelector('[aria-label="Yopish"]')?.click();}
   if(e.key==='Tab'){const items=focusables(),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
   if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role="option"]')){e.preventDefault();e.target.click();}
  });
 });
 // Keep unavailable catalog images legible without changing stored product paths.
 function fallback(img){if(img instanceof HTMLImageElement&&!img.dataset.dodolaFallback){img.dataset.dodolaFallback='true';img.src='/img/placeholders/dodola-product.svg';}}
 document.addEventListener('error',e=>fallback(e.target),true);
 document.querySelectorAll('img').forEach(img=>{if(img.complete&&!img.naturalWidth)fallback(img);});
 // Pair legacy form labels with their controls without changing submitted names.
 document.querySelectorAll('.auth-field').forEach((field,i)=>{const label=field.querySelector('label'),input=field.querySelector('input,select,textarea');if(label&&input&&!label.htmlFor){if(!input.id)input.id='dodola-field-'+i;label.htmlFor=input.id;}});
 document.querySelectorAll('form.auth-form').forEach(form=>form.addEventListener('submit',()=>{const button=form.querySelector('button[type=submit],button:not([type])');if(!button)return;button.disabled=true;button.setAttribute('aria-busy','true');const message=document.querySelector('#accountMessage,#authMessage');if(!message)return;const observer=new MutationObserver(()=>{button.disabled=false;button.removeAttribute('aria-busy');observer.disconnect();});observer.observe(message,{childList:true,subtree:true,characterData:true});}));
})();
