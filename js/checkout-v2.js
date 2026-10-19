(async()=>{'use strict';
 document.body.classList.add('checkout-page');
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>Number(n||0).toLocaleString('uz-UZ')+' so‘m';
 const cart=MBStore.getCart().map(({productId,qty,color,size})=>({productId,qty,color,size}));let promo=sessionStorage.getItem('dodola_promo')||'',quote,addresses=[];
 $('placeOrder').disabled=true;
 $('checkoutForm').onsubmit=e=>e.preventDefault();
 async function api(url,body){const r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const d=await r.json();if(!r.ok)throw Error(d.message||d.error||'Ma’lumot olinmadi.');return d;}
 function totals(){if(!quote)return;$('checkoutTotals').innerHTML=`<div class="totals-line"><span>Mahsulotlar</span><strong>${money(quote.subtotal)}</strong></div>${quote.discountAmount?`<div class="totals-line discount-line"><span>Chegirma · ${esc(quote.promoCode)}</span><strong>−${money(quote.discountAmount)}</strong></div>`:''}<div class="totals-line"><span>Yetkazish · Toshkent shahri</span><strong>Bepul</strong></div><div class="totals-line grand"><span>Jami</span><strong>${money(quote.total)}</strong></div>`;$('removePromo').hidden=!quote.promoCode;}
 async function refresh(){quote=await api('/api/checkout/quote',{items:cart,promoCode:promo});totals();$('summaryTotal').textContent=$('checkoutActionTotal').textContent=money(quote.total);}
 const summary=$('orderSummary'),mobile=matchMedia('(max-width:760px)');
 summary.open=!mobile.matches;
 mobile.addEventListener('change',()=>{summary.open=!mobile.matches;});
 $('summaryCount').textContent=cart.reduce((n,i)=>n+Number(i.qty),0)+' ta mahsulot';
 // Keep optional notes available without adding a full textarea to every visit.
 const note=$('note'),noteLabel=note.closest('label'),optional=document.createElement('details');
 optional.className='checkout-optional';optional.innerHTML='<summary>Buyurtmaga izoh <small>ixtiyoriy</small></summary>';
 noteLabel.before(optional);optional.append(noteLabel);
 // A fixed action never competes with the virtual keyboard or focused fields.
 function keyboardState(){const editing=/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName||''),keyboard=window.visualViewport&&innerHeight-window.visualViewport.height>160;document.body.classList.toggle('checkout-editing',mobile.matches&&(editing||keyboard));}
 document.addEventListener('focusin',keyboardState);document.addEventListener('focusout',()=>requestAnimationFrame(keyboardState));window.visualViewport?.addEventListener('resize',keyboardState);
 $('checkoutForm').addEventListener('invalid',e=>{e.target.closest('details')?.setAttribute('open','');},true);
 try{
 if(!cart.length){document.querySelector('.checkout-steps').hidden=true;document.querySelector('.checkout-layout').innerHTML='<section id="checkoutEmpty" class="checkout-card"><h2>Savatingiz bo‘sh</h2><p>Katalogdan yoqtirgan mahsulotingizni tanlang.</p><a class="d-secondary" href="shop.html">Katalogga o‘tish →</a></section>';return;}
 const [products,area,methods]=await Promise.all([api('/api/products'),api('/api/checkout/delivery'),api('/api/payments/methods')]);
 $('district').insertAdjacentHTML('beforeend',area.districts.map(d=>`<option>${esc(d)}</option>`).join(''));
 $('checkoutItems').innerHTML=cart.map(i=>{const p=products.find(p=>String(p.id)===String(i.productId));if(!p)throw Error('Savatdagi mahsulot topilmadi. Savatni yangilang.');const image=String(p.image||p.images?.[0]||'');const safe=/^(https:\/\/|\/?(?:uploads|img)\/)/.test(image);return `<article class="checkout-item"><img src="${esc(safe?image:'/img/placeholders/dodola-product.svg')}" alt="" loading="lazy"><div><strong>${esc(p.name)}</strong><small>${esc([i.color,i.size].filter(Boolean).join(' · '))} · ${i.qty} ta</small><b>${money(Number(p.price)*i.qty)}</b></div></article>`;}).join('');
 const all=[...methods.methods,{id:'card',label:'Bank kartasi',enabled:methods.methods.find(x=>x.id==='uzum')?.enabled}];
 const pref=localStorage.getItem('dodola_payment_preference')||'click';
 const descriptions={payme:'Payme ilovasi orqali',click:'Click ilovasi orqali',uzum:'Uzum orqali',card:'Himoyalangan provayder sahifasida'};
 const chosen=all.some(m=>m.id===pref)?pref:'click';
 $('paymentChoices').setAttribute('role','radiogroup');$('paymentChoices').setAttribute('aria-label','Afzal to‘lov usuli');
 $('paymentChoices').innerHTML=all.map(m=>`<label class="payment-choice"><input type="radio" name="paymentPreference" value="${esc(m.id)}" ${m.id===chosen?'checked':''}><span><strong class="${esc(m.id)}">${esc(m.label)}</strong><small>${descriptions[m.id]||'Provayder orqali'}</small></span></label>`).join('');
 const paymentNotice=$('paymentChoices').nextElementSibling;paymentNotice.classList.add('payment-notice');paymentNotice.textContent='Provayderlar hali ulanmagan. Hozir pul olinmaydi; to‘lov mavjudlik tasdig‘i va provayder ulanishidan keyin ochiladi. Karta ma’lumotlari faqat provayder sahifasida kiritiladi.';
 $('promoCode').value=promo;
 try{await refresh();}catch(e){if(!promo)throw e;promo='';sessionStorage.removeItem('dodola_promo');$('promoMessage').textContent=e.message;await refresh();}
 try{const r=await fetch('/api/customer/profile');if(r.ok){const {customer}=await r.json();$('name').value=[customer.firstName,customer.lastName].join(' ');$('phone').value=customer.phone;addresses=(customer.addresses||[]).filter(a=>a.city==='tashkent-city'&&a.street&&a.house);if(addresses.length){$('savedAddressLabel').hidden=false;$('savedAddress').insertAdjacentHTML('beforeend',addresses.map(a=>`<option value="${esc(a.id)}">${esc(a.label)} — ${esc(a.address)}</option>`).join(''));}}}catch{}
 }catch(e){$('checkoutMessage').textContent=e.message;$('placeOrder').disabled=true;}
 if($('name').value&&$('phone').value)document.querySelector('#checkoutForm .subtle-link').hidden=true;
 const primary=addresses.find(a=>a.isPrimary);if(primary){$('savedAddress').value=primary.id;for(const k of ['city','district','street','house','apartment'])$(k).value=primary[k]||'';}
 $('savedAddress').onchange=e=>{const a=addresses.find(a=>a.id===e.target.value);for(const k of ['city','district','street','house','apartment'])$(k).value=a?.[k]||(k==='city'?'tashkent-city':'');$('city').dispatchEvent(new Event('change'));};
 $('city').onchange=()=>{$('deliveryMessage').textContent=$('city').value==='tashkent-city'?'Yetkazib berish faqat Toshkent shahri hududida bepul.':'Bu manzilga hozircha yetkazib berilmaydi. Faqat Toshkent shahri manzilini tanlang.';$('placeOrder').disabled=$('city').value!=='tashkent-city'||!quote;};
 $('promoForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;promo=$('promoCode').value.trim();try{await refresh();sessionStorage.setItem('dodola_promo',promo);$('promoMessage').textContent='Promokod qo‘llandi.';}catch(err){promo='';sessionStorage.removeItem('dodola_promo');$('promoMessage').textContent=err.message;try{await refresh();}catch{quote=null;$('placeOrder').disabled=true;}}finally{b.disabled=false;}};
 $('removePromo').onclick=async()=>{promo='';sessionStorage.removeItem('dodola_promo');$('promoCode').value='';$('promoMessage').textContent='';try{await refresh();}catch(e){$('checkoutMessage').textContent=e.message;}};
 $('checkoutForm').onsubmit=async e=>{e.preventDefault();const button=$('placeOrder');button.disabled=true;$('checkoutMessage').textContent='Buyurtma tekshirilmoqda…';try{
 const values=Object.fromEntries(new FormData(e.target));const {city,district,street,house,apartment}=values;
 const payload={name:values.name,phone:values.phone,note:values.note,delivery:{city,district,street,house,apartment},paymentType:'karta',paymentPreference:values.paymentPreference,promoCode:promo,items:cart};
 payload.submissionToken=MBOrderSubmit.submissionToken(payload);
 const order=await MBOrderSubmit.submitOrder({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(order.trackingToken)sessionStorage.setItem('dodola_order_'+order.id,JSON.stringify({token:order.trackingToken,number:order.orderNumber}));
 sessionStorage.setItem('dodola_last_order',JSON.stringify(order));localStorage.setItem('dodola_payment_preference',values.paymentPreference||'click');MBStore.clearCart();MBOrderSubmit.forgetSubmissionToken();sessionStorage.removeItem('dodola_promo');location.href='/payment.html?order='+encodeURIComponent(order.id);
 }catch(err){$('checkoutMessage').textContent=err.message;}finally{button.disabled=$('city').value!=='tashkent-city'||!quote;}};
 $('placeOrder').disabled=$('city').value!=='tashkent-city'||!quote;
})();
