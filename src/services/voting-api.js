import { checkBackendConnection } from './api.js';

const BASE_URL = '/api/v1/voting';

// Get API Key from environment or use local dev default
const API_KEY = import.meta.env.VITE_CRYPTO_API_KEY || 'dev-api-key-sample';

/**
 * Standard fetch helper that includes the bearer token and handles JSON conversion.
 */
async function fetchApi(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        ...(options.headers || {})
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
        throw {
            status: response.status,
            error: data?.status || data?.error || 'API_ERROR',
            message: data?.message || 'Request to voting API failed',
            raw: data
        };
    }

    return data;
}

/**
 * Timezone-robust parser for API datetime strings.
 * Appends 'Z' if the backend returns timezone-naive UTC strings.
 */
export function parseApiDate(dateStr) {
    if (!dateStr) return new Date();
    // If it has no timezone offset or Z suffix, append Z to force UTC parsing
    if (!dateStr.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(dateStr)) {
        return new Date(dateStr + 'Z');
    }
    return new Date(dateStr);
}

// ==========================================
// HIGH-FIDELITY OFFLINE MOCK STORE (LOCAL STORAGE)
// ==========================================

const MOCK_POLLS_KEY = 'zkp_voting_mock_polls';
const MOCK_BALLOTS_KEY = 'zkp_voting_mock_ballots';

function getMockPolls() {
    try {
        return JSON.parse(localStorage.getItem(MOCK_POLLS_KEY)) || {};
    } catch {
        return {};
    }
}

function saveMockPolls(polls) {
    localStorage.setItem(MOCK_POLLS_KEY, JSON.stringify(polls));
}

function getMockBallots() {
    try {
        return JSON.parse(localStorage.getItem(MOCK_BALLOTS_KEY)) || {};
    } catch {
        return {};
    }
}

function saveMockBallots(ballots) {
    localStorage.setItem(MOCK_BALLOTS_KEY, JSON.stringify(ballots));
}

// Populate a default active poll if none exists, just for sandbox testing
const defaultMockPollId = 'demo-election-uuid';
const defaultMockPoll = {
    vote_id: defaultMockPollId,
    title: 'Representative Election (Offline Sandbox)',
    candidates: ['Alice', 'Bob', 'Charlie'],
    expires_at: new Date(Date.now() + 60 * 60000).toISOString(), // 1 hour from now
    delivery_target: 'telegram:sandbox_chat',
    active: true
};

const existingPolls = getMockPolls();
if (!existingPolls[defaultMockPollId]) {
    existingPolls[defaultMockPollId] = defaultMockPoll;
    saveMockPolls(existingPolls);
}

// ==========================================
// API EXPORTS (DUAL-MODE)
// ==========================================

/**
 * Creates a new voting session.
 */
export async function createVotingSession({ title, candidates, duration_minutes, delivery_target }) {
    const isOnline = await checkBackendConnection();
    
    if (isOnline) {
        return fetchApi('/create', {
            method: 'POST',
            body: JSON.stringify({
                title,
                candidates,
                duration_minutes: parseInt(duration_minutes, 10),
                delivery_target: delivery_target || undefined
            })
        });
    }

    // Offline simulation
    await new Promise(resolve => setTimeout(resolve, 1200)); // Sim latency
    const voteId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + duration_minutes * 60 * 1000).toISOString();
    const creatorToken = 'ct_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');

    const newPoll = {
        vote_id: voteId,
        title,
        candidates,
        expires_at: expiresAt,
        delivery_target,
        active: true
    };

    const polls = getMockPolls();
    polls[voteId] = newPoll;
    saveMockPolls(polls);

    return {
        vote_id: voteId,
        expires_at: expiresAt,
        creator_token: creatorToken
    };
}

/**
 * Fetches details about a voting session.
 */
