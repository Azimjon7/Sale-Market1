'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceFile = process.env.DODOLA_TRANSLATION_SOURCE || path.join(root, 'data', 'products.json');
const outputFile = path.join(root, 'utils', 'product-translations.ru.json');

const manual = {
  'buyo_sivorotka-big-eye': ['Сыворотка Daisibo для роста ресниц и бровей «Большие глаза»', 'Уходовая сыворотка для ресниц и бровей. Используйте по инструкции и избегайте попадания средства в глаза.'],
  buyo_plasturbpolunb: ['Обезболивающие пластыри для спины, коленей и шеи', 'Удобные пластыри для местного применения помогают уменьшить ощущение дискомфорта в спине, коленях и шее.'],
  buyo_dekorsvetilnik: ['Декоративный светильник в форме подсолнуха', 'Нежный декоративный светильник создаёт уютное освещение и украшает интерьер комнаты.'],
  buyo_nosochki: ['Носки для ног', 'Мягкие удобные носки для повседневной носки.'],
  buyo_tabletki: ['Таблетки для очистки стиральной машины', 'Средство помогает очищать внутренние детали стиральной машины от загрязнений и неприятного запаха.'],
  buyo_gell: ['Гель против грибка и неприятного запаха', 'Средство для ухода за кожей ног и уменьшения неприятного запаха. Применяйте по инструкции.'],
  buyo_zubnayapasta: ['Японская отбеливающая зубная паста', 'Зубная паста для ежедневного ухода, свежего дыхания и бережного удаления поверхностного налёта.'],
  buyo_platok: ['Шифоновый платок с блестящей окантовкой', 'Лёгкий шифоновый платок с аккуратной блестящей отделкой для повседневных и праздничных образов.'],
  'buyo_pasta-dly-posydi': ['Универсальная чистящая паста от ржавчины, нагара и жира, 100 г', 'Чистящая паста для удаления стойких загрязнений с посуды и подходящих кухонных поверхностей.'],
  'buyo_child-car': ['Детское автомобильное кресло', 'Автомобильное кресло для безопасной и удобной перевозки ребёнка. Перед использованием проверьте возрастную и весовую группу.'],
  'buyo_balzam-s-pcheloy': ['Жидкий бальзам с пчелиным экстрактом', 'Бальзам для местного применения. Используйте в соответствии с инструкцией на упаковке.'],
  buyo_dyson: ['Фен Dyson Supersonic HD08 PREMIUM', 'Фен для быстрой и бережной сушки волос с удобными режимами температуры и скорости.'],
  'buyo_tv-ss-parfumes': ['Парфюмерная вода GUCCI BLOOM, 100 мл', 'Женский цветочный аромат в флаконе объёмом 100 мл.'],
  prd_1784615041900: ['Комплект термобелья для женщин и мужчин 🌬️', 'Лёгкое и удобное термобельё помогает сохранять тепло в холодную погоду. Эластичный материал подходит для прогулок, работы и активного отдыха.'],
  prd_1784614920759: ['Женское платье оверсайз Briddy 👗', 'Свободный крой красиво садится по фигуре и создаёт удобный, элегантный образ. Качественная ткань подходит для повседневной носки.'],
  prd_1784614834803: ['Женские флисовые брюки Ravelle 👖', 'Современная тёплая модель из мягкого флиса для комфортной повседневной носки в холодные дни.'],
  prd_1784614708980: ['Триммер для носа и ушей 👃🏼👂🏻', 'Компактное устройство для быстрого, удобного и бережного удаления лишних волос дома и в поездках.'],
  prd_1784614625228: ['Женская одежда в полоску с фактурной тканью 😍', 'Современная удобная модель красиво садится по фигуре и подходит для повседневных и элегантных образов.'],
  prd_1784614410974: ['Коврик Flowers для сушки посуды 😍', 'Быстро впитывает влагу и помогает безопасно и аккуратно сушить посуду, сохраняя кухонную поверхность сухой.'],
  prd_1784614306002: ['Держатель для полотенца на присоске', 'Легко устанавливается без сверления и помогает удобно хранить полотенца в ванной или на кухне.'],
  prd_1784614212254: ['Полустельки для увеличения роста', 'Удобно размещаются внутри обуви, визуально увеличивают рост и уменьшают давление на пятку при ходьбе.'],
  prd_1784614150176: ['Мягкий и уютный плед 🤍', 'Приятный мягкий материал подходит для отдыха дома, дивана или кровати и создаёт уютную атмосферу.'],
  prd_1784614069126: ['Домашние носки-тапочки 🦶🏼', 'Мягкий удобный материал сохраняет ноги в тепле и подходит для ежедневного использования дома.'],
  prd_1784613960253: ['Современные мужские наручные часы ⌚', 'Элегантные часы для повседневной носки или подарка дополняют мужской образ и удобно сидят на руке.'],
  prd_1784613706543: ['Клатч-сумка Angelika 👜', 'Элегантная компактная сумка подходит для повседневного образа и особых мероприятий, вмещая необходимые вещи.'],
  prd_1784613288226: ['Многоярусный стеллаж для кухни', 'Регулируемые полки помогают аккуратно разместить кухонную утварь и эффективно использовать свободное пространство.'],
  prd_1784613189451: ['Крем MEJISOO против шрамов и растяжек', 'При регулярном применении помогает сделать кожу более гладкой и уменьшить видимость шрамов, старых следов и растяжек.'],
  prd_1784612937128: ['Эфирное масло розмарина для поддержки роста волос 💆🏻‍♀️', 'Ухаживает за корнями волос, помогает укрепить их и уменьшить выпадение и перхоть при регулярном применении.'],
  prd_1784612748674: ['Разделитель для пальцев ног 👣', 'Защищает большой палец от давления и трения при ходьбе и мягко удерживает пальцы в удобном положении.'],
  prd_1784612650501: ['Шампунь 2 в 1 для седых волос', 'Окрашивает и ухаживает за волосами. Цвет сохраняется до 45 дней, формула не раздражает кожу головы.'],
  prd_1784612324117: ['Массажная подушка для расслабления 🙌🏼', 'Помогает снизить напряжение и усталость, расслабить мышцы и улучшить качество сна.'],
  prd_1783676215065: ['❄️ Пакеты для хранения продуктов в морозильнике', 'Подходят для разных продуктов и рассчитаны на многократное использование.'],
  prd_1783676133353: ['Солнцезащитные очки «кошачий глаз»', 'Очки с полной защитой от ультрафиолета. В комплекте футляр и салфетка для ухода.'],
  prd_1783676009196: ['Женская сумка-рюкзак', 'Повседневная женская сумка-рюкзак со съёмными плечевыми ремнями и качественной металлической фурнитурой.'],
  prd_1783675562888: ['Самонагревающийся наколенник', 'Создаёт естественный согревающий эффект благодаря турмалину. Универсальный размер подходит большинству пользователей.'],
};

