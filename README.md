# Interactive Cryptographic Sandbox & Security Portfolio

[![Stack](https://img.shields.io/badge/Stack-Svelte%205%20%7C%20Vite%20%7C%20Tailwind%204-blue)](https://svelte.dev)
[![Deployment](https://img.shields.io/badge/Deploy-Cloudflare%20Pages%20Functions-orange)](https://pages.cloudflare.com)
[![Cryptography](https://img.shields.io/badge/Crypto-Web%20Crypto%20%26%20secp256r1-emerald)](https://www.w3.org/TR/WebCryptoAPI/)
[![Standards](https://img.shields.io/badge/Standards-eIDAS%20%7C%20PAdES%20%7C%20RFC--3161-purple)](https://en.wikipedia.org/wiki/EIDAS)

An interactive, premium-grade **Cryptographic Sandbox** designed to showcase full-stack security engineering, modern web performance, and decentralized identity solutions. It serves as both a live utility dashboard and a technical demonstration of zero-knowledge assertions, public-key cryptography, eIDAS-compliant signing workflows, and secure serverless architectures.

Developed by a **Software Engineer & Cybersecurity Specialist** (holding dual M.Sc. degrees in Software Engineering and Cybersecurity & Privacy), this application demonstrates production-ready patterns for hybrid offline-first client simulations and secure API proxying.

---

## 🏗️ System Architecture

The project is structured around a **Dual-Mode Execution Model**. By default, it attempts to route operations to a containerized Spring Boot Cryptographic Engine hosted on Google Cloud Run. If the backend is unreachable or offline, the application seamlessly pivots to high-fidelity client-side simulations utilizing the **W3C Web Crypto API** and a custom **Elliptic Curve BigInt Arithmetic Engine**.

### Dual-Mode Execution & API Proxying

```text
[Browser UI]                  [Cloudflare Proxy]             [Spring Boot Backend]
     |                                |                               |
     |---- 1. Ping /v1/health ------->|                               |
     |                                |---- 2. Forward Request ------>|
     |                                |<--- 3. Status Response -------|
     |<--- 4. Connection Active ------|                               |
     |                                |                               |
     |==== ONLINE TRANSACTION ========================================|
     |---- 5a. POST /v1/vault ------>|                               |
     |                                |--- 6. Inject Authorization -->|
     |                                |<-- 7. Return JSON Response ---|
     |<--- 8. Render Telemetry Logs --|                               |
     |                                                                |
     |==== OFFLINE FALLBACK (Backend Offline / Unreachable) ==========|
     |---- 5b. Route to Web Crypto API & Custom JS Curve Engine ---->|
     |<--- 6b. Compute Local BigInt NIST P-256 Math Simulation ------|
```

### Serverless LiveChat Gateway

To protect sensitive administration credentials, the floating chat widget delegates dispatching to a serverless function endpoint. The client never interacts with or receives third-party keys.

```text
[User Form Input]
       |
       v  (POST /chat/send to Cloudflare Function)
+-----------------------------------------------------+
|  Cloudflare Pages Serverless Function Proxy         |
|  - Reads TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID      |
|  - Sanitizes HTML & Escapes Markdown Content        |
+-----------------------------------------------------+
       |
       v  (Secure HTTPS POST)
+-----------------------------------------------------+
|  Telegram Bot API Gateway                           |
+-----------------------------------------------------+
       |
       v  (Push Notification Delivery)
+-----------------------------------------------------+
|  Site Owner's Registered Telegram Device            |
+-----------------------------------------------------+
```

---

## 🔑 Cryptographic Module Breakdown

### 1. Zero-Knowledge Age Verifier (Schnorr Protocol)
This module demonstrates a decentralized identity proof: proving a user is an adult ($\text{Age} \ge 18$) without disclosing their birth year or private credential key to the verifier.
* **Algorithm**: Non-interactive Schnorr Proof-of-Knowledge on curve `secp256r1` (NIST P-256).
* **Prover Flow**:
  1. Derive private key $x$ from the secret birth year: $x \equiv \text{SHA256}(\text{BirthYear} \mathbin{\|} \text{salt}) \pmod N$.
  2. Compute public key point $Y = x \cdot G$.
  3. Generate ephemeral random nonce $k \in_R \mathbb{Z}_N$ and compute commitment point $R = k \cdot G$.
  4. Generate commitment challenge scalar $c \equiv \text{SHA256}(R.x \mathbin{\|} R.y) \pmod N$ (deterministic Fiat-Shamir heuristic).
  5. Compute response scalar $s = k + c \cdot x \pmod N$.
  6. Submit proof parameters $\{R, c, s, Y\}$ to the verifier.
* **Verifier Flow**:
  1. Retrieve public parameters on curve `secp256r1`.
  2. Compute left-hand side point: $P_1 = s \cdot G$.
  3. Compute right-hand side point: $P_2 = R + c \cdot Y$.
  4. Confirm curve equivalence: $P_1 \stackrel{?}{=} P_2$. Since $s \cdot G = (k + c \cdot x) \cdot G = k \cdot G + c \cdot (x \cdot G) = R + c \cdot Y$, the equation holds true if and only if the prover holds the private key $x$.

### 2. eIDAS PDF Signing & AutoFirma Integration
Implements authentic PAdES electronic signing workflows matching European Union **eIDAS** and Spanish government validation standards.
* **Native Protocol Integration**: Establishes local WebSocket loopback channels to execute commands directly within Spain's official **AutoFirma** desktop app (using `AutoScript`).
* **Atomic Visual & Cryptographic Stamping**: Passes custom signature parameters configuring visible coordinates, page targets, page bounding boxes, font weights, and PAdES layouts. It uses `setStickySignatory(true)` to prompt the user for their certificate *exactly once*, cache the certificate handle, and then apply both the visual stamp and PAdES-BES signature atomically.
* **Telemetry & Fallbacks**: If the desktop software isn't running or the browser is on a mobile device, it activates a glassmorphic mock certificate picker containing synthetic software and hardware smartcard certificates (FNMT, DNIe) to simulate the full ETSI compliance flow.

### 3. Secure Document Vault & Cryptographic Ledger
Demonstrates authenticated envelope encryption for credentials combined with an audit trail matching blockchain-like linking.
* **Authenticated Encryption**: Encrypts JSON payloads using **AES-256-GCM**. Output payloads consist of a Base64 encoded ciphertext, a 12-byte initialization vector (IV), and a 16-byte authentication tag ensuring ciphertext integrity.
* **Append-Only Linked Ledger**: Every vault action triggers an audit log linked to an immutable blockchain-style ledger.
* **Block Hashing & Merkle Root Linked List**:
  * Block hash calculation: $\text{BlockHash} = \text{SHA256}(\text{Index} \mathbin{\|} \text{Timestamp} \mathbin{\|} \text{LogContent} \mathbin{\|} \text{PreviousHash})$.
  * Merkle Root linkage: $\text{MerkleRoot}_n = \text{SHA256}(\text{BlockHash}_n \mathbin{\|} \text{MerkleRoot}_{n-1})$.

### 4. X.509 Certificate Parser
Enables deep-inspection of cryptographic public key certificates. Decodes PEM-encoded X.509 certificate containers, parses the underlying DER ASN.1 structure, and extracts:
* Subject and Issuer Distinguished Names (DN).
* Serial Number.
* Validity constraints (Not Before / Not After).
* Public key parameters and signature algorithms (e.g. `SHA256withECDSA`).
* Key usage flags (`digitalSignature`, `nonRepudiation`, `keyEncipherment`).

### 5. RFC-3161 Time-Stamping Authority (TSA)
Secures data records against post-dated modification. Users generate document hashes and send them along with a random nonce to the Time-Stamping Authority, which returns an RFC-3161 compliant token containing:
* A certified UTC timestamp.
* Nonce validation (preventing replay attacks).
* A cryptographic signature generated by the TSA private key verifying document status at that specific instant.

---

## 🛠️ Technology Stack

* **Frontend Framework**: [Svelte 5](https://svelte.dev) utilizing reactive stores (`writable`), snippet structures, and fluid transition primitives (`fade`, `fly`, `scale`).
* **Styles & Layout**: [Tailwind CSS v4](https://tailwindcss.com) implementing custom glassmorphism backdrops, HSL-curated dark-mode palettes, CSS variables integration, and responsive grid layouts.
* **Build Engine**: [Vite 8](https://vite.dev) with Hot Module Replacement (HMR) and optimized JS bundling.
* **Serverless Functions**: [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/platform/functions/) acting as secure runtime proxies to external APIs and bot backends.
* **Local Emulator**: [Wrangler 4](https://developers.cloudflare.com/workers/wrangler/) for testing Cloudflare serverless environments locally.

---

## ⚙️ Local Setup & Environment Configuration

### Prerequisites
* **Node.js**: `v22.0.0` or higher
* **npm**: `v10.0.0` or higher
* **GitHub CLI** (`gh`): (Optional, for repository publishing)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/wesley-ka/PortfolioWebsite.git
   cd PortfolioWebsite
   ```
2. Install project dependencies:
   ```bash
   npm install
   ```

### Local Environment Variables (`.dev.vars`)
Create a local `.dev.vars` file in the root directory (this file is excluded from version control by `.gitignore` to prevent leaking active production secrets):
```env
# Proxy target mapping (points to your local Spring Boot Cryptographic Engine)
API_ORIGIN=http://localhost:8080

# Backend Authentication Key
API_KEY=your_secure_bearer_api_key_here

# Telegram bot integration secrets (optional, for LiveChat webhook routing)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklmNOPqrStuVWXyz
TELEGRAM_CHAT_ID=123456789
```

### Running the Application

* **Vite Development Server** (Frontend only, mocks active):
  ```bash
  npm run dev
  ```
  Runs the client-side server locally at `http://localhost:5173`.

* **Cloudflare Wrangler Dev Server** (Frontend + Serverless Functions + Local Proxies):
  ```bash
  npm run pages:dev
  ```
  Launches the server at `http://localhost:8788`. This environment fully emulates the Cloudflare Pages Functions routing pipeline, resolving `/api` proxies and Telegram dispatches via local env vars.

### Production Build & Deployments
Build a production-optimized package:
```bash
npm run build
```
Deploy the package directly to Cloudflare Pages (requires Wrangler authentication):
```bash
npm run deploy
```

---

## 🛡️ Security Auditing & Compliance
* **Transport Encryption**: HTTPS enforced across all endpoints.
* **Secret Isolation**: Zero private keys or bot tokens are stored in the client repository or compiled into the client-side bundle.
* **Standardization**: Adheres to eIDAS standards for electronic signatures, RFC-3161 for trusted timestamps, and NIST recommendation curves (`secp256r1`) for ECDSA/ZKP proofs.
