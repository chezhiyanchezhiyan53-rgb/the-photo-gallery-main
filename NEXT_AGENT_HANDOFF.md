# Continuation notes: The Photo Gallery

Project folder: `C:\Users\chezh\Documents\THE_PHOTO_GALLERY`

## Current state

The V1 implementation is in the Next.js app under `apps/web` and the Express API under `apps/api`. Root `index.html` and `server.js` are a legacy shell; use the Next.js app for development at port 4173. The supplied folder is not a Git repository and has no remote configured, so changes are saved locally in this folder; there is nothing to push until the owner initializes/configures Git.

Most recent production builds succeeded:

- `apps/web`: `npm run build` succeeded. Routes include public info pages, photographer directory, auth/recovery, dashboard, projects, clients, admin, and customer quote/invoice/gallery pages.
- `apps/api`: `npm run build` succeeded.

## V1 implementation in the folder

- Studio auth/workspace onboarding, approval gate, public directory/profile, appointment requests, and atomic, retry-safe conversion of accepted appointment requests into projects.
- First-login dashboard workspace setup; approval and suspension status are visible after studio creation.
- Public portfolio gallery with studio-selected images, required publication consent, and a separation rule that keeps items already attached to private customer galleries out of the public feed.
- Client and project create/list/detail/edit; role checks based on OWNER/ADMIN/PHOTOGRAPHER/EDITOR/ACCOUNTANT/SUPER_ADMIN.
- Multi-item quotation and invoice creation with unit price/quantity, discounts/tax; quotation expiry; customer links, acceptance, payment orders and paid-state refresh.
- Razorpay webhook signature verification, captured/failed payment reconciliation, partial/full refunds.
- Direct browser-to-R2 multipart uploads for originals/derivatives; Stream TUS for video under 30 GB; larger video originals use R2 multipart and are playable/downloadable after payment. Upload sessions support resume/pause/retry/cancel and storage reservations.
- Private galleries, signed photo/video access, payment-gated originals/downloads, gallery registration invitations through Supabase Auth.
- Admin studio approvals, aggregate platform overview, recent customers/projects/payments/subscriptions, API/database-query status, account suspension, and storage quota controls.
- Expired upload cleanup API protected by `STORAGE_CLEANUP_SECRET`.

SQL migrations are in `apps/api/supabase/migrations/` and must run in order:

1. `001_platform.sql`
2. `002_customer_workflow.sql`
3. `003_payment_webhook.sql`
4. `004_advance_receipts.sql`
5. `005_invoice_links.sql`
6. `006_v1_dashboard.sql`
7. `007_payment_refunds.sql`
8. `008_booking_conversion.sql`
9. `009_public_portfolio.sql`

Read `README.md` for startup, migrations, Supabase redirect/email settings, R2/Stream, Razorpay, platform admin, and storage cleanup setup.

## Still requires provider access before it can run end-to-end

No Supabase, Cloudflare R2, Cloudflare Stream, Razorpay, mail, or hosting credentials are present. Create `apps/web/.env.local` and `apps/api/.env` from examples and enter credentials locally. Keep service-role and provider secrets out of browser variables and chat. The app has not been deployed or connected to client accounts. Production behavior cannot be confirmed until external services are configured.

## Next practical actions

1. Configure a test Supabase project and run all seven migrations in order.
2. Configure the web/API environments; add the exact deployed URL to Supabase Auth redirects and configure invitation email.
3. Configure private R2 CORS, Cloudflare Stream, and Razorpay test keys plus capture/failure/refund webhooks.
4. Add the initial platform admin through README's SQL instructions.
5. Schedule `POST /api/internal/storage/cleanup`, supplying `x-storage-cleanup-secret`.
6. Start the API and web app; validate studio registration/approval, client booking, quotation, invitation, uploads, gallery, payments/refunds, and download unlock in test mode.
7. Configure hosting, monitoring, backups, retention/lifecycle rules, transactional receipts, and deployment security review before launch.

## Scope/limitations to keep visible

- Supabase sends gallery invitations only when Auth email delivery is configured. If the email already has an Auth account or invite sending fails, the UI provides the private gallery link as a fallback.
- Large R2 videos do not have a generated low-resolution preview; playback is available after payment. Add background transcoding if clients need previews before final payment.
- Upload expiration cleanup only runs when an external scheduler calls the protected endpoint.
- Admin health shows API response and successful database queries; it does not yet monitor Cloudflare/Razorpay availability.
- A successful compile does not verify database queries, SQL migrations, auth email templates, storage CORS, or live payment behavior. Run the full provider sandbox flow before launch.
- Confirm actual client media sizes, account limits, storage/bandwidth costs and retention requirements before bulk import.
- No Git history/remote is configured. Do not report a remote push; the files are saved to the provided local folder.

Continue from these files in the same folder. If the original requirements DOCX is accessible, compare each client requirement to the implementation, keep V1 scope first, and report provider-dependent blockers honestly. No price or delivery estimate was given by the client.




