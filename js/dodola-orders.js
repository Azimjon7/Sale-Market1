(function(){'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>Number(n||0).toLocaleString('uz-UZ')+' so‘m';
 const date=v=>{const d=new Date(v);return v&&!Number.isNaN(d.valueOf())?d.toLocaleDateString('uz-UZ',{day:'numeric',month:'long',year:'numeric'}):'Sana ko‘rsatilmagan';};
 const image=i=>{const src=String(i.image||'');const safe=/^(https:\/\/|\/?(?:img|uploads)\/)/.test(src)?src:'/img/placeholders/dodola-product.svg';return `<img src="${esc(safe)}" alt="${esc(i.name||'Mahsulot')}" loading="lazy">`;};
 const badge=(label,state)=>`<span class="d-badge" data-state="${esc(state)}">${esc(label)}</span>`;
 function timeline(o){const states=['pending_confirmation','confirmed','paid','production','shipped','delivered'];const titles=['Buyurtma yuborish','Mavjudlik tasdig‘i','To‘lov tasdig‘i','Tayyorlash','Yetkazish','Qabul qilish'];
  if(['cancelled','rejected'].includes(o.status)||['refunded','partially_refunded'].includes(o.paymentStatus))return `<p class="d-note">${esc(DodolaOrderLabels.status(o.status))} · ${esc(DodolaOrderLabels.payment(o.paymentStatus))}</p>`;
  const done=i=>i===0||i===1&&!!o.confirmedAt||i===2&&o.paymentStatus==='collected'||i>2&&states.indexOf(o.status)>=i;
  return '<ol class="d-order-timeline" aria-label="Buyurtma bosqichlari">'+states.map((s,i)=>`<li class="${done(i)?'is-done':''}"><span>${done(i)?'✓':String(i+1).padStart(2,'0')}</span>${titles[i]}<small>${done(i)?' · tasdiqlangan':' · kutilmoqda'}</small></li>`).join('')+'</ol>';
 }
 const items=rows=>'<div class="d-order-items">'+(rows||[]).map(i=>`<article class="d-order-item">${image(i)}<div><strong>${esc(i.name||'Mahsulot')}</strong><small>${esc([i.color,i.size].filter(Boolean).join(' · '))}</small><small>${Number(i.qty||0)} ta × ${money(i.price)}</small></div><b>${money(Number(i.qty)*Number(i.price))}</b></article>`).join('')+'</div>';
 window.DodolaOrders={esc,money,date,image,badge,timeline,items};
})();
