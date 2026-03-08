#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const execFileAsync = promisify(execFile);
const subtle = webcrypto.subtle;
const enc = new TextEncoder();
const servicePrefix = 'mexxie';
const account = process.env.MEXXIE_KEYCHAIN_ACCOUNT || process.env.USER || 'mexx';

function u8ToB64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

async function readKeychain(service) {
  const { stdout } = await execFileAsync('security', [
    'find-generic-password',
    '-a', account,
    '-s', `${servicePrefix}.${service}`,
    '-w',
  ]);
  return stdout.trim();
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
  finnhubKey: await readKeychain('finnhub'),
  twelveKey: await readKeychain('twelvedata'),
  apiKey: await readKeychain('fmp'),
  eodhKey: await readKeychain('eodhd'),
};

const passphrase = process.env.VAULT_PASSPHRASE || await promptPassphrase();
const vault = await encryptPayload(payload, passphrase);
await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, JSON.stringify(vault, null, 2));
console.log(`Encrypted vault written to ${outFile}`);
