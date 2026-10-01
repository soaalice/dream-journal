/**
 * Fills the configured database with realistic demo data so the app (feed, explore, stats, notifications) has something to
 * show: 10 users with 5 to 15 dreams each, spread over the past year, with comments, replies and likes between them.
 *
 *   npm run seed-demo                    # add the demo data (does nothing if it is already there)
 *   npm run seed-demo -- --reset         # remove it and create it again
 *   npm run seed-demo -- --remove        # remove all demo data
 *   npm run seed-demo -- --users=6       # a different number of users (1-10)
 *
 * Demo accounts all use emails ending in @demo.dreamjournal.test and share one random password, written to
 * docs/demo-users.md (git-ignored). Real accounts and their data are never touched. The random generator is seeded, so
 * the same command always produces the same data (dates are relative to today).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { loadConfig } from '../config.js';
import Dream from '../models/Dream.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { generatePassword } from './seed-staff.js';

export const DEMO_DOMAIN = 'demo.dreamjournal.test';
const DAY = 24 * 60 * 60 * 1000;

const PEOPLE = [
  'Luna Marchetti', 'Noah Dubois', 'Ines Carvalho', 'Kenji Watanabe', 'Amara Okafor',
  'Elias Novak', 'Sofia Reyes', 'Theo Lindqvist', 'Mei Tanaka', 'Omar Haddad'
];
const BIOS = [
  'Keeping a dream journal since last winter.', 'Lucid dreaming beginner.', 'Night owl. Coffee. Weird dreams.',
  'Writer looking for plot ideas in my sleep.', 'Dreams are the best movies.', '', 'Collecting recurring dreams.', '', 'Trying to remember more.', 'Sleep scientist in training.'
];
const LOCATIONS = ['Lyon', 'Lisbon', 'Osaka', 'Lagos', 'Prague', 'Seville', 'Stockholm', 'Tokyo', 'Marseille', ''];

/** theme -> how it usually feels, and how it is told */
const THEMES = {
  water: {
    moods: ['peaceful', 'scary', 'mysterious'],
    tags: ['water', 'sea'],
    places: ['standing on a quiet beach at dawn', 'swimming in a lake that had no bottom', 'on a small boat in the middle of the ocean', 'walking through a flooded city'],
    events: ['The water was perfectly clear and I could see old doors on the sea floor', 'A huge wave rose slowly behind me and never fell', 'I could breathe underwater without any effort', 'Somebody was singing under the surface'],
    feelings: ['I woke up calm.', 'My heart was pounding when I woke up.', 'It felt like a message I could not read.']
  },
  flying: {
    moods: ['exciting', 'happy', 'peaceful'],
    tags: ['flying', 'sky'],
    places: ['above my childhood town', 'over a field of tall yellow grass', 'high above the clouds at sunset', 'between the skyscrapers of a city I did not know'],
    events: ['I just leaned forward and the ground fell away', 'I could steer by thinking about where to go', 'Everyone below waved at me', 'The wind felt warm and I was laughing'],
    feelings: ['I did not want to wake up.', 'I felt completely free.', 'I could still feel the air on my face.']
  },
  exam: {
    moods: ['anxious', 'confusing'],
    tags: ['school', 'exam'],
    places: ['in a school hallway that kept getting longer', 'at my old desk in a classroom full of strangers', 'in front of an exam paper written in no language'],
    events: ['I had not studied and the clock was running fast', 'The teacher was a person I used to work with', 'I realised I was not wearing shoes', 'All my answers turned into drawings'],
    feelings: ['I woke up relieved it was not real.', 'I was tired all morning.', 'My shoulders were tense when I woke up.']
  },
  house: {
    moods: ['mysterious', 'peaceful', 'confusing'],
    tags: ['house', 'rooms'],
    places: ['in my house but with extra rooms I had never seen', 'in my grandmother\'s kitchen', 'in a house made entirely of glass'],
    events: ['Every door opened onto a different year of my life', 'There was a staircase going down that had not been there before', 'The rooms smelled like rain', 'A cat I did not own showed me around'],
    feelings: ['I felt like I was being shown something.', 'It felt very familiar.', 'I wanted to stay longer.']
  },
  forest: {
    moods: ['mysterious', 'peaceful', 'scary'],
    tags: ['forest', 'night'],
    places: ['in a forest where the trees were whispering', 'on a path lit by tiny blue lights', 'in a clearing under two moons'],
    events: ['The path kept changing every time I looked away', 'An old fox walked next to me for a long time', 'I knew the way but not where it led', 'The trees leaned in to listen'],
    feelings: ['It felt ancient.', 'I woke up with a strange calm.', 'I did not want to look back.']
  },
  chase: {
    moods: ['scary', 'anxious', 'exciting'],
    tags: ['chase', 'running'],
    places: ['in a dark parking garage', 'on a rooftop at night', 'in an endless supermarket'],
    events: ['Something was following me and my legs felt like lead', 'I knew I could not look behind me', 'The exits kept turning into walls', 'I was running but the floor was moving the other way'],
    feelings: ['I woke up breathless.', 'I checked the room before I could go back to sleep.', 'It felt so real.']
  },
  family: {
    moods: ['happy', 'sad', 'peaceful'],
    tags: ['family', 'childhood'],
    places: ['at a long table with everyone I love', 'in the garden of my childhood home', 'at a train station saying goodbye'],
    events: ['Someone who is not here anymore sat next to me and we talked for hours', 'We were all laughing about something I cannot remember', 'My father handed me a letter I never opened', 'It was summer and nobody was in a hurry'],
    feelings: ['I woke up with tears and a smile.', 'I felt warm all day.', 'I wrote down every detail so I would not lose it.']
  },
  city: {
    moods: ['confusing', 'exciting', 'mysterious'],
    tags: ['city', 'travel'],
    places: ['in a city built on top of another city', 'on a night tram that never stopped', 'in a market where every stall sold memories'],
    events: ['I could not read any of the signs but I understood them', 'The map kept redrawing itself', 'A stranger gave me a ticket with my name on it', 'Everyone was heading to the same place'],
    feelings: ['I felt lost and curious at once.', 'I was sure I would find it again.', 'I woke up wanting to travel.']
  },
  animals: {
    moods: ['happy', 'mysterious', 'peaceful'],
    tags: ['animals', 'nature'],
    places: ['in a garden full of impossible animals', 'on a savannah that turned into snow', 'in a library where owls were the librarians'],
    events: ['A giant tortoise let me ride on its back', 'The animals spoke but only in numbers', 'A white deer stood still and looked at me', 'They all gathered quietly as if waiting for me'],
    feelings: ['I felt chosen somehow.', 'It made me smile for hours.', 'I looked up the animal the next morning.']
  },
  falling: {
    moods: ['scary', 'anxious'],
    tags: ['falling', 'night'],
    places: ['from the top of a tall bridge', 'down a staircase with no end', 'off a cliff I had been standing on for a while'],
    events: ['The fall was slow and I had time to think', 'I tried to grab the air', 'Just before the ground I jolted awake', 'Someone called my name on the way down'],
    feelings: ['My whole body twitched when I woke up.', 'I lay still for a long time.', 'I could not fall back asleep.']
  },
  stars: {
    moods: ['peaceful', 'mysterious', 'happy'],
    tags: ['stars', 'space'],
    places: ['on a hill under a sky with far too many stars', 'on a spaceship made of wood', 'on the surface of the moon'],
    events: ['The stars rearranged into words just for me', 'The planet below was breathing slowly', 'Everything was quiet and enormous', 'I could hear the constellations humming'],
    feelings: ['I felt very small and very calm.', 'It was beautiful.', 'I wanted to tell everyone.']
  },
  lost: {
    moods: ['sad', 'confusing'],
    tags: ['lost', 'memory'],
    places: ['in a house I had to leave', 'in an airport waiting for someone', 'at a door I could not open'],
    events: ['I was looking for something and could not remember what', 'The person I was waiting for never came', 'Everything I owned was slowly fading', 'I called out but no sound came'],
    feelings: ['I woke up heavy.', 'It stayed with me all day.', 'I wrote it down to let it go.']
  }
};
const THEME_KEYS = Object.keys(THEMES);

