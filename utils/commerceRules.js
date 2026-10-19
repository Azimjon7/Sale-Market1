'use strict';
const DISTRICTS = ['Bektemir','Chilonzor','Mirobod','Mirzo Ulug‘bek','Olmazor','Sergeli','Shayxontohur','Uchtepa','Yakkasaroy','Yangihayot','Yashnobod','Yunusobod'];
const fail = (message, code = 'CHECKOUT_INVALID') => { throw Object.assign(new Error(message), {status:400,code}); };
function delivery(input = {}) {
  if (input.city !== 'tashkent-city') fail('Yetkazib berish faqat Toshkent shahri hududida mavjud. Toshkent viloyatiga yetkazilmaydi.', 'DELIVERY_OUTSIDE_CITY');
  if (!DISTRICTS.includes(input.district)) fail('Toshkent shahri tumanini tanlang.', 'DELIVERY_DISTRICT_REQUIRED');
  for (const key of ['street','house']) if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 120 || /[<>\x00-\x1f]/.test(input[key])) fail('Ko‘cha va uy raqamini to‘liq kiriting.', 'DELIVERY_ADDRESS_REQUIRED');
  if (input.street.trim().length < 3) fail('Ko‘cha nomini to‘liq kiriting.');
  const apartment = String(input.apartment || '').trim();
  if (apartment.length > 30 || /[<>\x00-\x1f]/.test(apartment)) fail('Xonadon raqami yaroqsiz.');
  return {city:'tashkent-city',district:input.district,street:input.street.trim(),house:input.house.trim(),apartment,
    address:`Toshkent shahri, ${input.district} tumani, ${input.street.trim()}, ${input.house.trim()}-uy${apartment ? ', '+apartment+'-xonadon' : ''}`,deliveryFee:0};
}
function minor(value) {
  const s=String(value); if (!/^\d+(\.\d{1,2})?$/.test(s)) fail('Summa yaroqsiz.');
  const [a,b='']=s.split('.'); const n=Number(a)*100+Number(b.padEnd(2,'0'));
  if (!Number.isSafeInteger(n) || n>999999999999) fail('Summa chegaradan tashqarida.'); return n;
}
function promoInput(input) {
  const code=String(input.code||'').trim().toUpperCase();
  if(!/^[A-Z0-9_-]{3,40}$/.test(code)) fail('Promokod 3–40 harf yoki raqamdan iborat bo‘lsin.');
  const discountPercent=Number(input.discountPercent);
  if(!Number.isFinite(discountPercent)||discountPercent<=0||discountPercent>90) fail('Chegirma 0 dan katta va 90% dan oshmasin.');
  const usageLimit=input.usageLimit==null||input.usageLimit===''?null:Number(input.usageLimit);
  if(usageLimit!==null&&(!Number.isSafeInteger(usageLimit)||usageLimit<1)) fail('Foydalanish limiti musbat butun son bo‘lsin.');
  const result={code,discountPercent,usageLimit,active:input.active!==false,minSpend:Number(input.minSpend||0),maxDiscount:input.maxDiscount==null||input.maxDiscount===''?null:Number(input.maxDiscount)};
  minor(result.minSpend); if(result.maxDiscount!==null) minor(result.maxDiscount);
  for(const key of ['startsAt','expiresAt']) {result[key]=input[key]||null; if(result[key]&&!Number.isFinite(Date.parse(result[key]))) fail('Promokod sanasi yaroqsiz.');}
  if(result.startsAt&&result.expiresAt&&Date.parse(result.expiresAt)<=Date.parse(result.startsAt)) fail('Tugash sanasi boshlanishdan keyin bo‘lsin.');
  return result;
}
function discount(promo, subtotal, used=0, now=Date.now()) {
  if(!promo || promo.active===false || (promo.startsAt&&Date.parse(promo.startsAt)>now) || (promo.expiresAt&&Date.parse(promo.expiresAt)<=now) || (promo.usageLimit!=null&&used>=Number(promo.usageLimit))) fail('Promokod faol emas, muddati yoki limiti tugagan.', 'PROMO_NOT_AVAILABLE');
  const p=promoInput(promo), cents=minor(subtotal);
  if(cents<minor(p.minSpend)) fail(`Promokod uchun kamida ${p.minSpend.toLocaleString('uz-UZ')} so‘mlik xarid kerak.`, 'PROMO_MIN_SPEND');
  return Math.min(cents, Math.floor(cents*p.discountPercent/100), p.maxDiscount===null?cents:minor(p.maxDiscount))/100;
}
function quote(items, products, promo, used=0) {
  if(!Array.isArray(items)||!items.length||items.length>100) fail('Savatdagi mahsulotlarni tekshiring.');
  let cents=0; const quantities=new Map();
  for(const item of items){const p=products.find(p=>String(p.id)===String(item.productId));const qty=Number(item.qty);
    if(!p||!Number.isSafeInteger(qty)||qty<1||qty>999) fail('Mahsulot yoki soni yaroqsiz.');
    const sum=(quantities.get(p.id)||0)+qty;if(sum>999)fail('Bir mahsulot soni 999 tadan oshmasin.');quantities.set(p.id,sum);
    cents+=minor(p.price)*qty; if(!Number.isSafeInteger(cents)||cents>999999999999)fail('Buyurtma summasi chegaradan tashqarida.');}
  const subtotal=cents/100,discountAmount=promo?discount(promo,subtotal,used):0;
  return {subtotal,discountAmount,deliveryFee:0,total:(cents-minor(discountAmount))/100,promoCode:promo?.code||''};
}
function rejectCardData(input) {
  if(!input||typeof input!=='object')return;
  for(const [key,value] of Object.entries(input)){if(/^(pan|card_?number|cvv|cvc|expiry|cardNumber)$/i.test(key)) fail('Karta rekvizitlarini bu saytga yubormang. To‘lov provayderning himoyalangan sahifasida amalga oshiriladi.','CARD_DATA_FORBIDDEN');if(value&&typeof value==='object')rejectCardData(value);}
}
module.exports={DISTRICTS,delivery,minor,promoInput,discount,quote,rejectCardData,fail};
