const baseUrl = (process.env.SMOKE_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

if (!baseUrl) {
  console.error("SMOKE_BASE_URL or NEXT_PUBLIC_APP_URL is required.");
  process.exit(1);
}

const failures = [];
const paths = ["/", "/login", "/privacy"];

function expectHeader(response, name, expected) {
  const value = response.headers.get(name);
  if (!value) {
    failures.push(`${name} missing on ${response.url}`);
    return;
  }

  if (expected && !value.toLowerCase().includes(expected.toLowerCase())) {
    failures.push(`${name} on ${response.url} does not include ${expected}`);
  }
}

for (const path of paths) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  if (response.status >= 500) failures.push(`${path} returned ${response.status}`);

  expectHeader(response, "content-security-policy", "default-src 'self'");
  expectHeader(response, "x-frame-options", "DENY");
  expectHeader(response, "x-content-type-options", "nosniff");
  expectHeader(response, "referrer-policy", "strict-origin-when-cross-origin");
}

if (failures.length > 0) {
  console.error("Smoke check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Smoke check passed for ${baseUrl}.`);