export async function getVotingSessionInfo(voteId) {
    const isOnline = await checkBackendConnection();

    if (isOnline) {
        return fetchApi(`/info/${voteId}`, { method: 'GET' });
    }

    // Offline simulation
    await new Promise(resolve => setTimeout(resolve, 800));
    const polls = getMockPolls();
    const poll = polls[voteId];

    if (!poll) {
        throw {
            status: 404,
            error: 'NOT_FOUND',
            message: `Voting session ${voteId} not found in offline database.`
        };
    }

    const isExpired = new Date(poll.expires_at) <= new Date();

    return {
        vote_id: poll.vote_id,
        title: poll.title,
        candidates: poll.candidates,
        expires_at: poll.expires_at,
        active: !isExpired
    };
}

/**
 * Requests a secure cryptographic challenge from the server.
 */
export async function requestChallenge({ vote_id, nullifier, public_key_x, public_key_y }) {
    const isOnline = await checkBackendConnection();

    if (isOnline) {
        return fetchApi('/challenge', {
            method: 'POST',
            body: JSON.stringify({ vote_id, nullifier, public_key_x, public_key_y })
        });
    }

    // Offline simulation
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Check if the nullifier already voted in local storage to simulate double voting rejection
    const ballots = getMockBallots();
    const pollBallots = ballots[vote_id] || [];
    const alreadyVoted = pollBallots.some(b => b.nullifier === nullifier);

    if (alreadyVoted) {
        throw {
            status: 400,
            error: 'DOUBLE_VOTING_PREVENTED',
            message: 'Double voting prevented: Public key nullifier already marked as spent.'
        };
    }

    // Generate random 256-bit challenge scalar in hex format
    const randBytes = crypto.getRandomValues(new Uint8Array(32));
    const challenge = Array.from(randBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    return { challenge };
}

/**
 * Casts a ballot with the ZKP Schnorr Proof.
 */
export async function castBallot(ballotData) {
    const isOnline = await checkBackendConnection();

    if (isOnline) {
        return fetchApi('/cast', {
            method: 'POST',
            body: JSON.stringify(ballotData)
        });
    }

    // Offline simulation
    await new Promise(resolve => setTimeout(resolve, 1500));
    const { vote_id, nullifier, candidate_id } = ballotData;

    // Save ballot to local storage
    const ballots = getMockBallots();
    if (!ballots[vote_id]) ballots[vote_id] = [];
    
    // Check double vote again
    const alreadyVoted = ballots[vote_id].some(b => b.nullifier === nullifier);
    if (alreadyVoted) {
        throw {
            status: 400,
            error: 'DOUBLE_VOTING_PREVENTED',
            message: 'Double voting prevented: Public key nullifier already marked as spent.'
        };
    }

    ballots[vote_id].push({
        candidate_id: candidate_id.toLowerCase(),
        commitment_hash: ballotData.commitment_hash,
        commitment_x: ballotData.commitment_x,
        commitment_y: ballotData.commitment_y,
        challenge: ballotData.challenge,
        response: ballotData.response,
        public_key_x: ballotData.public_key_x,
        public_key_y: ballotData.public_key_y,
        nullifier: nullifier
    });
    saveMockBallots(ballots);

    return {
        status: 'VOTE_CAST_SUCCESSFULLY'
    };
}

/**
 * Fetches final tallies and verification audit packages.
 */
export async function getVotingResults(voteId) {
    const isOnline = await checkBackendConnection();

    if (isOnline) {
        // GET results endpoint
        const url = `${BASE_URL}/results/${voteId}`;
        const headers = { 'Authorization': `Bearer ${API_KEY}` };
        const response = await fetch(url, { headers });
        const data = await response.json();

        if (response.status === 400 && data.status === 'VOTING_IN_PROGRESS') {
            throw {
                status: 400,
                error: 'VOTING_IN_PROGRESS',
                message: data.message || 'Voting is still active.',
                expires_at: data.expires_at || new Date().toISOString()
            };
        }

        if (!response.ok) {
            throw {
                status: response.status,
                error: data.status || data.error || 'API_ERROR',
                message: data.message || 'Failed to fetch results'
            };
        }

        return data;
    }

    // Offline simulation
    await new Promise(resolve => setTimeout(resolve, 1000));
    const polls = getMockPolls();
    const poll = polls[voteId];

    if (!poll) {
        throw {
            status: 404,
            error: 'NOT_FOUND',
            message: `Voting session ${voteId} not found.`
        };
    }

    const isExpired = new Date(poll.expires_at) <= new Date();

    if (!isExpired) {
        throw {
            status: 400,
            error: 'VOTING_IN_PROGRESS',
            message: `Voting is still active. Results will unlock at ${new Date(poll.expires_at).toLocaleString()}`,
            expires_at: poll.expires_at
        };
    }

    // Compile results from local storage
    const ballots = getMockBallots();
    const pollBallots = ballots[voteId] || [];

    // Initialize tallies
    const tallies = {};
    poll.candidates.forEach(cand => {
        tallies[cand.toLowerCase()] = 0;
    });

    // Count votes
    pollBallots.forEach(ballot => {
        const cand = ballot.candidate_id.toLowerCase();
        if (tallies[cand] !== undefined) {
            tallies[cand]++;
        } else {
            tallies[cand] = 1;
        }
    });

    const totalVotes = pollBallots.length;

    // Generate markdown verification guide
    const guideMarkdown = `# Cryptographic Election Audit Report (Offline Sandbox)

This audit report allows public verification of the election: **${poll.title}**.
Because this is running in client-side fallback mode, all proofs were recorded in your browser's \`localStorage\`.

## Election Metadata
- **Election Name:** ${poll.title}
- **Election ID:** \`${poll.vote_id}\`
- **Expiry Timestamp:** ${poll.expires_at}
- **Total Registered Ballots:** ${totalVotes}

## Candidate Tallies
${poll.candidates.map(cand => `- **${cand}:** ${tallies[cand.toLowerCase()] || 0} votes`).join('\n')}

## Cryptographic Setup (secp256r1)
The election utilizes Schnorr Proofs of Knowledge over the NIST P-256 Elliptic Curve.
For each ballot, the client generates a proof showing they hold the private key $x$ corresponding to their public key $Y = x \\cdot G$, relative to a deterministic double-voting nullifier:
$$\\text{nullifier} = \\text{SHA256}(x \\parallel \\text{voteId})$$

Verification equation for each cast ballot:
$$s \\cdot G \\stackrel{?}{=} R + c \\cdot Y$$
Where:
- $G$ is the standard curve base generator point.
- $Y$ is the voter's public key point \`(public_key_x, public_key_y)\`.
- $R$ is the commitment point recovered from \`commitment_hash\` / coordinates.
- $c$ is the server-issued random challenge scalar \`challenge\`.
- $s$ is the response scalar \`response\` ($s = k + c \\cdot x \\pmod n$).

## Audit Verification Steps
1. Download the raw **Audit Package** containing all nullifiers and proof parameters.
2. For each ballot in the package, parse the coordinates $Y = (x_y, y_y)$ and $R = (r_x, r_y)$.
3. Check that $R$ matches the hashed commitment \`commitment_hash = SHA256(compressed(R))\`.
4. Validate the response scalar relation $s \\cdot G = R + c \\cdot Y$ on the curve.
5. Check for double-voting: ensure the list of \`nullifiers\` contains no duplicates.
`;

    // Package the audit data
    const auditPackage = {
        candidates: poll.candidates,
        nullifiers: pollBallots.map(b => b.nullifier),
        ballots: pollBallots.map(b => ({
            candidate_id: b.candidate_id,
            commitment_hash: b.commitment_hash,
            public_key_x: b.public_key_x,
            public_key_y: b.public_key_y,
            challenge: b.challenge,
            response: b.response
        }))
    };

    return {
        status: 'COMPLETED',
        title: poll.title,
        expires_at: poll.expires_at,
        tallies,
        total_votes: totalVotes,
        audit_package: auditPackage,
        verification_guide: guideMarkdown
    };
}
