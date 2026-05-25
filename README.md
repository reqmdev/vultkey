# Vultkey

Vultkey is an open-source product developed to consolidate digital keys, license codes, API keys, coupons, gift cards, and game codes into a single secure vault.

Instead of scattered notes, spreadsheets, message histories, and sharing links, it offers an organized workspace where you can track where each entry is located, its status, and who it was sent to.

## What Does It Do?

Vultkey is designed specifically for individuals and teams managing digital products, game keys, licenses, promo codes, or access credentials. The goal is not just to store keys, but to keep the key’s lifecycle under control.

- Centralizes keys and codes in a single vault.
- Organizes records by category, tag, platform, status, and expiration date.
- Tracks ready, reserved, used, and archived records separately.
- Creates controlled public links for sharing individual keys or lists.
- Enables tracking of which record was requested and when after sharing.
- Maintains audit logs for account, sharing, and critical operations.

## Security Approach

Vultkey is designed not to store sensitive keys and code materials in plain text. Sensitive content added to the vault is encrypted; for verification, comparison, and public link flows, secure hash and fingerprint mechanisms are preferred over using raw values directly.

This approach ensures that Vultkey is not merely a listing tool, but a vault specifically designed to securely store and distribute confidential digital assets.

## Open Source

Vultkey is open source. Its encryption approach, data model, public link logic, access controls, and claim limits are available for anyone to review.

Source code:

https://github.com/reqmdev/vultkey

## Use Cases

- Securely storing game keys and licenses.
- Tracking key distribution for campaigns, giveaways, or customer deliveries.
- Managing API keys, coupons, and digital access codes in one place.
- Share codes via one-time or limited-access public links.
- Use a self-hostable, auditable, and open-source digital key vault.

## Status

Vultkey is in the beta phase. The product focuses on secure storage, organized inventory, controlled sharing, and open-source auditability.