const COMMENTS = [
  'This is such a vivid dream, thanks for sharing it.', 'I had a very similar one last month!', 'The part with the stairs gave me chills.',
  'Wow, you remember so many details.', 'That sounds peaceful in a strange way.', 'I always wake up right before the good part.',
  'Beautiful imagery. You should write this as a story.', 'I think I have had this dream too.', 'What do you think the door means?',
  'Thank you, this made my morning.', 'Lucid dream? You seemed in control.', 'Haha, the shoes detail is so relatable.'
];
const REPLIES = ['Thank you!', 'Exactly, that is how it felt.', 'Interesting, I never thought of it that way.', 'Yes, it stayed with me for days.', 'Let me know if you have it again!'];

// ---------- a small seeded random generator, so the same command makes the same data ----------
const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const makeHelpers = (random) => {
  const int = (min, max) => Math.floor(random() * (max - min + 1)) + min;
  const pick = (list) => list[Math.floor(random() * list.length)];
  const chance = (p) => random() < p;
  const shuffle = (list) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  return { int, pick, chance, shuffle };
};

const AVATAR_EYES = ['cute', 'glasses', 'love', 'plain', 'shades', 'sleepClose', 'stars', 'wink'];
const AVATAR_MOUTH = ['lilSmile', 'plain', 'shy', 'smileLol', 'smileTeeth', 'wideSmile', 'tongueOut'];
const AVATAR_COLORS = ['ffadad', 'ffd6a5', 'fdffb6', 'caffbf', '9bf6ff', 'a0c4ff', 'bdb2ff', 'ffc6ff'];

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** One dream's text, title, mood and tags from a theme. */
const composeDream = (h, theme, favouriteMoods) => {
  const t = THEMES[theme];
  // a person's favourite moods come through, when the theme allows it
  const preferred = t.moods.filter((m) => favouriteMoods.includes(m));
  const mood = h.chance(0.7) && preferred.length ? h.pick(preferred) : h.pick(t.moods);
  const place = h.pick(t.places);
  const content = `I was ${place}. ${h.pick(t.events)}. ${h.chance(0.6) ? `${h.pick(t.events)}. ` : ''}${h.pick(t.feelings)}`;
  const tags = [...new Set([...t.tags, ...(h.chance(0.3) ? [h.pick(THEMES[h.pick(THEME_KEYS)].tags)] : [])])].slice(0, 4);
  const title = capitalise(place.replace(/^(in|on|at|from|over|above|between|down|off) /, ''));
  return { title: title.length > 60 ? `${title.slice(0, 57)}…` : title, content, mood, tags };
};

