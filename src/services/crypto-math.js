/**
 * Elliptic Curve Cryptography Math Engine for secp256r1 (NIST P-256)
 * Implements BigInt point arithmetic and Schnorr Proof-of-Knowledge generation.
 */

// secp256r1 Curve Parameters
export const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn; // Prime field
export const A = -3n; // a parameter
export const B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn; // b parameter
export const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n; // Curve order

// Generator Point G
export const G = {
  x: 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n,
  y: 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n
};

// Helper to compute modular arithmetic: (val % mod) ensuring positive result
export function mod(val, m) {
  const result = val % m;
  return result >= 0n ? result : result + m;
}

// Extended Euclidean Algorithm for Modular Inverse
export function modInverse(a, m) {
  let [m0, y, x] = [m, 0n, 1n];
  let a_val = mod(a, m);
  if (m === 1n) return 0n;
  
  while (a_val > 1n) {
    if (m === 0n) throw new Error("Division by zero in modInverse");
    let q = a_val / m;
    let t = m;
    m = a_val % m;
    a_val = t;
    t = y;
    y = x - q * y;
    x = t;
  }
  if (x < 0n) x += m0;
  return x;
}

// Elliptic Curve Point Doubling
export function pointDouble(pt) {
  if (pt === null) return null;
  const { x, y } = pt;
  if (y === 0n) return null; // Tangent is vertical, returns point at infinity
  
  const num = mod(3n * x * x + A, P);
  const den = mod(2n * y, P);
  const lambda = mod(num * modInverse(den, P), P);
  
  const rx = mod(lambda * lambda - 2n * x, P);
  const ry = mod(lambda * (x - rx) - y, P);
  
  return { x: rx, y: ry };
}

// Elliptic Curve Point Addition
export function pointAdd(pt1, pt2) {
  if (pt1 === null) return pt2;
  if (pt2 === null) return pt1;
  
  const { x: x1, y: y1 } = pt1;
  const { x: x2, y: y2 } = pt2;
  
  if (x1 === x2) {
    if (mod(y1 + y2, P) === 0n) {
      return null; // P1 + (-P1) = Point at infinity
    }
    return pointDouble(pt1);
  }
  
  const num = mod(y2 - y1, P);
  const den = mod(x2 - x1, P);
  const lambda = mod(num * modInverse(den, P), P);
  
  const rx = mod(lambda * lambda - x1 - x2, P);
  const ry = mod(lambda * (x1 - rx) - y1, P);
  
  return { x: rx, y: ry };
}

// Elliptic Curve Scalar Point Multiplication (Double-and-Add)
export function pointMultiply(pt, scalar) {
  let k = mod(scalar, N);
  if (k === 0n) return null;
  
  let result = null;
  let addend = pt;
  
  while (k > 0n) {
    if (k & 1n) {
      result = pointAdd(result, addend);
    }
    addend = pointDouble(addend);
    k = k >> 1n;
  }
  return result;
}

// Web Crypto SHA-256 hash helper
export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Convert BigInt to fixed 64-character hexadecimal string
export function toHex32(val) {
  return val.toString(16).padStart(64, '0');
}

/**
 * Generates a valid Schnorr Proof-of-Knowledge
 * For verification: s * G = R + c * Y
 * @param {number} birthYear - The secret birth year
 * @param {boolean} forceAdult - If true, simulates age >= 18 key. Otherwise generates true age representation.
 * @returns {Promise<Object>} Formatted request payload coordinates
 */
export async function generateSchnorrProof(birthYear, forceAdult = true) {
  // 1. Secret Key 'x' derived deterministically from birth year (or randomized if desired)
  // We hash the birth year with a seed to get a private key within [1, N-1]
  const seed = `secret-identity-key-year-${birthYear}-salt-${forceAdult ? 'adult' : 'child'}`;
  const seedHash = await sha256(seed);
  const x = mod(BigInt('0x' + seedHash), N - 1n) + 1n;
  
  // 2. Public Key 'Y = x * G'
  const Y = pointMultiply(G, x);
  
  // 3. Ephemeral Nonce 'k' (random scalar)
  const randArray = new Uint8Array(32);
  crypto.getRandomValues(randArray);
  const randHex = Array.from(randArray).map(b => b.toString(16).padStart(2, '0')).join('');
  const k = mod(BigInt('0x' + randHex), N - 1n) + 1n;
  
  // 4. Commitment Point 'R = k * G'
  const R = pointMultiply(G, k);
  
  // 5. Hex strings of coordinates (standardized 64-char hex format)
  const rxHex = toHex32(R.x);
  const ryHex = toHex32(R.y);
  const yxHex = toHex32(Y.x);
  const yyHex = toHex32(Y.y);
  
  // 6. Commitment Hash = SHA-256 of the concatenated coordinates of R
  // In our backend, we check how it recreates. It hashes the X and Y coordinates.
  const commitmentHash = await sha256(rxHex + ryHex);
  
  // 7. Challenge 'c' (random scalar challenge)
  const challengeArray = new Uint8Array(32);
  crypto.getRandomValues(challengeArray);
  const challengeHex = Array.from(challengeArray).map(b => b.toString(16).padStart(2, '0')).join('');
  const c = mod(BigInt('0x' + challengeHex), N - 1n) + 1n;
  
  // 8. Response 's = k + c * x (mod N)'
  const s = mod(k + mod(c * x, N), N);
  
  return {
    commitment_hash: commitmentHash,
    commitment_x: rxHex,
    commitment_y: ryHex,
    challenge: toHex32(c),
    response: toHex32(s),
    public_key_x: yxHex,
    public_key_y: yyHex,
    base_point_x: toHex32(G.x),
    base_point_y: toHex32(G.y),
    meta: {
      secret_x: toHex32(x),
      nonce_k: toHex32(k)
    }
  };
}
