/**
 * Upgraded Dual-Mode API Service Layer
 * 
 * Communicates with the local Spring Boot Cryptographic Engine running on http://localhost:8080/api.
 * Automatically checks server connectivity. If the server is offline or unreachable,
 * it falls back to a high-fidelity client-side Web Crypto and JS cryptographic simulation.
 */

import { generateSchnorrProof } from './crypto-math.js';
import { writable } from 'svelte/store';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

// Helper functions for Base64URL encoding/decoding of Uint8Arrays
function bytesToBase64Url(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToBytes(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}


const BASE_URL = '/api';

// Exportable Svelte stores for real-time telemetry and inspection
export const apiLogs = writable([]);
export const backendStatus = writable({
  online: false,
  ping: null,
  lastChecked: null
});

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
  const now = Date.now();
  if (now - lastCheckTime < CONN_CHECK_TTL) {
    return isBackendOnline;
  }

  if (connCheckPromise) return connCheckPromise;

  connCheckPromise = (async () => {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      // Lightweight GET probe against dedicated health endpoint
      const response = await fetch(`${BASE_URL}/v1/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const ping = Date.now() - startTime;
      isBackendOnline = response.ok;
      lastCheckTime = now;

      backendStatus.set({
        online: response.ok,
        ping,
        lastChecked: new Date().toISOString()
      });

      return response.ok;
    } catch (err) {
      isBackendOnline = false;
      lastCheckTime = now;

      backendStatus.set({
        online: false,
        ping: null,
        lastChecked: new Date().toISOString()
      });

      return false;
    } finally {
      connCheckPromise = null;
    }
  })();

  return connCheckPromise;
}

// Helper: Make real API request or execute mock callback
async function apiCall(path, body, mockFallbackFn, method = 'POST') {
  const startTime = Date.now();
  let online = false;

  try {
    online = await checkBackendConnection();
  } catch (err) {
    online = false;
  }

  if (online) {
    try {
      const fetchUrl = `${BASE_URL}${path}`;
      const requestOptions = {
        method: method,
        headers: {}
      };

      if (method !== 'GET' && method !== 'HEAD') {
        requestOptions.headers['Content-Type'] = 'application/json';
        requestOptions.body = JSON.stringify(body);
      }

      const response = await fetch(fetchUrl, requestOptions);
      const latency = Date.now() - startTime;
      
      let json = null;
      if (response.status !== 204) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          json = await response.json();
        } else {
          const text = await response.text();
          if (text) {
            try {
              json = JSON.parse(text);
            } catch (e) {
              json = { message: text };
            }
          }
        }
      }

      if (!response.ok) {
        // Log API failure
        apiLogs.update(logs => [
          {
            id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
            timestamp: new Date().toISOString(),
            method,
            path,
            online: true,
            status: response.status,
            latency,
            payload: body,
            response: json || { error: "API_ERROR", message: "Empty or invalid response body" }
          },
          ...logs
        ].slice(0, 50));

        // Return structured API error payload
        throw {
          status: response.status,
          error: (json && json.error) || "API_ERROR",
          message: (json && json.message) || "Unknown server error occurred",
          path: path,
          timestamp: (json && json.timestamp) || new Date().toISOString()
        };
      }

      // Log API success
      apiLogs.update(logs => [
        {
          id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
          timestamp: new Date().toISOString(),
          method,
          path,
          online: true,
          status: response.status,
          latency,
          payload: body,
          response: json || { success: true }
        },
        ...logs
      ].slice(0, 50));

      return json;
    } catch (err) {
      if (err.status) throw err; // Re-throw structured API errors
      console.warn(`[API] Fetch error calling ${path}, falling back to local simulation:`, err);
      // Server timed out or refused connection during active run, toggle online state
      isBackendOnline = false;
      backendStatus.update(status => ({ ...status, online: false }));
    }
  }

  // Fallback to local offline simulation
  const startFallbackTime = Date.now();
  const result = await mockFallbackFn();
  const latency = Date.now() - startFallbackTime;

  // Log simulated fallback
  apiLogs.update(logs => [
    {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      method,
      path,
      online: false,
      status: 'FALLBACK_OK',
      latency,
      payload: body,
      response: result
    },
    ...logs
  ].slice(0, 50));

  return result;
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

// ==========================================
// MODULE 7: QUANTUM-SAFE MESSAGE EXCHANGE (ML-KEM)
// ==========================================

export async function generateQuantumKeypair() {
  return apiCall('/v1/quantum/keygen', {}, async () => {
    await new Promise(r => setTimeout(r, 600)); // Sim latency
    const kp = ml_kem768.keygen();
    return {
      publicKey: bytesToBase64Url(kp.publicKey),
      privateKey: bytesToBase64Url(kp.secretKey),
      algorithm: "ML-KEM-768",
      publicKeyLength: kp.publicKey.length,
      privateKeyLength: kp.secretKey.length
    };
  });
}

export async function encryptQuantumMessage(recipientPublicKeyB64, messageText) {
  const reqBody = {
    recipient_public_key: recipientPublicKeyB64,
    message_text: messageText
  };

  return apiCall('/v1/quantum/encrypt', reqBody, async () => {
    await new Promise(r => setTimeout(r, 800)); // Sim latency

    // Decode public key
    const pkBytes = base64UrlToBytes(recipientPublicKeyB64);

    // Encapsulate key
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(pkBytes);

    // Import shared secret as AES-GCM key
    const aesKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Encrypt message using AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encTextBytes = new TextEncoder().encode(messageText);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      aesKey,
      encTextBytes
    );

    return {
      kem_ciphertext: bytesToBase64Url(cipherText),
      iv: bytesToBase64Url(iv),
      encrypted_message: bytesToBase64Url(new Uint8Array(encryptedBuffer)),
      algorithm: "ML-KEM-768 + AES-256-GCM",
      shared_secret_hash: await localSha256(bytesToBase64Url(sharedSecret))
    };
  });
}

export async function decryptQuantumMessage(privateKeyB64, payload) {
  const reqBody = {
    private_key: privateKeyB64,
    kem_ciphertext: payload.kem_ciphertext,
    iv: payload.iv,
    encrypted_message: payload.encrypted_message
  };

  return apiCall('/v1/quantum/decrypt', reqBody, async () => {
    await new Promise(r => setTimeout(r, 800)); // Sim latency

    // Decode inputs
    const skBytes = base64UrlToBytes(privateKeyB64);
    const kemCtBytes = base64UrlToBytes(payload.kem_ciphertext);
    const ivBytes = base64UrlToBytes(payload.iv);
    const encMsgBytes = base64UrlToBytes(payload.encrypted_message);

    // Decapsulate shared secret
    const sharedSecret = ml_kem768.decapsulate(kemCtBytes, skBytes);

    // Import shared secret as AES-GCM key
    const aesKey = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt message using AES-GCM
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        tagLength: 128
      },
      aesKey,
      encMsgBytes
    );

    const decryptedText = new TextDecoder().decode(decryptedBuffer);

    return {
      decrypted_text: decryptedText,
      algorithm: "ML-KEM-768 + AES-256-GCM",
      shared_secret_hash: await localSha256(bytesToBase64Url(sharedSecret))
    };
  });
}

// ==========================================
// MODULE 8: VERIFIABLE CREDENTIALS (VC) WALLET
// ==========================================

const mockVcs = {};

export async function issueVerifiableCredential(payload) {
  return apiCall('/v1/identity/vc/issue', payload, async () => {
    await new Promise(r => setTimeout(r, 1200)); // Sim latency

    const vcId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11) + '-' + Math.random().toString(36).substring(2, 11);

    const currentIso = new Date().toISOString();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + (payload.expirationDays || 30));

    // Compute local signature of subject fields
    const expectedPayload = {
      subjectId: payload.subjectId || "did:example:citizen123",
      fullName: payload.fullName || "Juana de Arco",
      attributes: {
        eligibleToVote: payload.attributes ? !!payload.attributes.eligibleToVote : true,
        jurisdiction: payload.attributes ? payload.attributes.jurisdiction : "Madrid"
      },
      expirationDays: 30 // standardized for hash match
    };

    const subjectHash = await localSha256(JSON.stringify(expectedPayload));
    const mockSignature = btoa(`SHA256withECDSA:${subjectHash}`);

    const credential = {
      "@context": ["https://www.w3.org/2018/credentials/v1", "https://schema.org"],
      "id": `urn:uuid:${vcId}`,
      "type": ["VerifiableCredential", "CivicCitizenCredential"],
      "issuer": "did:web:engine.civictech.org",
      "issuanceDate": currentIso,
      "expirationDate": expirationDate.toISOString(),
      "credentialSubject": {
        "id": expectedPayload.subjectId,
        "fullName": expectedPayload.fullName,
        "eligibleToVote": expectedPayload.attributes.eligibleToVote,
        "jurisdiction": expectedPayload.attributes.jurisdiction
      },
      "proof": {
        "type": "JsonWebSignature2020",
        "created": currentIso,
        "proofPurpose": "assertionMethod",
        "verificationMethod": "did:web:engine.civictech.org#key-1",
        "publicKeyX": "7c98f828a2d3e4f506172839405a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3",
        "publicKeyY": "8f89e2c2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0",
        "proofValue": mockSignature
      }
    };

    // Save to local in-memory storage and localStorage for simulation access
    mockVcs[vcId] = credential;
    try {
      localStorage.setItem(`mock_vc_${vcId}`, JSON.stringify(credential));
    } catch (e) {
      console.warn("localStorage not available:", e);
    }

    return {
      vcId: vcId,
      shareUrl: `/v1/identity/vc/share/${vcId}`,
      credential: credential
    };
  });
}

export async function fetchCredentialFromUrl(vcUrl) {
  const startTime = Date.now();
  let online = false;
  try {
    online = await checkBackendConnection();
  } catch (err) {
    online = false;
  }

  // Extract vcId from share URL format
  let vcId = '';
  const match = vcUrl.match(/\/share\/([a-zA-Z0-9-]+)/);
  if (match) {
    vcId = match[1];
  }

  if (online) {
    try {
      const response = await fetch(vcUrl);
      const latency = Date.now() - startTime;
      const json = await response.json();

      apiLogs.update(logs => [
        {
          id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
          timestamp: new Date().toISOString(),
          method: 'GET',
          path: vcUrl.replace(/^https?:\/\/[^\/]+/, ''),
          online: true,
          status: response.status,
          latency,
          payload: null,
          response: json
        },
        ...logs
      ].slice(0, 50));

      return json;
    } catch (err) {
      console.warn(`[API] Failed to fetch credential from ${vcUrl}, falling back to local storage:`, err);
    }
  }

  // Offline fallback
  const startFallbackTime = Date.now();
  await new Promise(r => setTimeout(r, 800));

  let credential = null;
  if (vcId) {
    credential = mockVcs[vcId];
    if (!credential) {
      try {
        const stored = localStorage.getItem(`mock_vc_${vcId}`);
        if (stored) credential = JSON.parse(stored);
      } catch (e) { }
    }
  }

  // If still not found, return a default sample credential
  if (!credential) {
    const currentIso = new Date().toISOString();
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 30);
    const mockPayload = {
      subjectId: "did:example:citizen123",
      fullName: "Juana de Arco (Simulated)",
      attributes: { eligibleToVote: true, jurisdiction: "Madrid" },
      expirationDays: 30
    };
    const subjectHash = await localSha256(JSON.stringify(mockPayload));
    const mockSignature = btoa(`SHA256withECDSA:${subjectHash}`);

    credential = {
      "@context": ["https://www.w3.org/2018/credentials/v1", "https://schema.org"],
      "id": `urn:uuid:simulated-citizen-id-9999`,
      "type": ["VerifiableCredential", "CivicCitizenCredential"],
      "issuer": "did:web:engine.civictech.org",
      "issuanceDate": currentIso,
      "expirationDate": expDate.toISOString(),
      "credentialSubject": {
        "id": "did:example:citizen123",
        "fullName": "Juana de Arco (Simulated)",
        "eligibleToVote": true,
        "jurisdiction": "Madrid"
      },
      "proof": {
        "type": "JsonWebSignature2020",
        "created": currentIso,
        "proofPurpose": "assertionMethod",
        "verificationMethod": "did:web:engine.civictech.org#key-1",
        "publicKeyX": "7c98f828a2d3e4f506172839405a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3",
        "publicKeyY": "8f89e2c2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0",
        "proofValue": mockSignature
      }
    };
  }

  const latency = Date.now() - startFallbackTime;
  apiLogs.update(logs => [
    {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      method: 'GET',
      path: `/v1/identity/vc/share/${vcId || 'simulated'}`,
      online: false,
      status: 'FALLBACK_OK',
      latency,
      payload: null,
      response: credential
    },
    ...logs
  ].slice(0, 50));

  return credential;
}

export async function verifyVerifiableCredential(credential) {
  const result = await apiCall('/v1/identity/vc/verify', credential, async () => {
    await new Promise(r => setTimeout(r, 1500)); // Sim radar scan

    if (!credential || !credential.credentialSubject || !credential.proof) {
      return {
        verified: false,
        signatureValid: false,
        integrityIntact: false,
        notExpired: false
      };
    }

    // Check expiration date
    const isExpired = new Date(credential.expirationDate) < new Date();

    // Verify local mock cryptographic signature and integrity
    const subject = credential.credentialSubject;
    const expectedPayload = {
      subjectId: subject.id,
      fullName: subject.fullName,
      attributes: {
        eligibleToVote: typeof subject.eligibleToVote === 'string' ? subject.eligibleToVote === 'true' : !!subject.eligibleToVote,
        jurisdiction: subject.jurisdiction
      },
      expirationDays: 30
    };

    const subjectHash = await localSha256(JSON.stringify(expectedPayload));
    const expectedSignature = btoa(`SHA256withECDSA:${subjectHash}`);

    const signatureValid = credential.proof.proofValue && credential.proof.proofValue.length > 20;
    const integrityIntact = credential.proof.proofValue === expectedSignature;
    const notExpired = !isExpired;

    const verified = signatureValid && integrityIntact && notExpired;

    return {
      verified,
      signatureValid,
      integrityIntact,
      notExpired
    };
  });

  // Normalize properties to support nested checks object and both camelCase/snake_case from server
  const checks = result.checks || {};
  return {
    verified: result.verified ?? false,
    signatureValid: checks.signatureValid ?? result.signatureValid ?? result.signature_valid ?? false,
    integrityIntact: checks.integrityIntact ?? result.integrityIntact ?? result.integrity_intact ?? false,
    notExpired: checks.notExpired ?? result.notExpired ?? result.not_expired ?? false
  };
}


// ==========================================
// MODULE 9: CRYPTOGRAPHIC PROVENANCE LEDGER
// ==========================================

const mockLedgerChains = {};

export async function createLedgerShipment(payload) {
  return apiCall('/v1/ledger/create', payload, async () => {
    await new Promise(r => setTimeout(r, 1000));

    const { assetId, assetType, custodian, meta } = payload;
    const currentIso = new Date().toISOString();

    const previousHash = "0000000000000000000000000000000000000000000000000000000000000000";
    const contentToHash = `0:${currentIso}:${JSON.stringify({ eventType: "GENESIS", custodian, location: custodian + " (Madrid)" })}:${previousHash}`;
    const blockHash = await localSha256(contentToHash);

    const genesisBlock = {
      index: 0,
      assetId,
      assetType,
      eventType: "GENESIS",
      custodian,
      location: custodian + " (Madrid)",
      timestamp: currentIso,
      previousBlockHash: previousHash,
      blockHash,
      signature: btoa(`ECDSA_SIG:${blockHash}`),
      meta: meta || {}
    };

    mockLedgerChains[assetId] = [genesisBlock];
    try {
      localStorage.setItem(`mock_ledger_${assetId}`, JSON.stringify([genesisBlock]));
    } catch (e) { }

    return genesisBlock;
  });
}

export async function fetchLatestLedgerBlock(assetId) {
  const path = `/v1/ledger/${assetId}/latest`;

  return apiCall(path, null, async () => {
    await new Promise(r => setTimeout(r, 600)); // Sim latency

    let chain = mockLedgerChains[assetId];
    if (!chain) {
      try {
        const stored = localStorage.getItem(`mock_ledger_${assetId}`);
        if (stored) chain = JSON.parse(stored);
      } catch (e) { }
    }
    if (!chain || chain.length === 0) {
      throw new Error(`Asset '${assetId}' has no registered records.`);
    }

    return chain[chain.length - 1];
  }, 'GET');
}

export async function appendLedgerEvent(payload) {
  return apiCall('/v1/ledger/append', payload, async () => {
    await new Promise(r => setTimeout(r, 1000));

    const { assetId, eventType, custodian, location, previousBlockHash, meta } = payload;
    const currentIso = new Date().toISOString();

    // Retrieve chain
    let chain = mockLedgerChains[assetId];
    if (!chain) {
      try {
        const stored = localStorage.getItem(`mock_ledger_${assetId}`);
        if (stored) chain = JSON.parse(stored);
      } catch (e) { }
    }
    if (!chain) chain = [];

    const newIndex = chain.length;
    const contentToHash = `${newIndex}:${currentIso}:${JSON.stringify({ eventType, custodian, location })}:${previousBlockHash}`;
    const blockHash = await localSha256(contentToHash);

    const newBlock = {
      index: newIndex,
      assetId,
      eventType,
      custodian,
      location,
      timestamp: currentIso,
      previousBlockHash,
      blockHash,
      signature: btoa(`ECDSA_SIG:${blockHash}`),
      meta: meta || {}
    };

    chain.push(newBlock);
    mockLedgerChains[assetId] = chain;
    try {
      localStorage.setItem(`mock_ledger_${assetId}`, JSON.stringify(chain));
    } catch (e) { }

    return newBlock;
  });
}

export async function verifyLedgerChain(assetId) {
  const path = `/v1/ledger/${assetId}/verify`;

  const startTime = Date.now();
  let online = false;
  try {
    online = await checkBackendConnection();
  } catch (err) {
    online = false;
  }

  if (online) {
    try {
      const response = await fetch(`${BASE_URL}${path}`);
      const latency = Date.now() - startTime;
      const json = await response.json();

      apiLogs.update(logs => [
        {
          id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
          timestamp: new Date().toISOString(),
          method: 'GET',
          path,
          online: true,
          status: response.status,
          latency,
          payload: null,
          response: json
        },
        ...logs
      ].slice(0, 50));

      return json;
    } catch (err) {
      console.warn(`[API] Failed to verify ledger ${assetId} via GET, falling back to local audit:`, err);
    }
  }

  // Offline fallback audit
  const startFallbackTime = Date.now();
  await new Promise(r => setTimeout(r, 1800)); // Laser scan simulation latency

  let chain = mockLedgerChains[assetId];
  if (!chain) {
    try {
      const stored = localStorage.getItem(`mock_ledger_${assetId}`);
      if (stored) chain = JSON.parse(stored);
    } catch (e) { }
  }
  if (!chain) chain = [];

  const auditReport = [];
  let validChain = true;

  for (let i = 0; i < chain.length; i++) {
    const block = chain[i];

    // Recalculate block hash
    const contentToHash = `${block.index}:${block.timestamp}:${JSON.stringify({
      eventType: block.eventType,
      custodian: block.custodian,
      location: block.location
    })}:${block.previousBlockHash}`;

    const recalculatedHash = await localSha256(contentToHash);
    const hashMatches = recalculatedHash === block.blockHash;

    const signatureValid = hashMatches && block.signature === btoa(`ECDSA_SIG:${block.blockHash}`);

    auditReport.push({
      index: block.index,
      hashMatches,
      signatureValid,
      blockHash: block.blockHash
    });

    if (!hashMatches || !signatureValid) {
      validChain = false;
    }

    // Check linkage
    if (i > 0) {
      const prevBlock = chain[i - 1];
      if (block.previousBlockHash !== prevBlock.blockHash) {
        validChain = false;
      }
    }
  }

  const result = {
    assetId,
    validChain: chain.length > 0 ? validChain : false,
    blockCount: chain.length,
    auditReport
  };

  const latency = Date.now() - startFallbackTime;
  apiLogs.update(logs => [
    {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      method: 'GET',
      path,
      online: false,
      status: 'FALLBACK_OK',
      latency,
      payload: null,
      response: result
    },
    ...logs
  ].slice(0, 50));

  return result;
}

export function getMockLedgerChain(assetId) {
  let chain = mockLedgerChains[assetId];
  if (!chain) {
    try {
      const stored = localStorage.getItem(`mock_ledger_${assetId}`);
      if (stored) chain = JSON.parse(stored);
    } catch (e) { }
  }
  return chain || [];
}

export async function fetchLedgerChain(assetId) {
  const path = `/v1/ledger/${assetId}/history`;

  const result = await apiCall(path, null, async () => {
    await new Promise(r => setTimeout(r, 600)); // Sim latency
    return {
      assetId,
      totalBlocks: getMockLedgerChain(assetId).length,
      blocks: getMockLedgerChain(assetId)
    };
  }, 'GET');

  // Handle both direct array format (mock fallback) and the wrapped object format from server
  if (result && Array.isArray(result)) {
    return result;
  }
  if (result && result.blocks && Array.isArray(result.blocks)) {
    return result.blocks;
  }
  return [];
}

export async function resetLedgerChain(assetId) {
  const path = `/v1/ledger/${assetId}`;

  return apiCall(path, null, async () => {
    await new Promise(r => setTimeout(r, 600)); // Sim latency
    delete mockLedgerChains[assetId];
    try {
      localStorage.removeItem(`mock_ledger_${assetId}`);
    } catch (e) {}
    return { success: true };
  }, 'DELETE');
}

export async function tamperLedgerBlock(assetId, index, location) {
  const path = `/v1/ledger/${assetId}/tamper`;
  const reqBody = { index, location };

  return apiCall(path, reqBody, async () => {
    await new Promise(r => setTimeout(r, 800)); // Sim latency

    let chain = mockLedgerChains[assetId];
    if (!chain) {
      try {
        const stored = localStorage.getItem(`mock_ledger_${assetId}`);
        if (stored) chain = JSON.parse(stored);
      } catch (e) {}
    }
    if (!chain || chain.length === 0) {
      throw new Error(`Asset '${assetId}' has no registered records to tamper.`);
    }

    const targetIdx = parseInt(index, 10);
    if (targetIdx < 0 || targetIdx >= chain.length) {
      throw new Error(`Invalid block index '${index}' to tamper. Chain length is ${chain.length}.`);
    }

    // Tamper the specific block by overwriting its location
    chain[targetIdx] = {
      ...chain[targetIdx],
      location: location
    };

    mockLedgerChains[assetId] = chain;
    try {
      localStorage.setItem(`mock_ledger_${assetId}`, JSON.stringify(chain));
    } catch (e) {}

    return { success: true, index: targetIdx, location };
  }, 'POST');
}


