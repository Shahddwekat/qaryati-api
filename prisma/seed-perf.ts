// Large dataset for performance tests (k6). NOT real data.
//
//   npx prisma db seed              (first: users, sources, governorates)
//   npm run perf:seed               (adds 5,000 test villages)
//   npm run perf:seed -- --clean    (removes them again)
//
// Optional: PERF_VILLAGES=20000 npm run perf:seed
//
// Test villages use ids from 10001 upwards, so they never collide with the
// development seed. Running it again first removes the old test villages, so
// the result is always the same (the random generator has a fixed start value).

import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  NameLanguage,
  NameType,
  PrismaClient,
  VerificationStatus,
} from '../src/generated/prisma/client';

export const PERF_FIRST_ID = 10001;
const COUNT = Number(process.env.PERF_VILLAGES ?? 5000);
const CHUNK = 1000;

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
  }),
});

// Small deterministic random generator, so every run creates the same data.
let state = 20261201;
function random(): number {
  state = (state * 1103515245 + 12345) % 2147483648;
  return state / 2147483648;
}
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => min + random() * (max - min);

// Name parts that look like real place names, so full-text search has
// realistic, repeated words to work with.
const PREFIXES = [
  { ar: 'كفر', en: 'Kafr' },
  { ar: 'بيت', en: 'Beit' },
  { ar: 'دير', en: 'Deir' },
  { ar: 'عين', en: 'Ein' },
  { ar: 'خربة', en: 'Khirbet' },
  { ar: 'تل', en: 'Tell' },
  { ar: 'أم', en: 'Umm' },
  { ar: 'جبل', en: 'Jabal' },
] as const;
const ROOTS = [
  { ar: 'الزيتون', en: 'Zaytoun' },
  { ar: 'الرمان', en: 'Rumman' },
  { ar: 'السنديان', en: 'Sindyan' },
  { ar: 'الخروب', en: 'Kharrub' },
  { ar: 'الطيون', en: 'Tayyun' },
  { ar: 'النخيل', en: 'Nakhil' },
  { ar: 'العنب', en: 'Inab' },
  { ar: 'الجوز', en: 'Jawz' },
  { ar: 'الصفصاف', en: 'Safsaf' },
  { ar: 'البلوط', en: 'Ballut' },
  { ar: 'الريحان', en: 'Rayhan' },
  { ar: 'الحمام', en: 'Hammam' },
] as const;
const OLD_NAMES = ['Gibea', 'Bethel', 'Shiloh', 'Gophna', 'Anathoth', 'Emmaus'];

// Approximate West Bank area.
const LAT = [31.35, 32.55] as const;
const LNG = [34.95, 35.55] as const;

async function clean(): Promise<void> {
  const where = { villageId: { gte: PERF_FIRST_ID } };
  await prisma.populationRecord.deleteMany({ where });
  await prisma.villageName.deleteMany({ where });
  await prisma.village.deleteMany({ where: { id: { gte: PERF_FIRST_ID } } });
}

async function main(): Promise<void> {
  await clean();
  if (process.argv.includes('--clean')) {
    console.log('Removed the performance test villages.');
    return;
  }

  const contributor = await prisma.user.findUnique({
    where: { email: 'contributor@qaryati.local' },
  });
  const verifier = await prisma.user.findUnique({
    where: { email: 'verifier@qaryati.local' },
  });
  const governorates = await prisma.governorate.findMany({
    select: { id: true },
  });
  const source = await prisma.source.findUnique({ where: { id: 1 } });
  if (!contributor || !verifier || !source || governorates.length === 0) {
    throw new Error('Run the development seed first: npx prisma db seed');
  }

  const verified = {
    status: VerificationStatus.VERIFIED,
    submittedById: contributor.id,
    verifiedById: verifier.id,
    verifiedAt: new Date(),
  };

  let names = 0;
  let population = 0;
  for (let start = 0; start < COUNT; start += CHUNK) {
    const villages = [];
    const villageNames = [];
    const records = [];

    for (let i = start; i < Math.min(start + CHUNK, COUNT); i++) {
      const id = PERF_FIRST_ID + i;
      const prefix = pick(PREFIXES);
      const root = pick(ROOTS);
      const nameAr = `${prefix.ar} ${root.ar} ${i + 1}`;
      const nameEn = `${prefix.en} ${root.en} ${i + 1}`;

      villages.push({
        id,
        nameAr,
        nameEn,
        governorateId: pick(governorates).id,
        latitude: between(...LAT).toFixed(6),
        longitude: between(...LNG).toFixed(6),
      });

      villageNames.push(
        {
          villageId: id,
          name: nameAr,
          language: NameLanguage.AR,
          type: NameType.CURRENT,
          isPreferred: true,
          ...verified,
        },
        {
          villageId: id,
          name: nameEn,
          language: NameLanguage.EN,
          type: NameType.ENGLISH,
          isPreferred: true,
          ...verified,
        },
      );
      // About one village in three also has a historical name.
      if (random() < 0.3) {
        villageNames.push({
          villageId: id,
          name: `${pick(OLD_NAMES)} ${root.en}`,
          language: NameLanguage.EN,
          type: NameType.HISTORICAL,
          sourceId: source.id,
          isPreferred: null,
          ...verified,
        });
      }

      const base = Math.round(between(300, 15000));
      for (const [year, factor] of [
        [2007, 0.8],
        [2017, 1],
      ] as const) {
        records.push({
          villageId: id,
          year,
          population: Math.round(base * factor),
          sourceId: source.id,
          isPreferred: true,
          notes: 'Performance test data, not real.',
          ...verified,
        });
      }
    }

    await prisma.village.createMany({ data: villages });
    await prisma.villageName.createMany({ data: villageNames });
    await prisma.populationRecord.createMany({ data: records });
    names += villageNames.length;
    population += records.length;
    console.log(`  ${Math.min(start + CHUNK, COUNT)} / ${COUNT} villages`);
  }

  console.log(
    `Added ${COUNT} test villages (ids ${PERF_FIRST_ID}-${PERF_FIRST_ID + COUNT - 1}), ` +
      `${names} names, ${population} population records.\n` +
      'Remove them before running the e2e tests: npm run perf:seed -- --clean',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
