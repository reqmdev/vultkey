# Vultkey

Vultkey, dijital keyleri, lisans kodlarını, API anahtarlarını, kuponları, hediye kartlarını ve oyun kodlarını tek bir güvenli kasada toplamak için geliştirilmiş açık kaynaklı bir üründür.

Dağınık notlar, tablolar, mesaj geçmişleri ve paylaşım linkleri yerine, her kaydın nerede durduğunu, hangi durumda olduğunu ve kime gönderildiğini takip edebileceğin düzenli bir çalışma alanı sunar.

## Ne İşe Yarar?

Vultkey, özellikle dijital ürün, oyun keyi, lisans, kampanya kodu veya erişim bilgisi yöneten kişiler ve ekipler için tasarlanmıştır. Amaç sadece key saklamak değil, keyin yaşam döngüsünü kontrol altında tutmaktır.

- Keyleri ve kodları merkezi bir kasada toplar.
- Kayıtları kategori, etiket, platform, durum ve son kullanım tarihiyle düzenler.
- Hazır, ayrılmış, kullanılmış ve arşivlenmiş kayıtları ayrı takip eder.
- Tekil key veya liste paylaşımı için kontrollü public linkler oluşturur.
- Paylaşım sonrasında hangi kaydın ne zaman talep edildiğini izlenebilir hale getirir.
- Hesap, paylaşım ve kritik işlemler için audit kayıtları tutar.

## Güvenlik Yaklaşımı

Vultkey, hassas key ve kod materyalini düz metin olarak saklamamak üzere tasarlanmıştır. Kasaya eklenen hassas içerikler şifrelenir; doğrulama, karşılaştırma ve public link akışlarında ise ham değerleri doğrudan kullanmak yerine güvenli hash ve fingerprint mekanizmaları tercih edilir.

Bu yaklaşım, Vultkey'in yalnızca bir listeleme aracı değil, gizli dijital varlıkları kontrollü şekilde saklamak ve dağıtmak için hazırlanmış bir kasa olmasını sağlar.

## Açık Kaynak

Vultkey açık kaynaklıdır. Şifreleme yaklaşımı, veri modeli, public link mantığı, erişim kontrolleri ve claim limitleri herkes tarafından incelenebilir.

Kaynak kod:

https://github.com/reqmdev/vultkey

## Kullanım Senaryoları

- Oyun keylerini ve lisansları düzenli saklamak.
- Kampanya, çekiliş veya müşteri teslimlerinde key dağıtımını takip etmek.
- API anahtarları, kuponlar ve dijital erişim kodlarını tek yerde yönetmek.
- Tek kullanımlık veya sınırlı erişimli public linklerle kod paylaşmak.
- Self-host edilebilir, denetlenebilir ve açık kaynaklı bir dijital key kasası kullanmak.


## Durum

Vultkey beta aşamasındadır. Ürün; güvenli saklama, düzenli envanter, kontrollü paylaşım ve açık kaynak denetlenebilirlik üzerine odaklanır.
