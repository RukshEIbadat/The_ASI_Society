# asisociety.org: deploy with the Send button

The `site` folder is the website. `src/worker.js` receives the form and emails each request to both inboxes.

## 1. One-time setup in Cloudflare (about 5 minutes)

1. Open **Compute > Email Service > Email Routing**, choose **asisociety.org** and enable Email Routing. Accept the DNS records it offers to add.
2. Under **Destination Addresses**, add `ruksh.e.ibadat@gmail.com` and `ruksh.e.ibadat@icloud.com`. Cloudflare emails each inbox. Open both emails and press **Verify email address**.
3. Under **Routing Rules**, create a rule: `join` @ asisociety.org, action **Send to an email**, destination your Gmail. The form sends from `join@asisociety.org`, and this makes it a real address.

## 2. Deploy from Terminal

```
cd ~/Downloads/asisociety-worker
npx wrangler@latest login
npx wrangler@latest deploy
```

- If Wrangler says the Worker was last changed in the dashboard, answer `y`.
- It updates the existing Worker `bold-bonus-e3a5`, keeps asisociety.org attached and adds www.asisociety.org.

## 3. Check

- Open https://asisociety.org/api/health. It should show `{"ok":true,"email":true}`.
- Send a test request from the form. It should arrive in both inboxes within a minute.

## Later updates

Edit files in `site/`, then run `npx wrangler@latest deploy` again.
After this first Terminal deploy, do not upload the folder through the dashboard: that replaces the Worker and removes the Send button.

## If a request cannot be sent

The visitor is shown WhatsApp and email buttons instead, so nothing is lost.
To see why it failed, open **Workers & Pages > bold-bonus-e3a5 > Observability**. The log shows the mail error code.
An address that is not verified yet is the usual cause.
