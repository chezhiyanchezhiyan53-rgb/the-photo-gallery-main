# The Photo Gallery

Studio workspace for client projects, quotations, invoices, payments and private media delivery. The web app is in `apps/web`; the Express API and ordered Supabase migrations are in `apps/api`.

## Run the application

Use Node.js 22 or newer. Copy the two example environment files and fill in the values for your own provider accounts. Keep every secret in the API environment; only the Supabase public key belongs in the web environment.

```powershell
Copy-Item apps/web/.env.local.example apps/web/.env.local
Copy-Item apps/api/.env.example apps/api/.env
```

Run each command in a separate terminal:

```powershell
cd apps/api
npm run dev
```

```powershell
cd apps/web
npm run dev -- --port 4173
```

Open `http://localhost:4173`. Sign-up, sign-in, password recovery, workspace setup, and public client links require valid Supabase settings. Uploads use a private S3-compatible object store. Local development can use SeaweedFS without a cloud billing account; production Cloudflare Stream is optional for managed video transcoding and playback. Online checkout and payment reconciliation require Razorpay test credentials and a reachable webhook endpoint.

## Included V1 areas

- Public landing, photographer directory, enquiry form, and a public gallery built from studio-selected portfolio previews.
- Studio registration, authentication, approval, public profile, projects, client records, and project detail pages.
- Quotations with line items, discount, tax, terms, a private customer link, and customer acceptance.
- Invoices with line items and payment links; payment orders for quotation advances and invoice/gallery balances.
- Razorpay webhook signature verification, captured/failed payment reconciliation, and partial/full refund reconciliation.
- Direct browser-to-R2 multipart uploads for photo/file originals and previews; resumable TUS video uploads to Stream for videos under 30 GB, and multipart R2 archival storage for larger source videos. App servers do not proxy the media bytes.
- Private gallery links, signed image previews, protected video playback, and payment-gated originals/downloads.
- Studio storage usage and quota reservations, plus platform admin platform overview, studio/customer/project/payment/subscription visibility, studio review, account status, and quota controls.
- Basic studio storage plan (5 GiB for ₹499/month), usage and remaining-space indicators, Razorpay-verified one-time storage add-ons, and Super Admin plan/storage/payment visibility.
- Tenant scoping on authenticated API requests, role checks for studio write actions, Supabase row-level security, and audit records for admin/gallery actions.

## Supabase setup

Run these files in order in the Supabase SQL editor or migration tool:

1. `apps/api/supabase/migrations/001_platform.sql`
2. `apps/api/supabase/migrations/002_customer_workflow.sql`
3. `apps/api/supabase/migrations/003_payment_webhook.sql`
4. `apps/api/supabase/migrations/004_advance_receipts.sql`
5. `apps/api/supabase/migrations/005_invoice_links.sql`
6. `apps/api/supabase/migrations/006_v1_dashboard.sql`
7. `apps/api/supabase/migrations/007_payment_refunds.sql`
8. `apps/api/supabase/migrations/008_booking_conversion.sql`
9. `apps/api/supabase/migrations/009_public_portfolio.sql`
10. `apps/api/supabase/migrations/010_customer_accounts.sql`
11. `apps/api/supabase/migrations/011_storage_billing.sql`


Create and confirm the first platform administrator with Supabase Auth, then insert that user's UUID into `public.platform_admins`. Do not make the service role key available to browser code.

## Public portfolio gallery

Customers can create accounts at `/customer/signup`, sign in at `/customer/login`, request appointments from the directory, and see matching projects, quotations, payment status and private galleries at `/customer`. Apply migration 010 for account-linked bookings and gallery access.

Photographers can manage public samples from Dashboard → Portfolio after applying migration 009. Only approved, active studios with a published profile appear. Owners and admins select images, confirm permission to display them publicly, and can remove them later. The public feed returns short-lived links to preview or thumbnail objects only; originals remain in private storage.

To prepare sample work, create a separate studio portfolio project, upload cleared photographs through Storage, and leave those items out of private customer galleries. Media already attached to a client gallery is excluded from the public portfolio.

## Local media storage for development

The local environment files are configured for SeaweedFS at `http://127.0.0.1:8333` and set `VIDEO_UPLOAD_MODE=object-storage`. This keeps uploads inside the existing multipart S3 flow and does not require Cloudflare billing details. Photos, previews, thumbnails, and videos are stored on the development machine under `data/seaweedfs`.

