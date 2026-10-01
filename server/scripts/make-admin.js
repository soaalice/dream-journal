/**
 * Grant or revoke staff rights from the command line:
 *
 *   npm run make-admin -- someone@example.com               # administrator
 *   npm run make-admin -- someone@example.com --moderator   # moderator (handles reports, no suspensions)
 *   npm run make-admin -- someone@example.com --revoke      # back to a regular user
 *
 * This is deliberately the only way to create staff: there is no API for it, and the role is never taken from
 * a request, a token, or an email address typed at registration. The account must already exist.
 */
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { loadConfig } from '../config.js';
import User from '../models/User.js';

/** Returns the updated user, or null when no account has that email. */
export const setRole = async (email, role) =>
  User.findOneAndUpdate({ email: String(email).trim().toLowerCase() }, { role }, { new: true });

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const role = revoke ? 'user' : args.includes('--moderator') ? 'moderator' : 'admin';
  const email = args.find((a) => !a.startsWith('--'));

  if (!email) {
    console.error('Usage: npm run make-admin -- <email> [--moderator | --revoke]');
    process.exit(1);
  }

  await mongoose.connect(loadConfig().mongoUri);
  const user = await setRole(email, role);
  await mongoose.disconnect();

  if (!user) {
    console.error(`No account with the email ${email}. Register it first, then run this again.`);
    process.exit(1);
  }
  const label = { admin: 'an administrator', moderator: 'a moderator', user: 'a regular user' }[user.role];
  console.log(`${user.name} <${user.email}> is now ${label}.`);
}
