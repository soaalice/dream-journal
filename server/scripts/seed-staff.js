/**
 * Creates the staff accounts (administrators and moderators) in the configured database and writes their
 * credentials to a markdown file that is NOT committed to git.
 *
 *   npm run seed-staff                 # create what is missing; existing accounts keep their password
 *   npm run seed-staff -- --reset      # also generate new passwords for the existing accounts
 *   npm run seed-staff -- --out=path   # where to write the credentials (default: docs/staff-credentials.md)
 *
 * Passwords are random (20 characters) and printed nowhere except that file. Change them after the first sign-in.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { loadConfig } from '../config.js';
import User from '../models/User.js';

export const STAFF = [
  { name: 'Admin One', email: 'admin1@dreamjournal.test', role: 'admin' },
  { name: 'Admin Two', email: 'admin2@dreamjournal.test', role: 'admin' },
  { name: 'Moderator One', email: 'moderator1@dreamjournal.test', role: 'moderator' },
  { name: 'Moderator Two', email: 'moderator2@dreamjournal.test', role: 'moderator' }
];

/** 20 random characters that always satisfy the password rules (a letter and a digit). */
export const generatePassword = () => {
  const pick = (chars) => chars[crypto.randomInt(chars.length)];
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; // no look-alikes (I, l, O)
  const digits = '23456789';
  const all = letters + digits;
  const chars = [pick(letters), pick(digits), ...Array.from({ length: 18 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

/**
 * Creates or updates the staff accounts. Returns one result per account:
 * `{ ...account, status: 'created' | 'reset' | 'existing', password? }` (the password is only present when it
 * was just generated).
 */
export const seedStaff = async ({ reset = false, accounts = STAFF } = {}) => {
  const results = [];
  for (const account of accounts) {
    const existing = await User.findOne({ email: account.email }).select('+password');

    if (!existing) {
      const password = generatePassword();
      await User.create({ ...account, password });
      results.push({ ...account, status: 'created', password });
      continue;
    }

    existing.role = account.role;
    existing.suspendedAt = null;
    existing.suspensionReason = '';
    if (reset) {
      const password = generatePassword();
      existing.password = password; // hashed by the model on save
      await existing.save();
      results.push({ ...account, status: 'reset', password });
    } else {
      await existing.save();
      results.push({ ...account, status: 'existing' });
    }
  }
  return results;
};

const ROLE_ABILITIES = {
  admin: 'Everything a moderator can do, plus suspend and unsuspend accounts, the audit log, and authors\' email addresses',
  moderator: 'Review, dismiss and remove reported content. Cannot suspend accounts, see the audit log or emails'
};

export const renderCredentials = (results, { appUrl = 'http://localhost:5173' } = {}) => {
  const fresh = results.filter((r) => r.password);
  const kept = results.filter((r) => !r.password);
  const when = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const lines = [
    `## Staff credentials (generated ${when} UTC)`,
    '',
    '| Role | Name | Email | Password |',
    '| --- | --- | --- | --- |',
    ...fresh.map((r) => `| ${r.role} | ${r.name} | \`${r.email}\` | \`${r.password}\` |`),
    ''
  ];
  if (kept.length) {
    lines.push(
      `Already existed, password unchanged (not shown): ${kept.map((r) => `\`${r.email}\``).join(', ')}.`,
      'Run `npm run seed-staff -- --reset` to generate new passwords for them.',
      ''
    );
  }
  lines.push(`Sign in at ${appUrl}/auth, then open **Moderation** in the header (${appUrl}/admin).`, '');
  return lines.join('\n');
};

export const HEADER = [
  '# Staff credentials',
  '',
  '> **Secret. Do not commit, share or paste this file anywhere.** It is git-ignored; keep it that way.',
  '> Change every password after the first sign-in (Edit profile, Change password), then delete this file.',
  '',
  '## What each role can do',
  '',
  `- **admin**: ${ROLE_ABILITIES.admin}.`,
  `- **moderator**: ${ROLE_ABILITIES.moderator}.`,
  '',
  'Staff sessions last 12 hours. Roles are checked against the database on every request, so they can be changed',
  'at any time with `npm run make-admin -- <email> [--moderator | --revoke]`.',
  ''
].join('\n');

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const outArg = args.find((a) => a.startsWith('--out='))?.slice(6);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const out = path.resolve(root, outArg ?? 'docs/staff-credentials.md');

  const config = loadConfig();
  await mongoose.connect(config.mongoUri);
  const results = await seedStaff({ reset });
  await mongoose.disconnect();

  const fresh = results.filter((r) => r.password);
  for (const r of results) console.log(`${r.status.padEnd(8)} ${r.role.padEnd(10)} ${r.email}`);

  if (fresh.length === 0) {
    console.log('\nNo new passwords were generated, so the credentials file was left untouched.');
  } else {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const section = renderCredentials(results, { appUrl: config.clientOrigin });
    // Never overwrite earlier credentials: a new run adds a new dated section below the old ones.
    const content = fs.existsSync(out) ? `${fs.readFileSync(out, 'utf8').trimEnd()}\n\n${section}` : `${HEADER}\n${section}`;
    fs.writeFileSync(out, content, { mode: 0o600 });
    console.log(`\nCredentials for ${fresh.length} account(s) written to ${path.relative(root, out)}`);
  }
}