1. Download the `weed.exe` Windows binary from the [SeaweedFS releases](https://github.com/seaweedfs/seaweedfs/releases) and place it at `data/seaweedfs/bin/weed.exe`.
2. Open a PowerShell terminal in the project root and start the local storage server:

```powershell
$env:AWS_ACCESS_KEY_ID = "gallerydevaccesskey01"
$env:AWS_SECRET_ACCESS_KEY = "local-only-gallery-storage-dev-secret-2026"
$env:S3_BUCKET = "photo-gallery-dev"
 .\data\seaweedfs\bin\weed.exe mini -ip=127.0.0.1 -ip.bind=127.0.0.1 -dir=.\data\seaweedfs -s3.allowedOrigins="http://localhost:4173,http://127.0.0.1:4173"
```

3. Keep that terminal running. Start the API and web app in their usual terminals. The API's `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`, and `VIDEO_UPLOAD_MODE` settings are in `apps/api/.env`; the web mode is `NEXT_PUBLIC_VIDEO_UPLOAD_MODE` in `apps/web/.env.local`.

SeaweedFS data is local and is not backed up or available to a deployed website. Keep development data separate from client production data. The current default studio quota is 100 GiB; raise it in the platform admin only when the local disk has enough free space. The upload code accepts files up to approximately 5 TiB, but that is a protocol limit, not a promise that the computer has that capacity.

Object-storage video playback uses the browser's native video player rather than Stream's transcoded adaptive player. Use a browser-compatible MP4 (H.264/AAC) for playback checks. The original video remains available for download when project payment rules allow it.

## Deploying the app on Render

This repo includes a `render.yaml` Blueprint for two paid Node web services in Singapore: the Next.js site and the Express API. The app and API run on Render; client media remains in the client-owned R2 and Stream accounts. Do not point a Render production service at `127.0.0.1` or the local SeaweedFS directory.

1. Push this project to a Git repository you control, connect that repository to Render, and create a new Blueprint from `render.yaml`.
2. Enter the prompted Supabase, R2, Stream, and Razorpay values from the client's own service accounts. The Blueprint does not contain those secrets. Keep `VIDEO_UPLOAD_MODE=stream` in both services for production.
3. After the services are created, confirm their actual `onrender.com` URLs. If Render assigned different hostnames, update the API service's `WEB_ORIGIN` and the web service's `NEXT_PUBLIC_API_URL`, then redeploy.
4. Apply Supabase migrations `001` through `010` to the client's Supabase project. Set the Supabase Auth Site URL and redirect allowlist to the web service URL.
5. Set the Razorpay webhook URL to `https://<api-service-host>/api/webhooks/razorpay` and enter the test or live webhook secret in the API service.
6. Confirm the API health check at `/api/health`, then verify sign-up, studio approval, a small photo upload, a video upload, a private gallery, and a test payment before inviting customers.

The API signs direct browser uploads and does not proxy media through Render. For roughly 1 TB, Render persistent disk storage alone would be about $250/month at current published disk rates, while still being tied to one service instance. Use the client's object-storage account for media; Render's disk is not the gallery storage plan.
## Production media storage

For production, configure a client-owned S3-compatible object storage account in `apps/api/.env`, use `OBJECT_STORAGE_ENDPOINT` and `OBJECT_STORAGE_REGION` for its endpoint and signing region, and set `VIDEO_UPLOAD_MODE=stream` in both API and web environments to enable Cloudflare Stream for videos under 30 GB. Videos at or above that threshold use multipart object storage. Configure the object bucket for the deployed web origin, allow browser `PUT`, `GET`, and `HEAD`, and expose `ETag` for multipart completion. Add provider lifecycle, backup, retention, and deletion policies before accepting client media.

- Upload sessions expire after 24 hours. Set a scheduler to call `POST /api/internal/storage/cleanup` periodically with the `x-storage-cleanup-secret` header, using the `STORAGE_CLEANUP_SECRET` value from the API environment. The cleanup request aborts abandoned provider sessions and releases the corresponding reservation. Keep that value private.
- Studio owners can see used and reserved space; platform admins can raise or lower each studio's quota. Photo previews and thumbnails count as separate stored objects.
- Videos using Stream are automatically processed. Videos stored as ordinary objects receive no server-side transcoding; large video playback requires a browser-compatible original or an added media-processing service.
## Payments

Start in Razorpay test mode. Configure the API key ID and secret in the API environment, then point the Razorpay webhook to `https://<api-host>/api/webhooks/razorpay`. Subscribe to `payment.captured`, `order.paid`, `payment.failed`, and `refund.processed`, and set the matching webhook secret. The browser return from checkout is not treated as proof of payment; only a valid webhook changes captured balances. Test duplicate webhook delivery and partial/full refunds before using live mode.

## Platform admin

Create the initial admin account through Supabase Auth. After confirming it, add its Auth user UUID to `public.platform_admins` using the SQL editor:

```sql
insert into public.platform_admins(user_id)
select id from auth.users where email = 'admin@example.com'
on conflict (user_id) do nothing;
```

Open `/admin` to review pending studios, check storage usage, update quotas, and suspend or reactivate approved accounts.

## Configuration still needed before a live launch

This folder contains implementation code, not deployed infrastructure. It has not been connected to the client's Supabase, Cloudflare, Razorpay, email, or production hosting accounts. Set those credentials locally, apply the migrations, configure bucket CORS and webhooks, and verify the full customer payment/gallery flow in test mode before production.

Enable Supabase Auth invitation emails and allowlist the exact redirect URL `http://localhost:4173/gallery/**` in development and the deployed gallery URL in production; scheduled cleanup hosting, monitoring/alerting, operational backups, domain/TLS setup, and a deployment security review need to be configured for the selected providers. Milestone automation, WhatsApp, advanced analytics, contracts, CRM/expenses, and native mobile features are outside the initial V1 scope described in the requirements.