const todayAt = (daysAgo, hour, minute) => {
  const d = new Date(Date.now() - daysAgo * DAY);
  d.setHours(hour, minute, 0, 0);
  // a dream cannot be recorded in the future: "today" at 23:00 becomes a little while ago
  const latest = Date.now() - 10 * 60 * 1000;
  return d.getTime() > latest ? new Date(latest - (hour * 7 + minute) * 1000) : d;
};

export const removeDemo = async () => {
  const demo = await User.find({ email: new RegExp(`@${DEMO_DOMAIN.replace(/\./g, '\\.')}$`) }).select('_id');
  const ids = demo.map((u) => u._id);
  if (ids.length === 0) return { users: 0, dreams: 0 };
  const dreams = await Dream.deleteMany({ userId: { $in: ids } });
  await Notification.deleteMany({ $or: [{ userId: { $in: ids } }, { actorId: { $in: ids } }] });
  await User.deleteMany({ _id: { $in: ids } });
  return { users: ids.length, dreams: dreams.deletedCount };
};

/**
 * Creates the demo users and their dreams. Returns the accounts (with the shared password) and counts.
 * Does nothing (returns `created: false`) if demo users already exist.
 */
export const seedDemo = async ({ users = 10, seed = 2026 } = {}) => {
  const count = Math.min(10, Math.max(1, users));
  const existing = await User.countDocuments({ email: new RegExp(`@${DEMO_DOMAIN.replace(/\./g, '\\.')}$`) });
  if (existing > 0) return { created: false, existing };

  const h = makeHelpers(rng(seed));
  const password = generatePassword();

  // ---- users ----
  const accounts = [];
  for (let i = 0; i < count; i += 1) {
    const name = PEOPLE[i];
    const user = await User.create({
      name,
      email: `demo${i + 1}@${DEMO_DOMAIN}`,
      password,
      bio: BIOS[i],
      location: LOCATIONS[i],
      avatarUrl: `https://api.dicebear.com/8.x/fun-emoji/svg?eyes=${AVATAR_EYES[i % AVATAR_EYES.length]}&mouth=${AVATAR_MOUTH[(i * 3) % AVATAR_MOUTH.length]}&backgroundColor=${AVATAR_COLORS[i % AVATAR_COLORS.length]}`,
      joinedAt: todayAt(h.int(200, 360), 10, 0)
    });
    accounts.push({ id: user._id, name, email: user.email, dreams: 0, themes: h.shuffle(THEME_KEYS).slice(0, h.int(3, 5)), moods: h.shuffle(['peaceful', 'scary', 'happy', 'anxious', 'mysterious', 'exciting']).slice(0, 2) });
  }

  // ---- dreams ----
  const docs = [];
  accounts.forEach((account, index) => {
    const total = h.int(5, 15);
    const days = new Set();

    // the first user is on a streak, so the stats page has something to celebrate
    if (index === 0) for (let d = 0; d < 6; d += 1) days.add(d);
    // everyone else: mostly recent, some older, spread over about a year
    while (days.size < total) days.add(h.chance(0.55) ? h.int(0, 45) : h.int(46, 340));

    [...days].forEach((daysAgo, n) => {
      const theme = h.chance(0.75) ? h.pick(account.themes) : h.pick(THEME_KEYS);
      const dream = composeDream(h, theme, account.moods);
      const createdAt = todayAt(daysAgo, h.int(5, 23), h.int(0, 59));
      const roll = h.int(1, 100);
      docs.push({
        userId: account.id,
        title: dream.title,
        content: dream.content,
        status: 'published',
        privacyLevel: roll <= 55 ? 'public' : roll <= 85 ? 'private' : 'anonymous',
        tags: dream.tags,
        mood: dream.mood,
        likes: [],
        comments: [],
        mentions: [],
        moderationState: 'visible',
        moderatedAt: null,
        moderatedBy: null,
        moderationMessage: '',
        createdAt,
        updatedAt: createdAt,
        __index: n
      });
    });
    account.dreams = total;

    // about half of the people also have an unfinished draft
    if (h.chance(0.5)) {
      const draft = composeDream(h, h.pick(account.themes), account.moods);
      const createdAt = todayAt(h.int(0, 5), h.int(5, 23), h.int(0, 59));
      docs.push({
        userId: account.id, title: 'Untitled draft', content: draft.content.split('. ')[0], status: 'draft', privacyLevel: 'private',
        tags: [], mood: 'peaceful', likes: [], comments: [], mentions: [], moderationState: 'visible', moderatedAt: null, moderatedBy: null,
        moderationMessage: '', createdAt, updatedAt: createdAt
      });
    }
  });

  // ---- likes, comments and replies on everyone's shared dreams ----
  for (const dream of docs) {
    if (dream.status !== 'published' || dream.privacyLevel === 'private') continue;
    const others = accounts.filter((a) => String(a.id) !== String(dream.userId));
    dream.likes = h.shuffle(others).slice(0, h.int(0, Math.min(6, others.length))).map((a) => a.id);

    const commenters = h.shuffle(others).slice(0, h.int(0, Math.min(3, others.length)));
    for (const commenter of commenters) {
      const parent = {
        _id: new mongoose.Types.ObjectId(),
        content: h.pick(COMMENTS),
        userId: commenter.id,
        parentId: null,
        deleted: false,
        createdAt: new Date(dream.createdAt.getTime() + h.int(1, 48) * 3600 * 1000),
        mentions: [],
        moderationState: 'visible',
        moderatedAt: null,
        moderatedBy: null,
        moderationMessage: ''
      };
      dream.comments.push(parent);
      // the author sometimes answers
      if (h.chance(0.45)) {
        dream.comments.push({
          ...parent,
          _id: new mongoose.Types.ObjectId(),
          content: h.pick(REPLIES),
          userId: dream.userId,
          parentId: parent._id,
          createdAt: new Date(parent.createdAt.getTime() + h.int(1, 24) * 3600 * 1000)
        });
      }
    }
  }

  await Dream.collection.insertMany(docs.map(({ __index, ...doc }) => doc));
  return {
    created: true,
    password,
    accounts: accounts.map(({ name, email, dreams }) => ({ name, email, dreams })),
    dreams: docs.filter((d) => d.status === 'published').length,
    drafts: docs.filter((d) => d.status === 'draft').length,
    comments: docs.reduce((n, d) => n + d.comments.length, 0),
    likes: docs.reduce((n, d) => n + d.likes.length, 0)
  };
};

