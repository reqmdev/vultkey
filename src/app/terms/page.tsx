import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Kullanım Koşulları",
  description: "Vultkey beta kullanım koşulları, public link kuralları ve kullanıcı sorumlulukları."
};

const termsSections = [
  {
    title: "1. Kabul ve beta durumu",
    paragraphs: [
      "Vultkey’i kullanarak bu kullanım koşullarını kabul etmiş sayılırsın. Vultkey beta aşamasında olan bir dijital key, kod, lisans, API credential, kupon ve oyun key kasasıdır. Ürün davranışı, veri modeli, public link kuralları, log ekranları ve güvenlik kontrolleri beta sürecinde değişebilir.",
      "Beta etiketi, ürünün kullanılabilir olmadığı anlamına gelmez; ancak kritik production secretları veya yüksek riskli kurumsal credentiallar için kendi güvenlik ve uygunluk değerlendirmeni yapman gerekir. Vultkey, genel amaçlı key yönetimi sağlar; üçüncü taraf lisansların geçerliliğini doğrulamaz."
    ]
  },
  {
    title: "2. Hesap sorumluluğu",
    paragraphs: [
      "Hesabına erişimden, parolanı korumaktan, OAuth hesaplarını güvenli tutmaktan ve oturum açık kalan cihazlarını yönetmekten sen sorumlusun. Hesabında yapılan kasa değişiklikleri, public link oluşturma işlemleri ve claim ayarları senin hesabın üzerinden yürütülür.",
      "Başka bir kişinin hesabına izinsiz erişmeye, public link claim limitlerini aşmaya, rate limitleri zorlamaya veya Vultkey’in güvenlik kontrollerini atlatmaya çalışamazsın. Bu tür davranışlar hesabın veya linklerinin kısıtlanmasına neden olabilir."
    ]
  },
  {
    title: "3. Kasa içeriği",
    paragraphs: [
      "Kasaya yalnızca saklama, yönetme veya dağıtma hakkına sahip olduğun dijital kayıtları eklemelisin. Lisans anahtarları, API anahtarları, oyun keyleri, kupon kodları ve benzeri içeriklerin doğruluğu, kullanım hakkı ve paylaşım sınırları sana aittir.",
      "Vultkey raw key değerlerini şifreleyerek saklamaya çalışır, ancak keyin hukuki durumu, üçüncü taraf servislerde çalışıp çalışmadığı veya paylaşılmasının lisans şartlarına uygunluğu Vultkey tarafından doğrulanmaz."
    ]
  },
  {
    title: "4. Public link kullanımı",
    paragraphs: [
      "Public link oluşturduğunda linkin kimlerle paylaşılacağını, kaç kişinin kod alabileceğini, kişi/cihaz/oturum başına limiti, raw key gösterimini, kopyala butonu görünürlüğünü, liste görünürlüğünü ve son kullanma tarihini sen belirlersin. Raw key gösterimi açıksa alıcının kodu elle kopyalamasını teknik olarak engelleyemeyiz. Linki yanlış kişilerle paylaşman veya raw key görünürlüğünü yanlış ayarlaman senin sorumluluğundadır.",
      "Alıcı tarafında public link yalnızca claim akışını yönetir. Alıcı kodu aldıktan sonra üçüncü taraf platformda kullanıp kullanmadığını Vultkey doğrudan doğrulamaz. Alıcı `Kullandım` onayı verirse bu bir kullanıcı beyanı olarak kaydedilir."
    ]
  },
  {
    title: "5. Vultkey üye whitelist",
    paragraphs: [
      "Link sahibi public linki yalnızca belirli Vultkey üyelerine açabilir. Bu modda linki açan kişinin Vultkey hesabıyla giriş yapması ve link sahibinin whitelist’e eklediği e-posta ile eşleşmesi gerekir.",
      "Üye whitelist güvenliği, giriş yapan Vultkey hesabı, claim geçmişi, cihaz/oturum sinyalleri ve public link ayarları birlikte değerlendirilerek uygulanır. Yine de bu özellik tek başına hukuki kimlik doğrulama, kurumsal SSO veya resmi yetkilendirme sistemi yerine geçmez."
    ]
  },
  {
    title: "6. Claim limitleri ve kötüye kullanım",
    paragraphs: [
      "Claim limitleri e-posta, Vultkey üye hesabı, cihaz çerezi, browser fingerprint, request fingerprint, user-agent hash ve IP hash gibi sinyallerle uygulanabilir. Bu kontroller kötüye kullanımı azaltmak içindir; tüm durumlarda yüzde yüz kimlik doğrulama garantisi vermez.",
      "VPN, farklı cihaz, farklı tarayıcı, gizlilik eklentileri veya hosting headerlarının eksikliği bazı sinyallerin değişmesine veya boş kalmasına neden olabilir. Buna rağmen limitleri atlatmak amacıyla bu sinyalleri manipüle etmeye çalışmak kullanım koşullarına aykırıdır."
    ]
  },
  {
    title: "7. Loglar ve görünürlük",
    paragraphs: [
      "Owner tarafında public claim kayıtları gösterilebilir. Bu kayıtlarda alıcının yazdığı e-posta, alıcı notu, Vultkey üye e-postası, ülke kodu, cihaz tipi, işletim sistemi, tarayıcı, dil, saat dilimi, claim zamanı ve key snapshot bilgileri yer alabilir.",
      "Bu loglar dağıtımı yönetmek, abuse tespit etmek, hangi keyin kime gittiğini görmek ve public link güvenliğini takip etmek için kullanılır. Link alan kişiler, public link üzerinden kod aldıklarında bu bilgilerin link sahibine gösterilebileceğini kabul eder."
    ]
  },
  {
    title: "8. Yasaklı kullanım",
    paragraphs: [
      "Vultkey’i zararlı yazılım dağıtmak, çalıntı credential saklamak, izinsiz lisans veya key paylaşmak, üçüncü tarafların haklarını ihlal etmek, phishing veya dolandırıcılık yapmak, platformu spam veya abuse amacıyla kullanmak için kullanamazsın.",
      "Public linkleri kandırıcı şekilde dağıtmak, alıcıları yanlış yönlendirmek, başka kullanıcıların verilerine erişmeye çalışmak veya Vultkey’in rate limit ve güvenlik kontrollerini aşmaya çalışmak yasaktır."
    ]
  },
  {
    title: "9. Self-host kullanım",
    paragraphs: [
      "Vultkey self-host edilebilir. Kendi ortamında çalıştırdığında Supabase projesi, Upstash Redis, environment variable güvenliği, yedekler, migrationlar, domain, erişim politikaları ve production ayarları tamamen senin sorumluluğundadır.",
      "Self-host kurulumunda `VULTKEY_ENCRYPTION_KEY`, `VULTKEY_HMAC_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ve benzeri gizli değerleri koruman gerekir. Bu anahtarları kaybetmek, değiştirmek veya yanlış yayınlamak veri kaybına ya da güvenlik açığına neden olabilir."
    ]
  },
  {
    title: "10. Hesap silme ve veri kaybı",
    paragraphs: [
      "Hesap silme işlemi uygulama verilerini kaldırmak için tasarlanmıştır. Bu işlem geri alınamayabilir. Key, kategori, tag, public link ve ilgili kayıtların silinmesi sonucunda veriye tekrar erişemeyebilirsin.",
      "Key silindiğinde raw key materyali kaldırılır; ancak public claim geçmişi tekrar alma koruması ve audit bütünlüğü için belirli metadata veya snapshot bilgilerini koruyabilir. Bu davranış raw keyi tekrar üretmek için kullanılmaz."
    ]
  },
  {
    title: "11. Sorumluluk sınırı",
    paragraphs: [
      "Vultkey makul güvenlik pratikleriyle geliştirilir, ancak kesintisiz çalışma, mutlak güvenlik, üçüncü taraf servislerin doğruluğu veya her claim denemesinin eksiksiz engelleneceği garanti edilmez. Ürünü kullanırken kendi yedekleme, erişim kontrolü ve güvenlik süreçlerini sürdürmelisin.",
      "Vultkey’in beta sürümünde yaşanabilecek veri kaybı, yanlış yapılandırma, yanlış paylaşılan public link, üçüncü taraf sağlayıcı kesintisi veya self-host kurulum hatalarından doğan riskleri kullanıcı kendi ortamına göre değerlendirmelidir."
    ]
  },
  {
    title: "12. Değişiklikler",
    paragraphs: [
      "Bu koşullar ürün geliştikçe güncellenebilir. Özellikle public link güvenliği, claim logları, self-host gereksinimleri, hesap silme davranışı ve altyapı sağlayıcıları değiştiğinde metin yenilenebilir.",
      "Vultkey’i kullanmaya devam etmen güncel koşulları kabul ettiğin anlamına gelir. Production veya ekip kullanımı öncesi bu sayfayı ve gizlilik sözleşmesini tekrar kontrol etmen önerilir."
    ]
  }
];

export default function TermsPage() {
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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Kullanım Koşulları</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Bu koşullar Vultkey’i hangi sınırlar içinde kullanabileceğini, public link oluştururken hangi sorumlulukları aldığını ve beta ürünün hangi garantileri vermediğini açıklar. Metin hukuki danışmanlık yerine geçmez; ancak ürünün gerçek davranışını temel alır.
          </p>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden text-sm text-muted-foreground md:block">
            <p className="font-semibold text-foreground/80">İçerik</p>
            <p className="mt-2 leading-6">Beta kullanımı, hesap sorumluluğu, public linkler, üye whitelist, claim limitleri, loglar ve self-host.</p>
          </aside>

          <div className="space-y-9">
            {termsSections.map((section) => (
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
