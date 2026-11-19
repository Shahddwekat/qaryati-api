// Large dataset for performance tests (k6). NOT real data.
//
//   npx prisma db seed              (first: users, sources, governorates)
//   npm run perf:seed               (adds 5,000 test villages)
//   npm run perf:seed -- --clean    (removes them again)
//
// Optional: PERF_VILLAGES=20000 npm run perf:seed
//
// Heritage data: about 1 village in 10 gets a landmark, a cultural trait, an economic
// activity and a facility, and every 50th village a historical event that is shared
// with the next village. The rest have empty heritage lists, like most real villages
// at the start. All of it is removed again by --clean.
//
// Test villages use ids from 10001 upwards, so they never collide with the
// development seed. Running it again first removes the old test villages, so
// the result is always the same (the random generator has a fixed start value).

import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  CulturalCategory,
  DatePrecision,
  EconomicType,
  EventCategory,
  FacilityStatus,
  FacilityType,
  Importance,
  LandmarkCondition,
  LandmarkType,
  NameLanguage,
  NameType,
  PrismaClient,
  VerificationStatus,
} from '../src/generated/prisma/client';

export const PERF_FIRST_ID = 10001;
const COUNT = Number(process.env.PERF_VILLAGES ?? 5000);
const CHUNK = 1000;
// One village in HERITAGE_EVERY gets heritage rows; one in EVENT_EVERY gets an event.
const HERITAGE_EVERY = 10;
const EVENT_EVERY = 50;
// Marks the test events (they are not linked to a village by a column, so --clean finds them by this).
const EVENT_TITLE = 'Performance test event';
const NOT_REAL = 'Performance test data, not real.';

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
  // Heritage first: it points to the villages. Deleting the events also deletes
  // their links to villages (ON DELETE CASCADE).
  await prisma.historicalEvent.deleteMany({
    where: { title: { startsWith: EVENT_TITLE } },
  });
  await prisma.landmark.deleteMany({ where });
  await prisma.culturalTrait.deleteMany({ where });
  await prisma.economicActivity.deleteMany({ where });
  await prisma.facility.deleteMany({ where });
  // k6 write tests (population-write.js) also leave audit rows for the records they
  // created and verified; remove those together with the records.
  const records = await prisma.populationRecord.findMany({
    where,
    select: { id: true },
  });
  for (let i = 0; i < records.length; i += 1000) {
    await prisma.auditLog.deleteMany({
      where: {
        entityType: 'population_record',
        entityId: { in: records.slice(i, i + 1000).map((r) => r.id) },
      },
    });
  }
  await prisma.populationRecord.deleteMany({ where });
  await prisma.villageName.deleteMany({ where });
  await prisma.village.deleteMany({ where: { id: { gte: PERF_FIRST_ID } } });
  // After deleting thousands of names, MySQL's full-text index can stop finding
  // names added later (the e2e search tests then fail). Rebuilding it fixes that.
  await prisma.$queryRawUnsafe('OPTIMIZE TABLE village_names');
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
  let heritage = 0;
  for (let start = 0; start < COUNT; start += CHUNK) {
    const villages = [];
    const villageNames = [];
    const records = [];
    const landmarks = [];
    const traits = [];
    const activities = [];
    const facilities = [];
    const eventVillageIds: number[][] = [];

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

      // Heritage: by position, not with random(), so the villages and names above
      // stay exactly as they were before heritage was added to this file.
      if (i % HERITAGE_EVERY === 0) {
        const heritageBase = {
          villageId: id,
          sourceId: source.id,
          submittedById: contributor.id,
          verifiedById: verifier.id,
          verifiedAt: verified.verifiedAt,
        };
        landmarks.push({
          ...heritageBase,
          status: VerificationStatus.VERIFIED,
          nameAr: `معلم ${root.ar} ${i + 1}`,
          nameEn: `${root.en} landmark ${i + 1}`,
          type: LandmarkType.SPRING,
          description: NOT_REAL,
          currentCondition: LandmarkCondition.GOOD,
        });
        traits.push({
          ...heritageBase,
          status: VerificationStatus.VERIFIED,
          category: CulturalCategory.FOOD,
          title: `${root.en} dish ${i + 1}`,
          description: NOT_REAL,
        });
        activities.push({
          ...heritageBase,
          status: VerificationStatus.VERIFIED,
          type: EconomicType.AGRICULTURE,
          name: `${root.en} harvest ${i + 1}`,
          description: NOT_REAL,
          importance: Importance.MAIN,
        });
        facilities.push({
          ...heritageBase,
          verificationStatus: VerificationStatus.VERIFIED,
          type: FacilityType.SCHOOL,
          name: `${root.en} school ${i + 1}`,
          status: FacilityStatus.ACTIVE,
        });
      }
      if (i % EVENT_EVERY === 0) {
        // An event shared by this village and the next one (if it is a test village).
        eventVillageIds.push(i + 1 < COUNT ? [id, id + 1] : [id]);
      }
    }

    await prisma.village.createMany({ data: villages });
    await prisma.villageName.createMany({ data: villageNames });
    await prisma.populationRecord.createMany({ data: records });
    await prisma.landmark.createMany({ data: landmarks });
    await prisma.culturalTrait.createMany({ data: traits });
    await prisma.economicActivity.createMany({ data: activities });
    await prisma.facility.createMany({ data: facilities });
    // Events need their links to villages, so they are created one by one (few of them).
    for (const villageIds of eventVillageIds) {
      await prisma.historicalEvent.create({
        data: {
          title: `${EVENT_TITLE} ${villageIds[0]}`,
          description: NOT_REAL,
          category: EventCategory.SOCIAL,
          datePrecision: DatePrecision.YEAR,
          yearFrom: 1948,
          sourceId: source.id,
          status: VerificationStatus.VERIFIED,
          submittedById: contributor.id,
          verifiedById: verifier.id,
          verifiedAt: verified.verifiedAt,
          villages: {
            create: villageIds.map((villageId) => ({ villageId })),
          },
        },
      });
    }
    names += villageNames.length;
    population += records.length;
    heritage +=
      landmarks.length +
      traits.length +
      activities.length +
      facilities.length +
      eventVillageIds.length;
    console.log(`  ${Math.min(start + CHUNK, COUNT)} / ${COUNT} villages`);
  }

  console.log(
    `Added ${COUNT} test villages (ids ${PERF_FIRST_ID}-${PERF_FIRST_ID + COUNT - 1}), ` +
      `${names} names, ${population} population records, ${heritage} heritage rows.\n` +
      'Remove them before running the e2e tests: npm run perf:seed -- --clean',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
