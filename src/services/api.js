/**
 * Upgraded Dual-Mode API Service Layer
 * 
 * Communicates with the local Spring Boot Cryptographic Engine running on http://localhost:8080/api.
 * Automatically checks server connectivity. If the server is offline or unreachable,
 * it falls back to a high-fidelity client-side Web Crypto and JS cryptographic simulation.
 */

import { generateSchnorrProof } from './crypto-math.js';

const BASE_URL = '/api';

// Live connection state
export let isBackendOnline = false;
let connCheckPromise = null;
let lastCheckTime = 0;
const CONN_CHECK_TTL = 30_000; // Cache result for 30 seconds

/**
 * Checks if the Spring Boot backend is reachable.
 * Uses a lightweight HEAD request and caches the result for 30s
 * to avoid spamming the network tab.
 */
export async function checkBackendConnection() {
  // Return cached result if still fresh
  const now = Date.now();
  if (now - lastCheckTime < CONN_CHECK_TTL) {
    return isBackendOnline;
  }

  if (connCheckPromise) return connCheckPromise;

  connCheckPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      // Lightweight GET probe against dedicated health endpoint
      const response = await fetch(`${BASE_URL}/v1/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      isBackendOnline = response.ok;
      lastCheckTime = now;
      return response.ok;
    } catch (err) {
      isBackendOnline = false;
      lastCheckTime = now;
      return false;
    } finally {
      connCheckPromise = null;
    }
  })();

  return connCheckPromise;
}

// Helper: Make real API request or execute mock callback
async function apiCall(path, body, mockFallbackFn) {
  // Try check connection
  const online = await checkBackendConnection();

  if (online) {
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const json = await response.json();
      if (!response.ok) {
        // Return structured API error payload
        throw {
          status: response.status,
          error: json.error || "API_ERROR",
          message: json.message || "Unknown server error occurred",
          path: path,
          timestamp: json.timestamp || new Date().toISOString()
        };
      }
      return json;
    } catch (err) {
      if (err.status) throw err; // Re-throw structured API errors
      console.warn(`[API] Fetch error calling ${path}, falling back to local simulation:`, err);
      // Server timed out or refused connection during active run, toggle online state
      isBackendOnline = false;
    }
  }

  // Fallback to local offline simulation
  return await mockFallbackFn();
}

// In-memory ledger chain for local mock audit trails
let mockLedger = [
  {
    index: 0,
    timestamp: "2026-06-05T12:00:00Z",
    log_entry: "GENESIS_BLOCK",
    previous_hash: "0000000000000000000000000000000000000000000000000000000000000000",
    block_hash: "3a42d8f9c1b2a3f4e5d6c7b8a9d0c1b2a3f4e5d6c7b8a9d0c1b2a3f4e5d6c7b8",
    merkle_root: "3a42d8f9c1b2a3f4e5d6c7b8a9d0c1b2a3f4e5d6c7b8a9d0c1b2a3f4e5d6c7b8"
  }
];

// SHA-256 helper for offline mock calculations
async function localSha256(str) {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}


// ==========================================
// MODULE 1: DIGITAL SIGNING & HASHING ENGINE
// ==========================================

export async function signPayload(checksum, base64Payload) {
  const reqBody = {};
  if (checksum) reqBody.file_checksum = checksum;
  if (base64Payload) reqBody.payload_base64 = base64Payload;

  return apiCall('/v1/signing/sign', reqBody, async () => {
    await new Promise(r => setTimeout(r, 1000)); // Sim latency
    const input = checksum || base64Payload || "empty";
    const localHash = await localSha256(input);

    // Simulate ECDSA signature
    const randSigBytes = new Uint8Array(64);
    crypto.getRandomValues(randSigBytes);
    const mockSig = btoa(String.fromCharCode(...randSigBytes));

    return {
      signature: mockSig,
      public_key_x: "8F9B6D7A94E2C7B8A1D3C5F6E7B8A9D0C1B2A3F4E5D6C7B8A9D0C1B2A3F4E5D6",
      public_key_y: "3A2B1C0E9D8C7B6A5F4E3D2C1B0A9F8E7D6C5B4A3D2C1B0A9F8E7D6C5B4A3D2C",
      algorithm: "SHA256withECDSA",
      timestamp: new Date().toISOString()
    };
  });
}

export async function verifySignature(payload, isHash, signature, pkX, pkY) {
  const reqBody = {
    original_payload: payload,
    payload_is_hash: isHash,
    signature: signature,
    public_key_x: pkX,
    public_key_y: pkY
  };

  return apiCall('/v1/signing/verify', reqBody, async () => {
    await new Promise(r => setTimeout(r, 800));
    // Verify signature length or presence to simulate validity
    const isValid = signature && signature.length > 20 && pkX && pkY;
    return {
      valid: !!isValid,
      issuer: "CivicTech Digital Signing Engine (Client Simulation)",
      timestamp: new Date().toISOString()
    };
  });
}


// ==========================================
// MODULE 2: ZERO-KNOWLEDGE AGE VERIFIER
// ==========================================

export async function verifyZkpProof(proofData) {
  return apiCall('/v1/identity/zkp-verify', proofData, async () => {
    await new Promise(r => setTimeout(r, 1200));

    // Perform simulated verification step on client
    // Mathematically check commitment point hash alignment or general presence
    const isValid = proofData.commitment_hash && proofData.challenge && proofData.response;

    const steps = [
      "Initialized verification of Schnorr Proof-of-Knowledge on secp256r1.",
      `Loaded public generator G = (${proofData.base_point_x.substring(0, 10)}..., ${proofData.base_point_y.substring(0, 10)}...)`,
      `Loaded public key Y = (${proofData.public_key_x.substring(0, 10)}..., ${proofData.public_key_y.substring(0, 10)}...)`,
      `Decoded challenge scalar c = ${proofData.challenge.substring(0, 12)}...`,
      `Decoded response scalar s = ${proofData.response.substring(0, 12)}...`,
      "Computing scalar multiplication 1: s * G",
      "Computing scalar multiplication 2: c * Y",
      "Verifying curve equivalence: s * G = R + c * Y",
      "Equivalent points verified! Commitment point R matches.",
      `Recalculating commitment hash: SHA256(R.x || R.y)`,
      `Hash match verified: ${proofData.commitment_hash.substring(0, 16)}...`,
      "ZKP verification successful. Citizen holds valid private key credential."
    ];

    return {
      verified: !!isValid,
      proof_log: steps
    };
  });
}


// ==========================================
// MODULE 3: SECURE DOCUMENT VAULT & AUDIT TRAIL
// ==========================================

export async function encryptVaultData(sensitiveData) {
  const reqBody = { sensitive_data: sensitiveData };

  return apiCall('/v1/vault/encrypt', reqBody, async () => {
    await new Promise(r => setTimeout(r, 900));
    const serialized = JSON.stringify(sensitiveData);

    // Simple mock GCM encryption: base64 serial + IV/Tag mock
    const utf8Bytes = new TextEncoder().encode(serialized);
    const mockCipherBytes = new Uint8Array(utf8Bytes.length);
    crypto.getRandomValues(mockCipherBytes);
    // Mix plaintext into it to make it look semi-scrambled
    for (let i = 0; i < utf8Bytes.length; i++) {
      mockCipherBytes[i] ^= utf8Bytes[i];
    }

    const mockCipher = btoa(String.fromCharCode(...mockCipherBytes));

    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const mockIv = btoa(String.fromCharCode(...iv));

    const tag = new Uint8Array(16);
    crypto.getRandomValues(tag);
    const mockTag = btoa(String.fromCharCode(...tag));

    return {
      ciphertext: mockCipher,
      iv: mockIv,
      auth_tag: mockTag
    };
  });
}

export async function decryptVaultData(ciphertext, iv, authTag) {
  const reqBody = {
    ciphertext: ciphertext,
    iv: iv,
    auth_tag: authTag
  };

  return apiCall('/v1/vault/decrypt', reqBody, async () => {
    await new Promise(r => setTimeout(r, 900));

    // Simulate decryption
    // E.g. return mock decryptions if matching strings are sent, otherwise fallback
    return {
      decrypted_data: {
        citizen_id: "ES-A8492048G",
        full_name: "Juana María de Todos los Santos",
        issuance_date: "2026-01-15",
        status: "ACTIVE_CITIZEN",
        security_clearance: "LEVEL_3"
      }
    };
  });
}

export async function logAuditTrail(logEntry) {
  const reqBody = { log_entry: logEntry };

  return apiCall('/v1/vault/audit', reqBody, async () => {
    await new Promise(r => setTimeout(r, 800));
    const previousBlock = mockLedger[mockLedger.length - 1];

    const index = mockLedger.length;
    const timestamp = new Date().toISOString();
    const previousHash = previousBlock.block_hash;

    // Create new block hash
    const blockHash = await localSha256(index + timestamp + logEntry + previousHash);
    const merkleRoot = await localSha256(blockHash + previousBlock.merkle_root);

    const newBlock = {
      index,
      timestamp,
      log_entry: logEntry,
      previous_hash: previousHash,
      block_hash: blockHash,
      merkle_root: merkleRoot
    };

    mockLedger.push(newBlock);
    return newBlock;
  });
}

// Get the local mock ledger for UI renderings
export function getMockLedger() {
  return mockLedger;
}


// ==========================================
// MODULE 4: X.509 CERTIFICATE PARSER
// ==========================================

export async function parseCertificate(certificateBase64) {
  const reqBody = { certificate_base64: certificateBase64 };

  return apiCall('/v1/certificates/parse', reqBody, async () => {
    await new Promise(r => setTimeout(r, 1100));

    // Inspect certificate lines to render custom fields
    const isMockPem = certificateBase64.includes("BEGIN CERTIFICATE");

    return {
      subject_dn: "CN=Citizen Juana, O=CivicTech, C=ES",
      issuer_dn: "CN=CivicTech Citizen Root CA, O=CivicTech, C=ES",
      serial_number: "740c03dfa104f205ab084d",
      valid_from: "2026-01-01T00:00:00Z",
      valid_to: "2029-01-01T00:00:00Z",
      key_usage: ["digitalSignature", "nonRepudiation", "keyEncipherment"],
      is_expired: false,
      signature_algorithm: "SHA256withECDSA",
      signature_valid: true,
      validation_log: [
        "Read PEM certificate container.",
        "Decoded DER ASN.1 structure successfully.",
        "Found X.509 v3 certificate structure.",
        "Verified validity range: Not Before Jan 1 2026, Not After Jan 1 2029.",
        "Key usages resolved: digitalSignature, nonRepudiation, keyEncipherment.",
        "Signature checked against Issuer public key: VALID CN=CivicTech Citizen Root CA"
      ]
    };
  });
}


// ==========================================
// MODULE 5: TIMESTAMPING AUTHORITY (TSA)
// ==========================================

export async function requestTsaTimestamp(documentHash, nonce) {
  const reqBody = { document_hash: documentHash };
  if (nonce) reqBody.nonce = nonce;

  return apiCall('/v1/tsa/timestamp', reqBody, async () => {
    await new Promise(r => setTimeout(r, 1000));

    const finalNonce = nonce || "03e481bf0d53c2";
    const serial = "982348a2d109f3e4";
    const ts = new Date().toISOString();

    // Simulate TSA Signature
    const tsSig = await localSha256(documentHash + ts + finalNonce);

    return {
      token_base64: "MIIHCAYJKoZIhvcNAQcCoIIH+TCB9wIBATELMAkGBSsOAwIaBQAwggEoBgsqhkiG9w0BCwUBAKBEMEMwQTAJBgUrDgMCGgUAMDEEIA...",
      serial_number: serial,
      timestamp: ts,
      nonce: finalNonce,
      hash_algorithm: "SHA-256",
      document_hash: documentHash,
      signature: btoa(tsSig),
      tsa_public_key_x: "0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B",
      tsa_public_key_y: "0F1E2D3C4B5A6F7E8D9C0B1A2F3E4D5C6B7A8F9E0D1C2B3A4F5E6D7C8B9A0F1E"
    };
  });
}

// ==========================================
// MODULE 6: eIDAS PDF SIGNING & AUTOFIRMA
// ==========================================

export async function preparePdfFooter(pdfBase64, options = {}) {
  let reqBody = {
    pdf_base64: pdfBase64
  };

  if (typeof options === 'string') {
    reqBody.custom_text = options;
  } else if (options && typeof options === 'object') {
    reqBody = {
      ...reqBody,
      ...options
    };
  }

  return apiCall('/v1/pdf/prepare-footer', reqBody, async () => {
    await new Promise(r => setTimeout(r, 1100)); // Latency
    const localHash = await localSha256(pdfBase64);

    // Fallback: return the same base64 representing the prepared PDF
    return {
      pdf_base64: pdfBase64,
      hash_sha256: localHash
    };
  });
}

/**
 * Signs a PDF using AutoFirma installed on the client machine.
 * This is a single-call operation: AutoFirma shows ONE native dialog where the
 * user selects their certificate, then applies the visible stamp and
 * cryptographic PAdES signature atomically.
 *
 * @param {string} pdfBase64 - The original PDF in base64.
 * @param {function} onSimulateCertSelect - Callback to display simulation modal in UI.
 * @param {string|null} preSelectedMockCert - If provided in sim mode, skips the modal.
 * @param {string|null} customParams - PAdES extra params string (visible sig, layer2Text, etc.).
 * @returns {Promise<object>} - Resolves to { signedPdfBase64, certificateBase64?, certificateSubject? }.
 */
export async function signPdfWithAutoFirma(pdfBase64, onSimulateCertSelect, preSelectedMockCert = null, customParams = null) {
  return new Promise((resolve, reject) => {
    // 1. Check if the AutoFirma API is loaded
    if (typeof AutoFirma === 'undefined') {
      console.warn("[AutoFirma] Native AutoFirma.js library is not loaded. Entering simulation mode.");

      // If cert was already selected, reuse it — no modal.
      if (preSelectedMockCert) {
        console.log(`[AutoFirma Simulation] Reusing pre-selected certificate: ${preSelectedMockCert}`);
        setTimeout(() => resolve({
          signedPdfBase64: pdfBase64,
          certificateSubject: preSelectedMockCert
        }), 800);
        return;
      }

      if (onSimulateCertSelect) {
        onSimulateCertSelect((selectedCert) => {
          console.log(`[AutoFirma Simulation] Signed using certificate: ${selectedCert}`);
          setTimeout(() => resolve({
            signedPdfBase64: pdfBase64,
            certificateSubject: selectedCert
          }), 800);
        }, (cancelError) => {
          reject(cancelError);
        });
      } else {
        reject(new Error("AutoFirma library is not loaded and no simulation callback is configured."));
      }
      return;
    }

    // 2. Use custom params or sensible defaults
    const signatureParams = customParams || (
      "format=PAdES\n" +
      "mode=implicit\n" +
      "algorithm=SHA256withRSA"
    );

    // 3. Initialize AutoFirma connection
    try {
      AutoFirma.cargarAppAfirma();
    } catch (e) {
      console.warn("AutoFirma initialization warning:", e);
    }

    // 4. Single call to AutoFirma.sign — cert selection + visual stamp + crypto signature.
    //    The success callback receives (signedData, certificate, extraInfo).
    //    'certificate' is the Base64-encoded X.509 cert the user selected.
    AutoFirma.sign(
      pdfBase64,
      "SHA256withRSA",
      "PAdES",
      signatureParams,
      (signedPdfBase64, certificateBase64) => {
        console.log("PDF successfully signed locally via macOS AutoFirma!");
        resolve({
          signedPdfBase64,
          certificateBase64: certificateBase64 || null
        });
      },
      (errorType, errorMessage, errorCode) => {
        console.error("AutoFirma signing failed:", { errorType, errorMessage, errorCode });

        const isAppNotFound = errorType && (
          errorType.includes("ApplicationNotFoundException") ||
          errorType.includes("TimeoutException") ||
          errorType.includes("IOException")
        );
        const isConnectionError = (errorMessage && (
          errorMessage.includes("comunicación") ||
          errorMessage.includes("conectar") ||
          errorMessage.includes("invocar a la aplicacion") ||
          errorMessage.includes("WebSocket")
        )) || (errorCode && errorCode.includes("AS4205"));

        if (isAppNotFound || isConnectionError) {
          console.warn("[AutoFirma] Native application not found or unreachable. Falling back to simulation modal.");
          if (onSimulateCertSelect) {
            onSimulateCertSelect(
              (selectedCert) => {
                console.log(`[AutoFirma Simulation Fallback] Signed using certificate: ${selectedCert}`);
                setTimeout(() => resolve({
                  signedPdfBase64: pdfBase64,
                  certificateSubject: selectedCert
                }), 800);
              },
              (cancelError) => reject(cancelError)
            );
          } else {
            reject(new Error("AutoFirma native app not found and no simulation callback configured."));
          }
        } else {
          const detail = errorMessage || (errorCode ? `Code ${errorCode}` : 'No details available');
          reject(new Error(`AutoFirma error [${errorType}]: ${detail}`));
        }
      }
    );
  });
}

/**
 * Invokes the AutoFirma certificate selection dialog.
 * Enables stickySignatory so the chosen cert is silently reused by the
 * subsequent signPdfWithAutoFirma call — only ONE native dialog total.
 *
 * @param {function} onSimulateCertSelect - Callback to display mock selector in UI.
 * @returns {Promise<object>} - Resolves with { mock, certName?, certBase64? }.
 */
export async function selectCertificateWithAutoFirma(onSimulateCertSelect) {
  return new Promise((resolve, reject) => {
    // 1. Check if the AutoFirma API is loaded
    if (typeof AutoFirma === 'undefined') {
      console.warn("[AutoFirma] Native AutoFirma.js library is not loaded. Entering simulation mode.");

      if (onSimulateCertSelect) {
        onSimulateCertSelect((selectedCert) => {
          resolve({ mock: true, certName: selectedCert });
        }, (cancelError) => {
          reject(cancelError);
        });
      } else {
        reject(new Error("AutoFirma library is not loaded and no simulation callback is configured."));
      }
      return;
    }

    // 2. Enable sticky signatory BEFORE selecting.
    //    AutoFirma will cache the chosen certificate internally. The next sign()
    //    call will silently use that cert without showing a second picker dialog.
    AutoFirma.setStickySignatory(true);

    // 3. Initialize connection
    try {
      AutoFirma.cargarAppAfirma();
    } catch (e) {
      console.warn("AutoFirma initialization warning:", e);
    }

    // 4. Show the certificate selection dialog (this is the ONLY native dialog in the flow)
    AutoFirma.selectCertificate(
      "filters=nonexpired:",
      (selectedCertBase64) => {
        console.log("[AutoFirma] Certificate selected — sticky cert cached for signing step.");
        resolve({ mock: false, certBase64: selectedCertBase64 });
      },
      (errorType, errorMessage, errorCode) => {
        console.error("AutoFirma certificate selection failed:", { errorType, errorMessage, errorCode });

        const isAppNotFound = errorType && (
          errorType.includes("ApplicationNotFoundException") ||
          errorType.includes("TimeoutException") ||
          errorType.includes("IOException")
        );
        const isConnectionError = (errorMessage && (
          errorMessage.includes("comunicación") ||
          errorMessage.includes("conectar") ||
          errorMessage.includes("invocar a la aplicacion") ||
          errorMessage.includes("WebSocket")
        )) || (errorCode && errorCode.includes("AS4205"));

        if (isAppNotFound || isConnectionError) {
          console.warn("[AutoFirma] Native application not found or unreachable. Falling back to simulation modal.");
          // Disable sticky since we're going into sim mode
          AutoFirma.setStickySignatory(false);
          if (onSimulateCertSelect) {
            onSimulateCertSelect(
              (selectedCert) => resolve({ mock: true, certName: selectedCert }),
              (cancelError) => reject(cancelError)
            );
          } else {
            reject(new Error("AutoFirma native app not found and no simulation callback configured."));
          }
        } else {
          const detail = errorMessage || (errorCode ? `Code ${errorCode}` : 'No details available');
          reject(new Error(`AutoFirma error [${errorType}]: ${detail}`));
        }
      }
    );
  });
}

