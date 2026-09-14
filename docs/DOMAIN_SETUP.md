# GoDaddy Domain DNS Configuration Guide for pvsairamsaketh.in

This guide explains how to configure DNS records in your **GoDaddy** account for the domain **`pvsairamsaketh.in`** and **`www.pvsairamsaketh.in`**.

---

## 1. Domain Details

- **Domain**: `pvsairamsaketh.in`
- **GoDaddy Account Email**: `pvsairamsaketh@gmail.com`
- **Primary Website**: `https://pvsairamsaketh.in`
- **Secondary Subdomain**: `https://www.pvsairamsaketh.in` (Redirects to primary apex domain)
- **Hosting Target**: GitHub Pages (Download & Showcase Website) & Azure VM (Live API / Web App Instance)

---

## 2. GoDaddy DNS Configuration (GitHub Pages Portal Hosting)

To point `pvsairamsaketh.in` to the download portal hosted via GitHub Pages:

### Step 1: Log in to GoDaddy
1. Go to [GoDaddy Domain Portfolio](https://dcc.godaddy.com/control/portfolio).
2. Sign in with **`pvsairamsaketh@gmail.com`**.
3. Select your domain: **`pvsairamsaketh.in`**.
4. Click on **DNS** or **Manage DNS**.

### Step 2: Configure Apex Domain A-Records (`@`)
Delete any existing placeholder/parked `A` records for `@` and add the 4 official GitHub Pages IPv4 addresses:

| Type | Name / Host | Value / Target IP | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `185.199.108.153` | 1/2 Hour (or default) |
| **A** | `@` | `185.199.109.153` | 1/2 Hour (or default) |
| **A** | `@` | `185.199.110.153` | 1/2 Hour (or default) |
| **A** | `@` | `185.199.111.153` | 1/2 Hour (or default) |

### Step 3: Configure `www` Subdomain CNAME Record
Add or edit the `CNAME` record for `www` to point to your GitHub organization/user pages address:

| Type | Name / Host | Value / Target | TTL |
| :--- | :--- | :--- | :--- |
| **CNAME** | `www` | `PVSaketh2003.github.io` | 1/2 Hour (or default) |

---

## 3. Alternative: Direct Azure VM DNS Configuration

If you want `pvsairamsaketh.in` to point directly to your **Azure Virtual Machine** running the universal Docker container:

| Type | Name / Host | Value / Target IP | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `<YOUR_AZURE_VM_PUBLIC_IP>` | 1/2 Hour |
| **CNAME** | `www` | `pvsairamsaketh.in` | 1/2 Hour |

---

## 4. Enabling Enforce HTTPS

Once DNS has propagated (typically 5–30 minutes):

1. Go to your GitHub repository: `https://github.com/pvsairamsaketh/visioneye`.
2. Go to **Settings** -> **Pages**.
3. Under **Custom domain**, verify that `pvsairamsaketh.in` is entered.
4. Check the box **Enforce HTTPS** (GitHub will automatically issue a Let's Encrypt TLS certificate).

---

## 5. DNS Propagation Verification Commands

You can verify your DNS propagation from your terminal:

```bash
# Check Apex A Records
dig pvsairamsaketh.in +nostats +nocomments +nocmd

# Check www CNAME
dig www.pvsairamsaketh.in +nostats +nocomments +nocmd

# Test HTTPS Endpoint
curl -I https://pvsairamsaketh.in
```