export const renderDemoCredentials = (result, appUrl = 'http://localhost:5173') =>
  [
    '# Demo accounts',
    '',
    '> Fake data for trying the app. Safe to delete: `npm run seed-demo -- --remove` removes every demo user and their dreams.',
    '> All demo accounts share one password. This file is git-ignored.',
    '',
    `Password for every account: \`${result.password}\``,
    '',
    '| Name | Email | Dreams |',
    '| --- | --- | --- |',
    ...result.accounts.map((a) => `| ${a.name} | \`${a.email}\` | ${a.dreams} |`),
    '',
    `Sign in at ${appUrl}/auth. **${result.accounts[0].name}** (\`${result.accounts[0].email}\`) is on a 6-day streak, a good one for the Insights page.`,
    ''
  ].join('\n');

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const args = process.argv.slice(2);
  const usersArg = Number(args.find((a) => a.startsWith('--users='))?.slice(8));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const out = path.join(root, 'docs', 'demo-users.md');

  const config = loadConfig();
  await mongoose.connect(config.mongoUri);
  console.log('Database:', mongoose.connection.name);

  if (args.includes('--remove') || args.includes('--reset')) {
    const removed = await removeDemo();
    console.log(`Removed ${removed.users} demo users and ${removed.dreams} dreams.`);
    if (args.includes('--remove')) {
      fs.rmSync(out, { force: true });
      await mongoose.disconnect();
      process.exit(0);
    }
  }

  const result = await seedDemo({ users: Number.isFinite(usersArg) && usersArg > 0 ? usersArg : 10 });
  await mongoose.disconnect();

  if (!result.created) {
    console.log(`Demo data is already there (${result.existing} demo users). Use --reset to create it again.`);
  } else {
    console.log(`Created ${result.accounts.length} users, ${result.dreams} dreams, ${result.drafts} drafts, ${result.comments} comments and ${result.likes} likes.`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, renderDemoCredentials(result, config.clientOrigin), { mode: 0o600 });
    console.log(`Accounts and the shared password: ${path.relative(root, out)}`);
  }
}
