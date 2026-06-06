import pkg from 'elliptic';
import BN from 'bn.js';
import { sha256 } from 'js-sha256';

const { ec: EC } = pkg;
const ec = new EC('p256'); // NIST P-256 curve (secp256r1)

/**
 * Helper to convert a hex string to a byte array.
 * @param {string} hex 
 * @returns {number[]}
 */
function hexToBytes(hex) {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2) {
        bytes.push(parseInt(hex.substr(c, 2), 16));
    }
    return bytes;
}

/**
 * Derives a voter's public key coordinates from their secret passphrase.
 * @param {string} voterSecret - A private key or secret passphrase chosen by the voter.
 * @returns {{x: string, y: string}} public key coordinates in hexadecimal format.
 */
export function deriveVoterPublicKey(voterSecret) {
    if (!voterSecret) return { x: '', y: '' };
    const secretHash = sha256(voterSecret);
    const key = ec.keyFromPrivate(secretHash);
    const pubKey = key.getPublic();
    return {
        x: pubKey.getX().toString(16),
        y: pubKey.getY().toString(16)
    };
}

/**
 * Generates the client-side ZKP proof data for voting.
 * @param {string} voterSecret - A private key or secret passphrase chosen by the voter.
 * @param {string} voteId - The target election uuid.
 * @param {string} challengeHex - The challenge returned by the server's /challenge endpoint.
 */
export async function generateVotingZkp(voterSecret, voteId, challengeHex) {
    // 1. Generate voter keypair
    const secretHash = sha256(voterSecret);
    const key = ec.keyFromPrivate(secretHash);
    const privKey = key.getPrivate();
    const pubKey = key.getPublic();

    // 2. Compute voter's unique nullifier (Deterministic hash of voter secret and vote context)
    // Ensures the voter cannot reuse the same key under a different identity in this specific vote
    const nullifier = sha256(`${secretHash}:${voteId}`);

    // 3. Generate Ephemeral commitment nonce (k) and commitment point R = k * G
    const ephemeralKey = ec.genKeyPair();
    const kVal = ephemeralKey.getPrivate();
    const R = ec.g.mul(kVal);

    // 4. Compute Commitment Hash (SHA-256 of compressed R)
    const rEncodedHex = R.encode('hex', true); // compressed format (e.g. prefix 02 or 03 + X coordinate)
    const rEncodedBytes = hexToBytes(rEncodedHex);
    const commitmentHash = sha256(rEncodedBytes);

    // 5. Parse challenge received from server (c)
    const c = new BN(challengeHex, 16);

    // 6. Compute response scalar s = k + c * x (mod n)
    const n = ec.curve.n;
    const s = kVal.add(c.mul(privKey)).mod(n);

    // Return all properties required by the /cast endpoint
    return {
        nullifier: nullifier,
        commitment_hash: commitmentHash,
        commitment_x: R.getX().toString(16),
        commitment_y: R.getY().toString(16),
        challenge: challengeHex,
        response: s.toString(16),
        public_key_x: pubKey.getX().toString(16),
        public_key_y: pubKey.getY().toString(16)
    };
}
