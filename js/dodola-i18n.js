/* Central Uzbek/Russian UI catalog. Product names/descriptions are localized by
 * the catalog API; customer-entered data stays untouched. */
(function(){'use strict';
 const normalize=s=>String(s).replace(/[‘’ʻʼ`]/g,"'").replace(/\s+/g,' ').trim();
 const phrases=`Bosh sahifa|Главная
Katalog|Каталог
Savat|Корзина
Profil|Профиль
Profilim|Мой профиль
Kirish|Войти
Kirish va ro‘yxatdan o‘tish|Вход и регистрация
Ro‘yxatdan o‘tish|Регистрация
Chiqish|Выйти
Asosiy mazmunga o‘tish|Перейти к содержимому
Mahsulotlarni qidirish|Поиск товаров
Nima izlayapsiz?|Что вы ищете?
Qidirish|Поиск
Do‘kon bo‘limlari|Разделы магазина
Asosiy navigatsiya|Основная навигация
Til|Язык
Ilova tili|Язык интерфейса
Tilni tanlang|Выберите язык
Saqlash|Сохранить
Saqlanmoqda…|Сохранение…
Saqlangan|Сохранено
Ma’lumotlar saqlandi.|Данные сохранены.
Xatolik yuz berdi.|Произошла ошибка.
Ma’lumot olinmadi.|Не удалось получить данные.
Sahifani yangilang.|Обновите страницу.
Yuklanmoqda...|Загрузка…
Yuklanmoqda…|Загрузка…
Yopish|Закрыть
Qaytish|Назад
Bekor qilish|Отмена
O‘chirish|Удалить
Tahrirlash|Изменить
Tizimga kirish|Вход в систему
Login|Логин
Parol|Пароль
Joriy parol|Текущий пароль
Yangi parol|Новый пароль
Parolni takrorlang|Повторите пароль
Email|Электронная почта
Telefon|Телефон
Telefon raqami|Номер телефона
Telefon raqami yoki admin logini|Номер телефона или логин администратора
Ism|Имя
Familiya|Фамилия
Ism va familiya|Имя и фамилия
Ism va familiyangiz|Ваше имя и фамилия
Otasining ismi|Отчество
ixtiyoriy|необязательно
Ixtiyoriy|Необязательно
Profil sozlamalari|Настройки профиля
Shaxsiy ma’lumotlar|Личные данные
Hisob ma’lumotlari|Данные аккаунта
Shaxsiy kabinet|Личный кабинет
Xush kelibsiz|Добро пожаловать
Xush kelibsiz,|Добро пожаловать,
SIZ UCHUN, DODOLA BILAN|DODOLA · ДЛЯ ВАС
Hammasi bir joyda|Всё под рукой
Buyurtmalarim|Мои заказы
Buyurtmalarni ko‘rish|Посмотреть заказы
So‘nggi buyurtmalar|Последние заказы
Xaridlar tarixi|История покупок
To‘lovlarim|Мои платежи
Manzillarim|Мои адреса
Yetkazib berish manzillari|Адреса доставки
Shaxsiy va xavfsizlik ma’lumotlari|Личные данные и безопасность
Yordam|Помощь
Yordam markazi|Центр помощи
Bog‘lanish|Контакты
Bog'lanish|Контакты
Aloqa|Контакты
Bo‘limlar|Разделы
Qaytarish bo‘yicha yordam|Помощь с возвратом
Qaytarish uchun buyurtma raqamini ko‘rsatib, yordam xizmatiga murojaat qiling. So‘rovingiz alohida ko‘rib chiqiladi.|Для возврата обратитесь в поддержку и укажите номер заказа. Каждый запрос рассматривается отдельно.
Saralanganlar|Избранное
Saralangan mahsulotlar|Избранные товары
Saralanganlar hali yo‘q|В избранном пока пусто
Yoqtirgan mahsulotlaringizni yurak tugmasi bilan saqlang.|Сохраняйте понравившиеся товары кнопкой с сердцем.
Saqlangan mahsulotlar shu brauzerda saqlanadi.|Избранное сохраняется в этом браузере.
Mahsulot savatga qo‘shildi ✓|Товар добавлен в корзину ✓
Qo‘shildi ✓|Добавлено ✓
Savatga|В корзину
Savatga qo‘shish|Добавить в корзину
Savatga qo'shish|Добавить в корзину
Savatga o‘tish|Перейти в корзину
O‘tish|Перейти
Kamaytirish|Уменьшить количество
Ko‘paytirish|Увеличить количество
Soni|Количество
Stokda bor|В наличии
Stokda yo‘q|Нет в наличии
Buyurtma asosida|Под заказ
Tasdiqdan so‘ng aniqlanadi|Уточняется после подтверждения
Toshkent shahri bo‘ylab bepul|Бесплатно по городу Ташкенту
Dodola hozircha onlayn do‘kon sifatida ishlaydi. Ommaviy ofis yoki savdo manzili e’lon qilinmagan.|Dodola пока работает как интернет-магазин. Публичный офис или адрес магазина не объявлен.
Mavjud|В наличии
Mavjudlik tasdig‘i|Подтверждение наличия
Avval mavjudlik tasdig‘i|Сначала подтвердим наличие
Toshkent shahri|Город Ташкент
Toshkent shahrida yetkazish — 0 so‘m|Доставка по Ташкенту — 0 сум
Toshkent shahri bo‘ylab bepul yetkazish ↗|Бесплатная доставка по Ташкенту ↗
Har kun.|Каждый день.
O‘zgacha|Особенный
tanlov.|выбор.
Uslubingizga mos kiyimlar.|Одежда в вашем стиле.
Hayotingizga yaqin detallar.|Детали для вашей жизни.
Katalogni kashf eting|Открыть каталог
Siz tanlaysiz. Biz mavjudligini tasdiqlaymiz.|Вы выбираете. Мы подтверждаем наличие.
Kategoriyalarni ochish|Открыть категории
Yaxshi tanlov|Хороший выбор
detallardan|начинается
boshlanadi.|с деталей.
KIYIMDAN KO‘PROQ|БОЛЬШЕ, ЧЕМ ОДЕЖДА
DODOLA · KATALOGDAN TANLOV|DODOLA · ИЗБРАННОЕ ИЗ КАТАЛОГА
YUMSHOQ TEKSTURALAR|МЯГКИЕ ФАКТУРЫ
USLUBINGIZGA BIR DETAL|ДЕТАЛЬ ВАШЕГО СТИЛЯ
SIZNING KUNDALIK DUNYOYINGIZ|ВАШ ПОВСЕДНЕВНЫЙ МИР
Har bir didga|Для каждого вкуса
bir tanlov.|свой выбор.
Barcha kategoriyalar ↗|Все категории ↗
DODOLA TANLOVI|ВЫБОР DODOLA
E’tiborga arzigulik|Достойные внимания
topilmalar.|находки.
Butun katalog ↗|Весь каталог ↗
Ko‘proq mahsulotlar|Больше товаров
AMALDAGI CHEGIRMALAR|АКТУАЛЬНЫЕ СКИДКИ
Yoqtirganingiz.|То, что нравится.
Yoqimliroq narxda.|По приятной цене.
Chegirmalarni ko‘rish|Посмотреть скидки
Katalogdagi asl va joriy narxlarni solishtiring.|Сравните прежние и текущие цены каталога.
To‘lov — mavjudlik tasdiqlanganidan keyin.|Оплата после подтверждения наличия.
Barcha mahsulotlar|Все товары
Dodola KATALOGI|КАТАЛОГ DODOLA
Kategoriyani tanlang, saralang yoki kerakli mahsulotni qidiring.|Выберите категорию, сортировку или найдите нужный товар.
Saralash|Сортировка
Filtr|Фильтр
Filtrlar|Фильтры
Kategoriya|Категория
Barchasi|Все
Faol|Активные
Eng yangilar|Сначала новые
Yangilar avval|Сначала новые
Narx: arzonidan|Цена: по возрастанию
Narx: qimmatidan|Цена: по убыванию
Narx o‘sish tartibida|По возрастанию цены
Narx kamayish tartibida|По убыванию цены
Nomi bo‘yicha|По названию
Chegirmalar|Скидки
Faqat chegirmadagilar|Только со скидкой
Narx|Цена
Minimal narx|Минимальная цена
Maksimal narx|Максимальная цена
Tozalash|Сбросить
Qo‘llash|Применить
Natijalar|Результаты
Mahsulot topilmadi|Товар не найден
Hech qanday mahsulot topilmadi|Товары не найдены
Qidiruvni tozalash|Очистить поиск
Savatga qaytish|Вернуться в корзину
Saytga qaytish|Вернуться в магазин
Nusxalash|Копировать
Nusxalandi|Скопировано
O‘lcham|Размер
Rang|Цвет
O‘lcham tanlanmagan|Размер не выбран
Rang tanlanmagan|Цвет не выбран
Soni|Количество
Oq|Белый
Qora|Чёрный
Kulrang|Серый
Jigarrang|Коричневый
Hozir olish|Купить сейчас
Mahsulot haqida|О товаре
Tavsif|Описание
Yetkazib berish|Доставка
Omborda|Наличие
Mahsulotlar|Товары
Savatdagi mahsulotlar|Товары в корзине
Yana qo‘shish|Добавить ещё
Buyurtma xulosasi|Итого по заказу
Xavfsiz buyurtma|Безопасный заказ
Umumiy summa|Общая сумма
Jami|Итого
Bepul|Бесплатно
BEPUL|БЕСПЛАТНО
Yetkazish · Toshkent shahri|Доставка · город Ташкент
Promokod|Промокод
Promokod kiriting.|Введите промокод.
Promokodni kiriting|Введите промокод
Promokod qo‘llandi.|Промокод применён.
Promokod ishlamadi|Промокод не применён
Promokodni olib tashlash|Убрать промокод
Promokodingiz bormi?|Есть промокод?
Chegirma|Скидка
Buyurtmani rasmiylashtirish|Оформить заказ
Rasmiylashtirish|Оформить
Buyurtma|Заказ
DODOLA · XARIDNI YAKUNLASH|DODOLA · ОФОРМЛЕНИЕ ЗАКАЗА
Avval mavjudlikni tasdiqlaymiz. Keyin to‘laysiz.|Сначала подтвердим наличие. Затем вы оплатите.
Buyurtma bosqichlari|Этапы заказа
Siz bilan bog‘lanamiz|Свяжемся с вами
Buyurtma tafsilotlarini shu raqam orqali aniqlashtiramiz.|Уточним детали заказа по этому номеру.
Kabinetga kirish →|Войти в аккаунт →
Manzilingizga yetkazamiz|Доставим по вашему адресу
Hozircha faqat Toshkent shahri bo‘ylab.|Пока только по городу Ташкенту.
Saqlangan manzil|Сохранённый адрес
Yangi manzil|Новый адрес
Shahar|Город
Tuman|Район
Tumanni tanlang|Выберите район
Ko‘cha yoki mahalla|Улица или махалля
Ko‘cha / mahalla|Улица / махалля
Ko‘cha nomi|Название улицы
Uy raqami|Номер дома
Xonadon|Квартира
Xonadon (ixtiyoriy)|Квартира (необязательно)
Buyurtmaga izoh|Комментарий к заказу
Mo‘ljal, qulay bog‘lanish vaqti…|Ориентир, удобное время для связи…
Masalan, 24|Например, 24
Masalan, 16|Например, 16
Boshqa shahar / Toshkent viloyati|Другой город / Ташкентская область
Toshkent viloyati va boshqa shaharlarga hozircha yetkazib berilmaydi.|В Ташкентскую область и другие города пока не доставляем.
Yetkazib berish faqat Toshkent shahri hududida bepul.|Бесплатная доставка только в пределах города Ташкента.
Bu manzilga hozircha yetkazib berilmaydi. Faqat Toshkent shahri manzilini tanlang.|По этому адресу пока не доставляем. Выберите адрес в городе Ташкенте.
Faqat Toshkent shahri hududida yetkazib berish bepul.|Бесплатная доставка только в пределах города Ташкента.
Faqat Toshkent shahri hududida bepul yetkazib beramiz.|Бесплатно доставляем только в пределах города Ташкента.
To‘lov usuli|Способ оплаты
Afzal to‘lov usuli|Предпочтительный способ оплаты
Afzal ko‘rgan usulingizni tanlang.|Выберите предпочтительный способ.
Bank kartasi|Банковская карта
Payme ilovasi orqali|Через приложение Payme
Click ilovasi orqali|Через приложение Click
Uzum orqali|Через Uzum
Himoyalangan provayder sahifasida|На защищённой странице провайдера
Provayderlar hali ulanmagan. Hozir pul olinmaydi; to‘lov mavjudlik tasdig‘i va provayder ulanishidan keyin ochiladi. Karta ma’lumotlari faqat provayder sahifasida kiritiladi.|Провайдеры ещё не подключены. Сейчас деньги не списываются. Оплата откроется после подтверждения наличия и подключения провайдера. Реквизиты карты вводятся только на странице провайдера.
Buyurtmani tasdiqqa yuborish|Отправить заказ на подтверждение
Hozir kartangizdan pul olinmaydi.|Сейчас деньги с карты не списываются.
Jami · yetkazish bepul|Итого · доставка бесплатно
Hisoblanmoqda…|Расчёт…
Buyurtma tekshirilmoqda…|Проверяем заказ…
Buyurtma tarkibi|Состав заказа
Avval tasdiq, keyin to‘lov.|Сначала подтверждение, затем оплата.
Holatni kabinetingizda kuzating.|Следите за статусом в личном кабинете.
Yordam kerakmi? Biz bilan bog‘laning ↗|Нужна помощь? Свяжитесь с нами ↗
Dodola · Uyga yaqin xaridlar|Dodola · Покупки ближе к дому
Savatingiz bo‘sh|Ваша корзина пуста
Savat bo‘sh|Корзина пуста
Katalogdan yoqtirgan mahsulotingizni tanlang.|Выберите понравившийся товар в каталоге.
Yoqtirgan mahsulotingizni katalogdan tanlang va savatga qo‘shing.|Выберите понравившийся товар и добавьте его в корзину.
Katalogga o‘tish|Перейти в каталог
Katalogni ko‘rish →|Посмотреть каталог →
Katalogga o‘tish →|Перейти в каталог →
Tanlovingizni tekshiring va buyurtmani tasdiqqa yuboring.|Проверьте выбор и отправьте заказ на подтверждение.
Buyurtmani kuzatish|Отследить заказ
Buyurtmani tekshirish|Проверить заказ
Buyurtma raqami|Номер заказа
Maxfiy kuzatuv kaliti|Секретный ключ отслеживания
Buyurtmadan keyin berilgan kalit|Ключ, полученный после оформления
Buyurtma raqami orqali yetkazib berish holatini xavfsiz tekshiring.|Безопасно проверьте статус доставки по номеру заказа.
Tafsilotlarni ko‘rish →|Посмотреть детали →
Mavjudlik tasdig‘i kutilmoqda|Ожидается подтверждение наличия
Tasdiqlashni kutmoqda|Ожидается подтверждение
Mahsulotlar tasdiqlandi|Товары подтверждены
Tasdiqlandi|Подтверждён
To‘lov kutilmoqda|Ожидается оплата
To‘landi|Оплачено
To‘lov tasdig‘i kutilmoqda|Ожидается подтверждение оплаты
Tayyorlanmoqda|Готовится
Yetkazilmoqda|Доставляется
Yetkazildi|Доставлен
Qabul qilindi|Получен
Bekor qilindi|Отменён
Rad etildi|Отклонён
Muvaffaqiyatsiz|Не удалось
Qaytarildi|Возвращён
Qisman qaytarildi|Частичный возврат
Aniqlashtirilmoqda|Уточняется
Kutilmoqda|Ожидается
Buyurtmalarga|К заказам
Buyurtmalarim →|Мои заказы →
To‘lovni tekshirish|Проверить оплату
Ulanish kutilmoqda|Ожидается подключение
Sinov muhiti|Тестовая среда
SINOV|ТЕСТ
To‘lov faqat ulangan xizmat orqali amalga oshiriladi.|Оплата выполняется только через подключённый сервис.
Mahsulotlar mavjudligini tekshiryapmiz. Tasdiqlangach, to‘lov imkoniyati shu yerda ko‘rinadi.|Проверяем наличие товаров. После подтверждения здесь появится возможность оплаты.
Mahsulotlar mavjudligini tekshiryapmiz. Tasdiqlangach, to‘lov xizmati orqali amalga oshiriladi.|Проверяем наличие товаров. После подтверждения оплата выполняется через платёжный сервис.
HAR BIR QADAM NAZORATINGIZDA|КАЖДЫЙ ШАГ ПОД КОНТРОЛЕМ
BUYURTMANGIZNING YO‘LI|ЭТАПЫ ВАШЕГО ЗАКАЗА
SIZNING TANLOVINGIZ|ВАШ ВЫБОР
Buyurtma yuborish|Оформление заказа
Tayyorlash|Подготовка
Yetkazish|Доставка
Qabul qilish|Получение
Xavfsizlik|Безопасность
Parolni almashtirish|Изменить пароль
Kamida 10 belgi, harf va raqam ishlating.|Используйте не менее 10 символов, буквы и цифры.
Parolni unutdingizmi?|Забыли пароль?
Parolni tiklash|Восстановить пароль
Parolni yangilash|Обновить пароль
Tiklash havolasini yuborish|Отправить ссылку для восстановления
Kirishga qaytish|Вернуться ко входу
Telefon: tasdiqlanmagan|Телефон: не подтверждён
Telefon: tasdiqlangan|Телефон: подтверждён
Email: tasdiqlanmagan|Почта: не подтверждена
Email: tasdiqlangan|Почта: подтверждена
Email tasdiqlangan|Почта подтверждена
Email tasdiqlanmagan|Почта не подтверждена
Tasdiqlash xatini qayta yuborish|Отправить письмо повторно
Telefon yoki email o‘zgarsa, joriy parol talab qilinadi. Tasdiqlash alohida bajariladi.|Для изменения телефона или почты нужен текущий пароль. Подтверждение выполняется отдельно.
Tasdiqlash xatini yuborish|Отправить письмо подтверждения
Telefon tasdig‘i hali ulanmagan.|Подтверждение телефона пока не подключено.
Joriy parol (aloqa o‘zgarsa)|Текущий пароль (при изменении контактов)
Manzilni saqlash|Сохранить адрес
Nomi|Название
Masalan, Uy|Например, Дом
Asosiy manzil|Основной адрес
Asosiy qilish|Сделать основным
Manzil o‘chirilsinmi?|Удалить адрес?
Bu amal buyurtmalaringizdagi manzilni o‘zgartirmaydi.|Адрес в уже оформленных заказах не изменится.
Manzil o‘chirildi.|Адрес удалён.
Manzil saqlandi.|Адрес сохранён.
Asosiy manzil tanlandi.|Основной адрес выбран.
Saqlangan manzil yo‘q|Нет сохранённых адресов
Tezroq rasmiylashtirish uchun yetkazib berish manzilini saqlang.|Сохраните адрес для быстрого оформления заказа.
Faol buyurtma yo‘q|Нет активных заказов
Buyurtmalar hali yo‘q|Заказов пока нет
Barcha buyurtmalar bo‘limida oldingi xaridlaringizni ko‘rishingiz mumkin.|Предыдущие покупки доступны в разделе всех заказов.
Katalogdan mahsulot tanlab, birinchi buyurtmangizni rasmiylashtiring.|Выберите товар и оформите первый заказ.
Barchasini ko‘rish →|Посмотреть все →
To‘lov ma’lumotlari yo‘q|Нет данных об оплате
Buyurtma rasmiylashtirilgach, uning haqiqiy to‘lov holati shu yerda ko‘rinadi.|После оформления заказа здесь появится его фактический статус оплаты.
Haqiqiy buyurtma ma’lumotlari|Данные ваших заказов
Bu yerda faqat buyurtmalaringizdagi mavjud to‘lov holatlari ko‘rsatiladi.|Здесь отображаются фактические статусы оплаты ваших заказов.
Afzal to‘lov usulingiz|Предпочтительный способ оплаты
Keyingi xarid uchun tanlov|Выбор для следующей покупки
Tanlov shu brauzerda saqlanadi. Karta raqami va CVV saqlanmaydi. Ulanmagan usullar orqali hozir to‘lov olinmaydi.|Выбор сохраняется в этом браузере. Номера карт и CVV не хранятся. Через неподключённые сервисы оплата не принимается.
Xaridlaringiz, manzillaringiz va buyurtmalaringiz — bir joyda.|Покупки, адреса и заказы — в одном месте.
Kabinetga kirish talab qilinadi.|Войдите в личный кабинет.
Sessiya yakunlangan. Qayta kiring.|Сессия завершена. Войдите снова.
Xavfsizlik tasdig‘i yaroqsiz. Sahifani yangilang.|Проверка безопасности не пройдена. Обновите страницу.
Sayt ishga tushirishga tayyorlanmoqda. Bu amal hozircha yopiq.|Сайт готовится к запуску. Это действие пока недоступно.
Ism va familiya majburiy.|Имя и фамилия обязательны.
Ism ma’lumotlarini tekshiring.|Проверьте имя и фамилию.
Telefon yoki email formati noto‘g‘ri.|Неверный формат телефона или почты.
Aloqa ma’lumotlarini o‘zgartirish uchun joriy parolni kiriting.|Для изменения контактов введите текущий пароль.
Bu telefon yoki email boshqa hisobga tegishli.|Этот телефон или адрес почты принадлежит другому аккаунту.
Til noto‘g‘ri tanlangan.|Выбран неподдерживаемый язык.
Manzil ma’lumotlarini to‘ldiring.|Заполните адрес.
Manzil topilmadi.|Адрес не найден.
Joriy yoki yangi parol noto‘g‘ri.|Неверный текущий или новый пароль.
Email allaqachon tasdiqlangan.|Почта уже подтверждена.
Tasdiqlash havolasi yaroqsiz yoki muddati tugagan.|Ссылка подтверждения недействительна или срок её действия истёк.
Tasdiqlash xati yuborildi.|Письмо подтверждения отправлено.
Email tasdiqlandi.|Почта подтверждена.
Telefon va email hisob xavfsizligi uchun shu yerda o‘zgartirilmaydi. Aloqa ma’lumotini yangilash uchun yordam bo‘limiga murojaat qiling.|Для изменения контактных данных откройте настройки профиля.
Sana ko‘rsatilmagan|Дата не указана
Ijtimoiy tarmoqlar|Социальные сети
Manzil|Адрес
Toshkent, O‘zbekiston|Ташкент, Узбекистан
Google Maps orqali ochish|Открыть в Google Maps
Lokatsiya xaritada|Адрес на карте
Yo‘nalishni bilish uchun xaritani oching|Откройте карту, чтобы построить маршрут
Google Maps’da ochish|Открыть в Google Maps
Savollar, buyurtma va hamkorlik uchun biz bilan bog‘laning.|Свяжитесь с нами по вопросам заказов и сотрудничества.
O‘zbekistonda qulay va ishonchli online xarid. Katalog, savat, checkout va buyurtma kuzatuvi bir joyda.|Удобные и надёжные покупки в Узбекистане. Каталог, корзина, оформление и отслеживание заказов в одном месте.
Mebel|Мебель
Ustki kiyimlar|Одежда
Shimlar|Брюки
Sumkalar|Сумки
Aksesuarlar|Аксессуары
Oyoq kiyimlar|Обувь
Jihozlar|Товары для дома
Oshxona|Кухня
Sport|Спорт
Bolalar|Детям
Go‘zallik|Красота
Elektronika|Электроника
Parfyumeriya|Парфюмерия
Ayollar kiyimi|Женская одежда
Erkaklar kiyimi|Мужская одежда
Ayollar poyabzali|Женская обувь
Erkaklar poyabzali|Мужская обувь
Avtomobil|Автомобиль
Takliflar|Предложения
Yangi|Новинка
Kamaytirish|Уменьшить
Ko‘paytirish|Увеличить
Miqdor|Количество
Qidiruv|Поиск
Mahsulot|Товар
Davom etish|Продолжить
SIZNING KUNDALIK DUNYONGIZ|ВАШ ПОВСЕДНЕВНЫЙ МИР
detallardan boshlanadi.|начинается с деталей.
← Saytga qaytish|← Вернуться в магазин
← Profil|← Профиль
← Buyurtmalarim|← Мои заказы
To‘lov|Оплата
To‘lov tasdig‘i|Подтверждение оплаты
Batafsil|Подробнее
O‘xshash mahsulotlar|Похожие товары
Yostiq|Подушки
Teri parvarishi|Уход за кожей
Shampun|Шампуни
Uy jihozlari|Товары для дома
Tozalash|Сбросить
Yoritish|Освещение
To‘plamlar|Наборы
Bog‘dorchilik|Сад и огород
Boshqa mahsulotlar|Другие товары
Hayvonlar|Животным
Фаол дам олиш учун товарлар|Товары для активного отдыха
Tuning va ichki dekor|Тюнинг и декор салона
O‘yinchoqlar va rivojlantiruvchi materiallar|Игрушки и развивающие материалы
Kiym|Одежда
Vanna mahsulotlari|Товары для ванной
· tasdiqlangan|· подтверждено
· kutilmoqda|· ожидается
YETKAZIB BERISH|ДОСТАВКА
Sizga yetib boradigan manzil|Адрес доставки
Yangi buyurtmalar uchun faqat Toshkent shahri bo‘ylab bepul yetkazib berish.|Бесплатная доставка новых заказов только по городу Ташкенту.
TO‘LOV VA YAKUNIY SUMMA|ОПЛАТА И ИТОГОВАЯ СУММА
Avval mahsulotlar mavjudligi tasdiqlanadi. Hozir kartangizdan pul olinmaydi.|Сначала подтверждаем наличие товаров. Сейчас деньги с карты не списываются.
Holatni tekshirish ↻|Обновить статус ↻
To‘lov holati serverdagi tasdiqlangan ma’lumotdan olinadi.|Статус оплаты берётся из подтверждённых данных сервера.
Yordam kerakmi? Bog‘laning →|Нужна помощь? Свяжитесь с нами →
Mahsulotlar mavjudligini tekshiryapmiz. Tasdiqlangach, to‘lov imkoniyatlari shu yerda ko‘rinadi.|Проверяем наличие товаров. После подтверждения здесь появится возможность оплаты.
Yo‘nalishni ko‘rish uchun xaritani oching.|Откройте карту для построения маршрута.
Email xizmati hozircha sozlanmagan.|Почтовый сервис пока не настроен.
Tasdiqlash xati yuborish uchun qabul qilindi.|Запрос на отправку письма подтверждения принят.
Tasdiqlash xatini yuborib bo‘lmadi. Keyinroq qayta urinib ko‘ring.|Не удалось отправить письмо подтверждения. Попробуйте позже.
Yangi xat so‘rashdan oldin bir daqiqa kuting.|Подождите минуту перед повторным запросом письма.
Tasdiqlash xati juda ko‘p so‘raldi. Bir soatdan keyin qayta urinib ko‘ring.|Слишком много запросов письма. Попробуйте через час.
Juda ko‘p urinish. 15 daqiqadan keyin qayta urinib ko‘ring.|Слишком много попыток. Попробуйте через 15 минут.
Juda ko‘p so‘rov yuborildi. Keyinroq qayta urinib ko‘ring.|Слишком много запросов. Попробуйте позже.
Ma’lumotlarni tekshiring. Parol kamida 10 belgi, harf va raqamdan iborat bo‘lsin.|Проверьте данные. Пароль должен содержать не менее 10 символов, буквы и цифры.
Bu telefon yoki email allaqachon ro‘yxatdan o‘tgan.|Этот телефон или адрес почты уже зарегистрирован.
Hisob yaratildi, ammo email xizmati sozlanmagan. Tasdiqlash xati yuborilmadi.|Аккаунт создан, но почтовый сервис не настроен. Письмо подтверждения не отправлено.
Hisob yaratildi. Tasdiqlash havolasi yuborish uchun qabul qilindi.|Аккаунт создан. Запрос на отправку ссылки подтверждения принят.
Hisob yaratildi, ammo tasdiqlash xatini yuborib bo‘lmadi. Kabinetdan qayta urinishingiz mumkin.|Аккаунт создан, но письмо подтверждения не отправлено. Повторите попытку в личном кабинете.
Telefon raqami yoki parol noto‘g‘ri.|Неверный номер телефона или пароль.
Agar tasdiqlangan hisob mavjud bo‘lsa, tiklash xati yuborish uchun qabul qilindi.|Если подтверждённый аккаунт существует, запрос на отправку письма восстановления принят.
Tiklash xatini yuborib bo‘lmadi. Keyinroq qayta urinib ko‘ring.|Не удалось отправить письмо восстановления. Попробуйте позже.
Yangi parol talabga javob bermaydi.|Новый пароль не соответствует требованиям.
Parol yangilandi. Qayta kiring.|Пароль обновлён. Войдите снова.
Tiklash havolasi yaroqsiz yoki muddati tugagan.|Ссылка восстановления недействительна или срок её действия истёк.
Ma’lumotlar o‘zgargan. Sahifani yangilang.|Данные изменились. Обновите страницу.
Yetkazib berish faqat Toshkent shahri hududida mavjud. Toshkent viloyatiga yetkazilmaydi.|Доставка доступна только по городу Ташкенту. В Ташкентскую область не доставляем.
Toshkent shahri tumanini tanlang.|Выберите район города Ташкента.
Ko‘cha va uy raqamini to‘liq kiriting.|Укажите улицу и номер дома полностью.
Ko‘cha nomini to‘liq kiriting.|Введите полное название улицы.
Xonadon raqami yaroqsiz.|Неверный номер квартиры.
Promokod faol emas, muddati yoki limiti tugagan.|Промокод неактивен, истёк срок или исчерпан лимит.
Promokod 3–40 harf yoki raqamdan iborat bo‘lsin.|Промокод должен содержать от 3 до 40 букв или цифр.
Savatdagi mahsulotlarni tekshiring.|Проверьте товары в корзине.
Mahsulot yoki soni yaroqsiz.|Неверный товар или количество.
Bir mahsulot soni 999 tadan oshmasin.|Количество одного товара не должно превышать 999.
Buyurtma summasi chegaradan tashqarida.|Сумма заказа превышает допустимый предел.
Summa yaroqsiz.|Неверная сумма.
Karta rekvizitlarini bu saytga yubormang. To‘lov provayderning himoyalangan sahifasida amalga oshiriladi.|Не отправляйте реквизиты карты на этот сайт. Оплата проводится на защищённой странице провайдера.
Omborda buncha mahsulot yo‘q.|В наличии нет такого количества товара.
Miqdor 1 dan 999 gacha butun son bo‘lishi kerak.|Количество должно быть целым числом от 1 до 999.
Kabinetni yuklab bo‘lmadi. Sahifani yangilang.|Не удалось загрузить личный кабинет. Обновите страницу.
Tumanlar ro‘yxatini yuklab bo‘lmadi.|Не удалось загрузить список районов.
To‘lov xizmatlari holati hozir olinmadi.|Не удалось получить статус платёжных сервисов.
To‘lov urinishlari tarixi|История попыток оплаты
Batafsil / tekshirish →|Подробнее / проверить →
Bu yerda faqat buyurtmalaringizdagi mavjud to‘lov holatlari ko‘rsatiladi.|Здесь отображаются фактические статусы оплаты ваших заказов.
To‘lov tayyorlanmoqda|Оплата готовится
Tasdiq kutilmoqda|Ожидается подтверждение
Tekshiruv talab qilinadi — qayta to‘lamang|Требуется проверка — не оплачивайте повторно
To‘lov amalga oshmadi|Оплата не прошла
Mablag‘ qaytarildi|Средства возвращены
Mablag‘ning bir qismi qaytarildi|Часть средств возвращена
Buyurtma rad etildi|Заказ отклонён
Buyurtmani kabinetingizdan tanlang.|Выберите заказ в личном кабинете.
Ma’lumot ochilmadi. Kabinetga kiring yoki buyurtma havolasini ishlating.|Не удалось открыть данные. Войдите в аккаунт или используйте ссылку заказа.
Buyurtmani ko‘rish uchun hisobingizga kiring yoki maxfiy kuzatuv havolangizdan foydalaning.|Войдите в аккаунт или используйте секретную ссылку отслеживания для просмотра заказа.
Holat serverdan yangilandi.|Статус обновлён с сервера.
To‘lov server tomonidan tasdiqlangan. Buyurtma holatini shu yerda kuzatishingiz mumkin.|Оплата подтверждена сервером. Следите за статусом заказа здесь.
Qaytarish holati provayderdan tekshirilgan. Tafsilotlar uchun biz bilan bog‘laning.|Статус возврата проверен у провайдера. Свяжитесь с нами для уточнения деталей.
Ushbu buyurtma yakunlangan. Savollaringiz bo‘lsa, biz bilan bog‘laning.|Этот заказ завершён. Если есть вопросы, свяжитесь с нами.
Mahsulotlar mavjudligi tasdiqlandi. To‘lov faqat ulangan xizmat orqali amalga oshiriladi.|Наличие подтверждено. Оплата выполняется только через подключённый сервис.
Eski buyurtmada mahsulot tafsilotlari mavjud emas.|В старом заказе нет подробных данных о товарах.
Manzil tafsilotlarini biz bilan aniqlashtiring.|Уточните адрес у службы поддержки.
Provayder sahifasida davom etish ↗|Продолжить на странице провайдера ↗
SINOV MUHITI · Haqiqiy pul o‘tkazmasi emas.|ТЕСТОВАЯ СРЕДА · Это не реальный денежный перевод.
Bektemir|Бектемир
Chilonzor|Чиланзар
Mirobod|Мирабад
Mirzo Ulug‘bek|Мирзо-Улугбек
Olmazor|Алмазар
Sergeli|Сергели
Shayxontohur|Шайхантахур
Uchtepa|Учтепа
Yakkasaroy|Яккасарай
Yangihayot|Янгихаёт
Yashnobod|Яшнабад
Yunusobod|Юнусабад
Dodola — Profil sozlamalari|Dodola — Настройки профиля
Dodola — Saralanganlar|Dodola — Избранное
Dodola — Mening kabinetim|Dodola — Личный кабинет
Dodola — Kirish|Dodola — Вход
Buyurtmani rasmiylashtirish — Dodola|Оформить заказ — Dodola
Kategoriyalar|Категории
Yangidan eskiga|Сначала новые
Eskidan yangiga|Сначала старые
Arzondan qimmatga|По возрастанию цены
Qimmatdan arzonga|По убыванию цены
Yangi ↓|Новые ↓
Eski ↑|Старые ↑
Narx ↑|Цена ↑
Narx ↓|Цена ↓
Mashhur|Популярные
Mahsulot nomi, rang, razmer...|Название, цвет, размер…
Narx oralig‘i (so‘m)|Диапазон цен (сум)
Min narx|Мин. цена
Max narx|Макс. цена
Natijalarni ko‘rsatish|Показать результаты
Filtr yoqilgan|Фильтр включён
Barcha mahsulotlar ko‘rsatilmoqda|Показаны все товары
Kategoriyani qidiring|Найти категорию
Izlash...|Поиск…
Promokod topilmadi yoki muddati tugagan.|Промокод не найден или срок действия истёк.
To‘lov tasdiqlangan|Оплата подтверждена
Mablag‘ qisman qaytarildi|Средства частично возвращены
Jo‘natildi|Отправлен
Karta orqali|Картой
Naqd|Наличными
Holat ko‘rsatilmagan|Статус не указан
To‘lov holati ko‘rsatilmagan|Статус оплаты не указан
Ko‘rsatilmagan|Не указано
Tizim|Система
Sabab ko‘rsatilmagan|Причина не указана
Buyurtma topilmadi yoki kuzatuv kaliti noto‘g‘ri.|Заказ не найден или ключ отслеживания неверный.
Buyurtma topilmadi.|Заказ не найден.
Ma’lumotlarni tekshiring.|Проверьте данные.
Buyurtmani yuborib bo‘lmadi.|Не удалось отправить заказ.
Telefon formati noto‘g‘ri. +998 va 9 raqam kiriting.|Неверный формат телефона. Введите +998 и 9 цифр.
Tarmoq bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.|Не удалось подключиться к сети. Попробуйте снова.
Manzil 5–500 belgidan iborat bo‘lishi kerak.|Адрес должен содержать от 5 до 500 символов.
Ism 1–100 belgidan iborat bo‘lishi kerak.|Имя должно содержать от 1 до 100 символов.
Buyurtmada kamida bitta mahsulot bo‘lishi kerak.|В заказе должен быть хотя бы один товар.
Buyurtma summasi musbat bo‘lishi kerak.|Сумма заказа должна быть положительной.`;
 const dict=Object.fromEntries(phrases.split('\n').map(l=>{const p=l.indexOf('|');return [normalize(l.slice(0,p)),l.slice(p+1)];}));
 let lang;try{lang=localStorage.getItem('dodola_language')==='ru'?'ru':'uz';}catch{lang='uz';}
 const english={'Customer name is required':'Ism va familiya majburiy.','Customer name must be 1-100 characters':'Ism 1–100 belgidan iborat bo‘lishi kerak.','Invalid phone format. Use +998XXXXXXXXX':'Telefon formati noto‘g‘ri. +998 va 9 raqam kiriting.','Address must be 5-500 characters':'Manzil 5–500 belgidan iborat bo‘lishi kerak.','Order must contain at least 1 item':'Buyurtmada kamida bitta mahsulot bo‘lishi kerak.','Quantity must be between 1 and 999':'Miqdor 1 dan 999 gacha butun son bo‘lishi kerak.','Order total must be positive':'Buyurtma summasi musbat bo‘lishi kerak.','Validation failed':'Ma’lumotlarni tekshiring.','Failed to fetch':'Tarmoq bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.','Load failed':'Tarmoq bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.'};
 const plural=(n,one,few,many)=>n%10===1&&n%100!==11?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many;
 const ruMoney=s=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(s.replace(/[\s,]/g,'').replace('−','-')));
 function t(source){const mapped=english[normalize(source)]||source;if(lang!=='ru')return mapped;const s=normalize(mapped);if(dict[s])return dict[s];if(s==="Dodola | Online do'kon")return 'Dodola | Интернет-магазин';if(s==='Dodola | Katalog')return 'Dodola | Каталог';
  if(s.includes(' / ')&&s.includes('tanlanmagan'))return s.split(' / ').map(t).join(' / ');
  const count=s.match(/^(\d+) ta (mahsulot|buyurtma|saqlangan manzil)$/);if(count){const n=Number(count[1]);return n+' '+(count[2]==='mahsulot'?plural(n,'товар','товара','товаров'):count[2]==='buyurtma'?plural(n,'заказ','заказа','заказов'):plural(n,'сохранённый адрес','сохранённых адреса','сохранённых адресов'));}
  const patterns=[[/^(\d+) ta mahsulot$/,'$1 товара'],[/^(\d+) ta buyurtma$/,'$1 заказов'],[/^(\d+) ta saqlangan manzil$/,'$1 сохранённых адресов'],[/^(\d+) xil mahsulot tanlandi$/,'Выбрано видов товаров: $1'],[/^Xush kelibsiz, (.+)\.$/,'Добро пожаловать, $1.'],[/^(.+) bo'yicha hech qanday mahsulot topilmadi\.$/,'По запросу $1 ничего не найдено.']];
  for(const [p,r] of patterns)if(p.test(s))return s.replace(p,r);
  if(/^[−+\d\s,.]+ so['‘’]m$/.test(s))return ruMoney(s.replace(/ so['‘’]m$/,''))+' сум';
  const months={yanvar:'января',fevral:'февраля',mart:'марта',aprel:'апреля',may:'мая',iyun:'июня',iyul:'июля',avgust:'августа',sentabr:'сентября',oktabr:'октября',noyabr:'ноября',dekabr:'декабря'};
  if(/\d{1,2}-(yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentabr|oktabr|noyabr|dekabr)/.test(s))return s.replace(/(\d{1,2})-([a-z]+),?\s*(\d{4})/g,(_,d,m,y)=>d+' '+months[m]+' '+y);
  if(/^(\d+) dona$/.test(s))return s.replace('dona','шт.');
  if(/^(\d+)\+? kun ichida$/.test(s))return s.replace('kun ichida','дней');
  if(/^(\d+) ta · yana (\d+) mahsulot$/.test(s))return s.replace(/(\d+) ta · yana (\d+) mahsulot/,(_,qty,n)=>qty+' шт. · ещё '+n+' '+plural(Number(n),'товар','товара','товаров'));
  if(/^(\d+) ta × /.test(s))return s.replace('ta ×','шт. ×').replace(/so'm/,'сум');
  if(/ · Hali ulanmagan$/.test(s))return s.replace('Bank kartasi','Банковская карта').replace('Hali ulanmagan','Ещё не подключено');
  if(/^Promokod uchun kamida (.+) so'mlik xarid kerak\.$/.test(s))return s.replace(/^Promokod uchun kamida (.+) so'mlik xarid kerak\.$/,'Для промокода нужна покупка минимум на $1 сум.');
  if(/^\d+ ta$/.test(s))return s.replace('ta','шт.');
  if(s.startsWith('Chegirma · '))return 'Скидка · '+s.slice(11);
  if(s.startsWith('Jami: '))return 'Итого: '+t(s.slice(6));
  if(s.startsWith("To'lov: "))return 'Оплата: '+t(s.slice(8));
  if(s.startsWith('Buyurtma: '))return 'Заказ: '+t(s.slice(10));
  return source;
 }
 const nodes=new WeakMap(),attrs=new WeakMap(),protectedSelector='script,style,textarea,code,[data-no-i18n],.product__item__text h6,.lx-product-caption strong,.pd-title,#pdTitle,.pd-description,.pd-desc,.order-preview strong,.checkout-item strong,.d-order-item strong,.account-identity,#welcome,.market-cart-title-row h4';
 function textNode(n){if(!n.parentElement||n.parentElement.closest(protectedSelector)||!n.data.trim())return;let record=nodes.get(n);if(!record||n.data!==record.rendered)record={source:n.data};const trimmed=record.source.trim(),translated=t(trimmed);record.rendered=record.source.replace(trimmed,translated);nodes.set(n,record);if(n.data!==record.rendered)n.data=record.rendered;}
 function element(el){if(el.closest(protectedSelector))return;if(el.tagName==='OPTION'&&!el.hasAttribute('value'))el.setAttribute('value',el.value);let records=attrs.get(el)||{};for(const a of ['placeholder','aria-label','title']){const value=el.getAttribute(a);if(value==null)continue;let r=records[a];if(!r||value!==r.rendered)r={source:value};r.rendered=t(r.source);records[a]=r;if(value!==r.rendered)el.setAttribute(a,r.rendered);}attrs.set(el,records);}
 function render(root=document.body){observer?.disconnect();if(root.nodeType===3)textNode(root);else{if(root.nodeType===1)element(root);const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;while(n=walker.nextNode())n.nodeType===3?textNode(n):element(n);}const title=document.querySelector('title')?.firstChild;if(title)textNode(title);document.documentElement.lang=lang;document.querySelectorAll('[data-language-select]').forEach(s=>s.value=lang);observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});}
 let observer=null,queued=false;const pending=new Set();
 function setLanguage(value){lang=value==='ru'?'ru':'uz';try{localStorage.setItem('dodola_language',lang);document.cookie='dodola_language='+lang+'; Path=/; Max-Age=31536000; SameSite=Lax';}catch{}render();document.dispatchEvent(new CustomEvent('dodola:language',{detail:{language:lang}}));}
 function languageControl(compact=false){const label=document.createElement('label');label.className='dodola-language';label.innerHTML='<span class="language-label">Til</span><select data-language-select aria-label="Tilni tanlang"><option value="uz">'+(compact?'UZ':'O‘zbekcha')+'</option><option value="ru">'+(compact?'RU':'Русский')+'</option></select>';label.querySelector('select').value=lang;label.querySelector('select').addEventListener('change',e=>{const next=e.target.value==='ru'?'ru':'uz',changed=next!==lang;setLanguage(next);if(changed&&document.querySelector('#shop-grid,#new-products,#favoritesGrid,#productDetailApp'))location.reload();});return label;}
 function boot(){document.querySelector('.dodola-header__inner')?.append(languageControl(true));document.querySelectorAll('[data-language-slot]').forEach(slot=>slot.append(languageControl()));
  observer=new MutationObserver(records=>{for(const r of records){if(r.type==='childList')r.addedNodes.forEach(n=>pending.add(n));else pending.add(r.target);}if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;const roots=[...pending];pending.clear();roots.filter(n=>n.isConnected).forEach(n=>render(n));});}});setLanguage(lang);
  document.addEventListener('invalid',e=>{const el=e.target;if(!el.validity||!el.setCustomValidity)return;const v=el.validity;el.setCustomValidity(lang==='ru'?(v.valueMissing?'Заполните это поле.':v.typeMismatch?'Введите корректный адрес электронной почты.':v.patternMismatch?'Проверьте формат. Телефон: +998 и 9 цифр.':v.tooShort?'Введите более полное значение.':'Проверьте значение поля.'):(v.valueMissing?'Bu maydonni to‘ldiring.':'Maydon qiymatini tekshiring.'));},true);
  document.addEventListener('input',e=>e.target.setCustomValidity?.(''));document.addEventListener('change',e=>e.target.setCustomValidity?.(''));
 }
 window.DodolaI18n={t,setLanguage,get language(){return lang;},get locale(){return lang==='ru'?'ru-RU':'uz-UZ';},render,languageControl,dict};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
