#!/usr/bin/env node
import { webcrypto } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const subtle = webcrypto.subtle;
const enc = new TextEncoder();

function u8ToB64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

async function deriveVaultKey(passphrase, salt) {
  const baseKey = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
}

async function encryptPayload(payload, passphrase) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const key = await deriveVaultKey(passphrase, salt);
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(payload))
  );
  return {
    v: 1,
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 210000,
    salt: u8ToB64(salt),
    iv: u8ToB64(iv),
    ciphertext: u8ToB64(new Uint8Array(ciphertext)),
  };
}

async function promptPassphrase() {
  const rl = readline.createInterface({ input, output });
  try {
    const p1 = (await rl.question('Vault passphrase: ')).trim();
    const p2 = (await rl.question('Confirm passphrase: ')).trim();
    if (!p1 || p1 !== p2) throw new Error('Passphrases did not match.');
    return p1;
  } finally {
    rl.close();
  }
}

const outFile = process.argv[2] || path.join(os.homedir(), '.mexxie', 'mexxie-key-vault.json');
const payload = {
  provider: process.env.MEXXIE_PROVIDER || 'eodhd',
  finnhubKey: process.env.FINNHUB_KEY || '',
  twelveKey: process.env.TWELVEDATA_KEY || '',
  apiKey: process.env.FMP_KEY || '',
  eodhKey: process.env.EODHD_KEY || '',
};

if (!payload.finnhubKey || !payload.twelveKey || !payload.apiKey || !payload.eodhKey) {
  console.error('Missing one or more required env vars: FINNHUB_KEY, TWELVEDATA_KEY, FMP_KEY, EODHD_KEY');
  process.exit(1);
}

const passphrase = process.env.VAULT_PASSPHRASE || await promptPassphrase();
const vault = await encryptPayload(payload, passphrase);
await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, JSON.stringify(vault, null, 2));
console.log(`Encrypted vault written to ${outFile}`);
