(async()=>{'use strict';
 const el=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 try {const d=await(await fetch('/api/checkout/delivery')).json();el('addressDistrict').insertAdjacentHTML('beforeend',d.districts.map(x=>`<option>${esc(x)}</option>`).join(''));}catch{el('accountMessage').textContent='Tumanlar ro‘yxatini yuklab bo‘lmadi.';}
 const preference=el('paymentPreference');preference.value=localStorage.getItem('dodola_payment_preference')||'click';preference.onchange=()=>localStorage.setItem('dodola_payment_preference',preference.value);
 try{const r=await fetch('/api/customer/payments');if(!r.ok)return;const d=await r.json();el('providerStatus').innerHTML=d.methods.map(m=>`<p class="account-note">${esc(m.label)} · ${m.enabled?(m.mode==='sandbox'?'Sinov muhiti':'Ulangan'):'Ulanish kutilmoqda'}</p>`).join('');
 const labels={created:'Tayyorlanmoqda',pending:'Kutilmoqda',paid:'To‘landi',failed:'Muvaffaqiyatsiz',cancelled:'Bekor qilindi',refunded:'Qaytarildi',partially_refunded:'Qisman qaytarildi',review:'Aniqlashtirilmoqda'};
 el('paymentHistory').innerHTML=d.attempts.length?'<h3>To‘lov urinishlari tarixi</h3>'+d.attempts.map(a=>`<article class="account-row"><strong>${esc(a.provider.toUpperCase())} · ${Number(a.amount).toLocaleString('uz-UZ')} so‘m</strong><p>${esc(labels[a.status]||a.status)}${a.mode==='sandbox'?' · SINOV':''}</p><a href="payment.html?attempt=${encodeURIComponent(a.id)}">Batafsil / tekshirish →</a></article>`).join(''):'';
 }catch{el('providerStatus').textContent='To‘lov xizmatlari holati hozir olinmadi.';}
})();