function decode(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function russianUrl(value) {
  const url = new URL(value);
  url.protocol = 'https:';
  url.hostname = url.hostname.replace(/^www\./, '');
  url.pathname = url.pathname.replace(/^\/uz\//, '/ru/');
  return url.toString();
}

async function fetchTranslation(product, attempt = 0) {
  if (manual[product.id]) return { name: manual[product.id][0], description: manual[product.id][1], source: 'dodola' };
  if (!product.sourceUrl) throw new Error('missing source URL');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(russianUrl(product.sourceUrl), {
      signal: controller.signal,
      headers: { 'User-Agent': 'DodolaCatalogLocalization/1.0 (+https://dodola.uz)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const name = decode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]);
    const description = decode((html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1]);
    if (!name || !/[А-Яа-яЁё]/.test(name)) throw new Error('Russian product title not found');
    return { name, description, source: russianUrl(product.sourceUrl) };
  } catch (error) {
    if (attempt < 2) return fetchTranslation(product, attempt + 1);
    throw error;
  } finally { clearTimeout(timer); }
}

async function main() {
  const products = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const result = {};
  const failures = [];
  let cursor = 0;
  const workers = Array.from({ length: 8 }, async () => {
    while (cursor < products.length) {
      const index = cursor++;
      const product = products[index];
      try { result[product.id] = await fetchTranslation(product); }
      catch (error) { failures.push({ id: product.id, name: product.name, error: error.message }); }
      if ((index + 1) % 50 === 0 || index + 1 === products.length) console.log(`Translated ${index + 1}/${products.length}`);
    }
  });
  await Promise.all(workers);
  const ordered = Object.fromEntries(products.filter(product => result[product.id]).map(product => [product.id, result[product.id]]));
  fs.writeFileSync(outputFile, JSON.stringify(ordered, null, 2) + '\n');
  console.log(JSON.stringify({ products: products.length, translated: Object.keys(ordered).length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
