# Vultkey SEO ve Yayın Kontrol Listesi

Bu belge, Vultkey'in arama motorlarında doğru görünmesi ve Search Console kurulumunun sorunsuz ilerlemesi için takip edilecek pratik adımları toplar. Amaç sahte aktivite üretmek değil; küçük ama gerçek, doğrulanabilir ve sürdürülebilir SEO işleri yapmaktır.

## Yayın Öncesi Teknik Kontroller

- `public/robots.txt` dosyası canlı sitede `https://vultkey.vercel.app/robots.txt` adresinden açılmalı.
- `public/sitemap.xml` dosyası canlı sitede `https://vultkey.vercel.app/sitemap.xml` adresinden açılmalı.
- Google doğrulama dosyası canlı sitede `https://vultkey.vercel.app/google9300d3df9e5b7d46.html` adresinden düz metin olarak görünmeli.
- Vercel production deployment commit'i, bu dosyaları içeren son commit ile aynı olmalı.
- Search Console'da `https://vultkey.vercel.app/` için URL prefix mülkü kullanılmalı; `vercel.app` DNS'i yönetilemediği için domain property doğrulaması tercih edilmemeli.

## Search Console Adımları

1. Search Console'da `https://vultkey.vercel.app/` URL prefix mülkünü aç.
2. HTML dosyası doğrulama yöntemiyle mülk sahipliğini doğrula.
3. `https://vultkey.vercel.app/sitemap.xml` sitemap adresini gönder.
4. Ana sayfa için URL Denetimi ekranından indexleme isteği gönder.
5. Kapsam, sayfa deneyimi ve tarama hatalarını ilk hafta günlük kontrol et.

## İçerik ve Sayfa Planı

Vultkey'in sadece ana sayfayla görünürlük kazanması zor olabilir. Aşağıdaki sayfalar gerçek kullanım niyetlerine göre ayrı ayrı hazırlanmalıdır:

- Oyun keylerini düzenli saklama ve paylaşma
- Yazılım lisans anahtarı takibi
- Dijital ürün key kasası
- Ekip içi lisans ve erişim kodu dağıtımı
- Açık kaynak ve self-host edilebilir key yönetimi

Her sayfada tek bir ana niyet hedeflenmeli; başlık, açıklama, H1 ve ilk paragraf bu niyeti doğal şekilde anlatmalıdır. Abartılı pazarlama dili yerine Vultkey'in beta durumunu, açık kaynak yaklaşımını ve kontrollü paylaşım akışını net anlatmak daha güvenilir olur.

## Düzenli Bakım

- Yeni public sayfa eklendiğinde `public/sitemap.xml` güncellenmeli.
- Private alanlar (`/dashboard`, `/api`, `/auth`, `/k`) indexlenmemeye devam etmeli.
- Vercel Speed Insights ve Search Console verileri haftalık kontrol edilmeli.
- Google'da görünmeye başlayan sorgulara göre ana sayfa ve kullanım senaryosu sayfalarının metinleri iyileştirilmeli.
