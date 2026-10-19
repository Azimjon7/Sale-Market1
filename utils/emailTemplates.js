'use strict';

const escapeHtml = value => String(value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function layout({ eyebrow, title, greeting, body, actionLabel, actionUrl, expiry, footer, language='uz' }) {
  const safeUrl = escapeHtml(actionUrl);
  const text = [
    `Dodola — ${title}`,
    '',
    greeting,
    body,
    '',
    `${actionLabel}: ${actionUrl}`,
    '',
    expiry,
    'Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.',
    '',
    footer
  ].join('\n');
  const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f7f5f0;font-family:Arial,sans-serif;color:#28251f"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f5f0;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e4dfd4;border-radius:22px;overflow:hidden;box-shadow:0 14px 36px rgba(76,29,149,.10)"><tr><td style="padding:24px 28px;background:#28251f;color:#fff"><div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Dodola</div><div style="margin-top:7px;font-size:25px;font-weight:800">${escapeHtml(title)}</div></td></tr><tr><td style="padding:30px 28px"><div style="color:#986b42;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(eyebrow)}</div><p style="margin:14px 0 8px;font-size:18px;font-weight:700">${escapeHtml(greeting)}</p><p style="margin:0 0 24px;color:#6f685e;font-size:15px;line-height:1.65">${escapeHtml(body)}</p><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:12px;background:#986b42"><a href="${safeUrl}" style="display:inline-block;padding:13px 20px;color:#fff;text-decoration:none;font-size:15px;font-weight:800">${escapeHtml(actionLabel)}</a></td></tr></table><p style="margin:22px 0 0;color:#6f685e;font-size:13px;line-height:1.55">${escapeHtml(expiry)}</p><p style="margin:8px 0 0;color:#6f685e;font-size:13px;line-height:1.55">Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.</p><p style="margin:20px 0 0;padding-top:18px;border-top:1px solid #eef0f4;color:#6f685e;font-size:12px;line-height:1.5">Tugma ishlamasa, quyidagi manzilni brauzerga ko‘chiring:<br><a href="${safeUrl}" style="color:#785232;word-break:break-all">${safeUrl}</a></p></td></tr><tr><td style="padding:17px 28px;background:#f7f5f0;color:#6f685e;font-size:12px">${escapeHtml(footer)}</td></tr></table></td></tr></table></body></html>`;
  const ru=language==='ru',replacements=[['Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.','Если вы не отправляли этот запрос, проигнорируйте письмо.'],['Tugma ishlamasa, quyidagi manzilni brauzerga ko‘chiring:','Если кнопка не работает, скопируйте ссылку в браузер:']];
  return {text:ru?replacements.reduce((s,[a,b])=>s.replaceAll(a,b),text):text,html:(ru?replacements.reduce((s,[a,b])=>s.replaceAll(a,b),html).replace('lang="uz"','lang="ru"'):html).replaceAll('#986b42','#7343ab').replaceAll('#28251f','#302238')};
}

function verificationEmail({ firstName, actionUrl, language='uz' }) {
  if(language==='ru')return {subject:'Dodola — подтвердите почту',...layout({language,eyebrow:'Подтверждение почты',title:'Подтвердите адрес почты',greeting:`Здравствуйте, ${firstName||'уважаемый покупатель'}!`,body:'Подтвердите адрес электронной почты для вашего аккаунта Dodola.',actionLabel:'Подтвердить почту',actionUrl,expiry:'Ссылка действует 24 часа и используется только один раз.',footer:'Dodola — удобные и надёжные покупки.'})};
  return {
    subject: 'Dodola emailingizni tasdiqlang',
    ...layout({
      eyebrow: 'Email tasdig‘i',
      title: 'Email manzilingizni tasdiqlang',
      greeting: `Assalomu alaykum, ${firstName || 'hurmatli mijoz'}!`,
      body: 'Dodola hisobingizni yakunlash uchun email manzilingizni tasdiqlang.',
      actionLabel: 'Emailni tasdiqlash',
      actionUrl,
      expiry: 'Ushbu xavfsiz havola 24 soat amal qiladi va faqat bir marta ishlatiladi.',
      footer: 'Dodola — qulay va ishonchli onlayn xarid.'
    })
  };
}

function passwordResetEmail({ firstName, actionUrl, language='uz' }) {
  if(language==='ru')return {subject:'Dodola — восстановление пароля',...layout({language,eyebrow:'Безопасность аккаунта',title:'Обновите пароль',greeting:`Здравствуйте, ${firstName||'уважаемый покупатель'}!`,body:'Получен запрос на восстановление пароля вашего аккаунта Dodola.',actionLabel:'Установить новый пароль',actionUrl,expiry:'Ссылка действует 30 минут и используется только один раз.',footer:'Служба безопасности Dodola.'})};
  return {
    subject: 'Dodola parolini tiklash',
    ...layout({
      eyebrow: 'Hisob xavfsizligi',
      title: 'Parolingizni yangilang',
      greeting: `Assalomu alaykum, ${firstName || 'hurmatli mijoz'}!`,
      body: 'Dodola hisobingiz uchun parolni tiklash so‘rovi qabul qilindi.',
      actionLabel: 'Yangi parol o‘rnatish',
      actionUrl,
      expiry: 'Ushbu xavfsiz havola 30 daqiqa amal qiladi va faqat bir marta ishlatiladi.',
      footer: 'Dodola xavfsizlik xizmati.'
    })
  };
}

module.exports = { verificationEmail, passwordResetEmail };
