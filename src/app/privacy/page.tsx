import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Gizlilik Sözleşmesi",
  description: "Vultkey gizlilik sözleşmesi, saklanan veriler, public link claim kayıtları ve güvenlik notları."
};

const privacySections = [
  {
    title: "1. Kapsam",
    paragraphs: [
      "Bu gizlilik sözleşmesi Vultkey beta uygulamasında hesap oluşturduğunda, kasana key veya kod eklediğinde, public link oluşturduğunda ya da public link üzerinden kod aldığında hangi verilerin işlendiğini açıklar. Vultkey, dijital key, lisans, API anahtarı, kupon, oyun kodu ve benzeri kayıtları düzenlemek ve gerektiğinde kontrollü şekilde paylaşmak için tasarlanmıştır.",
      "Vultkey beta aşamasındadır. Bu nedenle güvenlik, claim limitleri, log ekranları ve veri modeli zaman içinde değişebilir. Değişiklikler özellikle public link güvenliği, hesap silme ve self-host kullanımını daha net hale getirmek için yapılabilir."
    ]
  },
  {
    title: "2. Hesap ve kimlik verileri",
    paragraphs: [
      "Hesap açtığında e-posta adresin, Supabase Auth tarafından yönetilen oturum bilgilerin ve profil kaydın tutulur. E-posta adresi giriş yapmak, hesap sahibini ayırt etmek, üye whitelist kurallarını uygulamak ve hesap ayarlarını göstermek için kullanılır.",
      "Google veya Discord gibi OAuth sağlayıcıları etkinse, bu sağlayıcılardan dönen temel hesap bilgileri Supabase oturumu oluşturmak için kullanılabilir. Vultkey bu sağlayıcıların kendi gizlilik uygulamalarını yönetmez."
    ]
  },
  {
    title: "3. Kasa verileri",
    paragraphs: [
      "Kasaya eklediğin başlık, platform, kategori, etiket, kaynak, not, durum, son kullanım tarihi ve benzeri metadatalar uygulamanın çalışması için saklanır. Bu bilgiler sana listeleme, filtreleme, arşivleme, audit kaydı ve public link oluşturma özelliklerini sunmak için kullanılır.",
      "Raw key veya kod değeri doğrudan açık metin olarak saklanmaz. Key materyali server tarafında AES-GCM ile şifrelenir. Aynı keyin tekrar eklenmesini anlamak için normalize edilmiş değerden HMAC-SHA256 fingerprint üretilir. Bu fingerprint raw keyi geri üretmek için kullanılmaz, duplicate kontrolü ve güvenlik amacıyla tutulur."
    ]
  },
  {
    title: "4. Public linkler ve alıcı bilgileri",
    paragraphs: [
      "Bir public link oluşturduğunda link tipi, hedef key veya kategori, maksimum alma limiti, kişi/cihaz/oturum başına limit, görünür alanlar, raw key gösterme izni, kopyala butonu görünürlüğü ve son kullanma tarihi gibi ayarlar saklanır. Public link tokenı arama için HMAC hash olarak tutulur; owner linki tekrar kopyalayabilsin diye token materyali ayrıca şifrelenmiş şekilde saklanır.",
      "Alıcı public link üzerinden kod aldığında claim kaydı oluşur. Alıcı e-posta veya not yazdıysa bu bilgiler claim kaydında tutulur. Link Vultkey üye whitelist modundaysa, alıcının giriş yaptığı Vultkey hesabının e-postası link sahibine gösterilebilir. Link sahibi raw key gösterimini kapattıysa alıcıya raw key gösterilmez; açıksa raw key yalnızca claim sonrası aktif oturumda gösterilir."
    ]
  },
  {
    title: "5. Cihaz, oturum ve tekrar alma koruması",
    paragraphs: [
      "Aynı bağlantıdan tekrar kod alınmasını azaltmak için server-set cihaz çerezi, browser fingerprint, request header fingerprint, user-agent hash, IP hash ve varsa Vultkey üye hesabı birlikte değerlendirilir. Bu sinyaller claim limitlerini uygulamak ve kötüye kullanımı azaltmak için kullanılır.",
      "Raw IP adresi, raw user-agent fingerprinti veya ham browser fingerprint değeri claim geçmişinde açık metin olarak saklanmaz. Bu sinyaller HMAC hash değerlerine dönüştürülür ve karşılaştırma amacıyla tutulur. Buna rağmen cihaz/oturum sinyalleri mutlak kimlik doğrulama değildir; VPN, tarayıcı ayarları, farklı cihazlar veya hosting ortamı sonucu etkileyebilir."
    ]
  },
  {
    title: "6. Claim loglarında görünen ortam bilgileri",
    paragraphs: [
      "Link sahibi, public linkten kod alan kişileri audit ekranında görebilir. Bu ekranda key başlığı, platform, maske snapshotı, claim zamanı, kullanım onay zamanı, alıcının yazdığı e-posta, alıcı notu, Vultkey üye e-postası, ülke kodu, cihaz tipi, işletim sistemi, tarayıcı, dil ve saat dilimi gibi bilgiler gösterilebilir.",
      "Ülke bilgisi production ortamında hosting sağlayıcısının gönderdiği geo headerlara bağlıdır. Local geliştirme ortamında veya geo header göndermeyen altyapılarda boş kalabilir. VPN kullanıldığında görünen ülke gerçek konum yerine VPN çıkış konumu olabilir. Tarayıcı ve işletim sistemi bilgileri browserın sağladığı user-agent ve client hint sinyallerine göre yorumlanır; örneğin bazı Windows 11 cihazları uyumluluk nedeniyle Windows 10/11 olarak görünebilir."
    ]
  },
  {
    title: "7. Çerezler ve local storage",
    paragraphs: [
      "Vultkey oturum yönetimi için Supabase çerezlerini kullanır. Public claim tekrar alma koruması için ayrıca httpOnly bir cihaz çerezi kullanılabilir. Bu çerez raw key içermez; aynı linkte aynı cihaz veya oturumu tanımaya yardımcı olan rastgele bir değerin hashlenmiş kullanımına dayanır.",
      "Public claim sayfası sessionStorage içinde raw kod saklamaz. Aynı tarayıcı oturumunda yalnızca claim metadata tutulabilir; alıcı raw kodu kopyalamadan sayfayı kapatırsa ve owner tekrar gösterimi kapattıysa raw kod tekrar gösterilmeyebilir."
    ]
  },
  {
    title: "8. Audit kayıtları",
    paragraphs: [
      "Kod oluşturma, güncelleme, silme, gösterme, kopyalama, public link oluşturma, public claim, public redeem, oturum açma ve benzeri önemli işlemler audit kaydı oluşturabilir. Audit kayıtları owner tarafında görünürlük, hata analizi ve güvenlik takibi için kullanılır.",
      "Audit metadata içinde raw key, token, secret, password gibi hassas alanlar yazılmamaya çalışılır. Buna rağmen kullanıcıların not ve başlık alanlarına hassas veri koymaması gerekir; bu alanlar uygulama işlevleri için metin olarak saklanabilir ve owner ekranlarında görünebilir."
    ]
  },
  {
    title: "9. Altyapı sağlayıcıları",
    paragraphs: [
      "Vultkey kimlik doğrulama ve veritabanı için Supabase kullanır. Rate limit ve kısa süreli abuse koruması için Upstash Redis kullanılabilir. Production kurulumunda gizli anahtarlar yalnızca server-side ortam değişkenlerinde tutulmalıdır ve hiçbir gizli anahtar `NEXT_PUBLIC_` prefixiyle yayınlanmamalıdır.",
      "Self-host kurulumlarında Supabase, Upstash, hosting sağlayıcısı, domain, yedekleme, log saklama ve erişim politikaları kurulumu yapan kişinin sorumluluğundadır. Vultkey açık kaynak kodunu sağlayabilir, ancak self-host ortamındaki verinin nasıl işlendiği o ortamın sahibine bağlıdır."
    ]
  },
  {
    title: "10. Saklama, silme ve hesap kapatma",
    paragraphs: [
      "Kasa kayıtları ve claim geçmişi uygulama özellikleri için saklanır. Public claim geçmişi, key sonradan silinse bile tekrar alma korumasının çalışabilmesi için korunabilir; bu durumda silinen keyin raw değeri değil, claim geçmişi ve snapshot metadata kalabilir.",
      "Hesap silme işlemi uygulama verilerini kaldırmak için tasarlanmıştır. Bazı güvenlik, audit veya altyapı kayıtları teknik olarak kısa süre daha kalabilir. Self-host kullanıyorsan yedekler, migration geçmişi ve veritabanı retention politikaları senin ortamında ayrıca yönetilmelidir."
    ]
  },
  {
    title: "11. Güvenlik sınırları",
    paragraphs: [
      "Vultkey raw keyleri açık metin olarak saklamamaya, public linklerde claim limitlerini sıkı uygulamaya ve hassas işlemleri server tarafında yürütmeye odaklanır. Yine de beta bir ürün olduğu için kritik şirket sırları, yüksek değerli production credentialları veya regülasyon gerektiren veriler için kendi risk değerlendirmeni yapman gerekir.",
      "Güçlü parola kullanmak, OAuth hesaplarını korumak, public linkleri doğru kişilerle paylaşmak, raw key görünürlüğünü dikkatli ayarlamak ve self-host ortamındaki environment variable güvenliğini sağlamak kullanıcı sorumluluğundadır."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background/88">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo href="/" />
          <div className="flex items-center gap-2">
            <ThemeToggle className="size-9 border border-border bg-background/70" />
            <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background/70 px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft className="size-4" />
              Ana sayfa
            </Link>
          </div>
        </div>
      </header>

      <article className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 md:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-muted-foreground">Son güncelleme: 24 Mayıs 2026</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Gizlilik Sözleşmesi</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Bu metin Vultkey’in hangi verileri neden sakladığını, public link claim akışında hangi sinyallerin kullanıldığını ve link sahibinin hangi kayıtları görebileceğini açıklar. Metin sade tutulmuştur; amaç kullanıcıya ürünün gerçek davranışını net anlatmaktır.
          </p>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden text-sm text-muted-foreground md:block">
            <p className="font-semibold text-foreground/80">İçerik</p>
            <p className="mt-2 leading-6">Hesap, kasa, public link, claim logları, çerezler, altyapı, silme ve güvenlik sınırları.</p>
          </aside>

          <div className="space-y-9">
            {privacySections.map((section) => (
              <section key={section.title} className="max-w-3xl">
                <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground md:text-[15px]">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
