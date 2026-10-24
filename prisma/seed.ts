// Development seed data for Qaryati.
//
// Run with:  npx prisma db seed
// Safe to run more than once: every row is upserted on a unique key.
//
// IMPORTANT: villages use approximate coordinates, and all population figures are
// SAMPLE values attributed to SAMPLE sources. They are for local development and
// tests only, not real data.

import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  NameLanguage,
  NameType,
  PrismaClient,
  SourceType,
  UserRole,
  VerificationStatus,
} from '../src/generated/prisma/client';

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

// The 16 Palestinian governorates.
const GOVERNORATES: { nameAr: string; nameEn: string }[] = [
  { nameAr: 'جنين', nameEn: 'Jenin' },
  { nameAr: 'طوباس', nameEn: 'Tubas' },
  { nameAr: 'طولكرم', nameEn: 'Tulkarm' },
  { nameAr: 'نابلس', nameEn: 'Nablus' },
  { nameAr: 'قلقيلية', nameEn: 'Qalqilya' },
  { nameAr: 'سلفيت', nameEn: 'Salfit' },
  { nameAr: 'رام الله والبيرة', nameEn: 'Ramallah and Al-Bireh' },
  { nameAr: 'أريحا والأغوار', nameEn: 'Jericho and Al-Aghwar' },
  { nameAr: 'القدس', nameEn: 'Jerusalem' },
  { nameAr: 'بيت لحم', nameEn: 'Bethlehem' },
  { nameAr: 'الخليل', nameEn: 'Hebron' },
  { nameAr: 'شمال غزة', nameEn: 'North Gaza' },
  { nameAr: 'غزة', nameEn: 'Gaza' },
  { nameAr: 'دير البلح', nameEn: 'Deir al-Balah' },
  { nameAr: 'خان يونس', nameEn: 'Khan Yunis' },
  { nameAr: 'رفح', nameEn: 'Rafah' },
];

// One account per role. Same password for all (local development only).
const USERS: { email: string; fullName: string; role: UserRole }[] = [
  { email: 'admin@qaryati.local', fullName: 'Admin User', role: UserRole.ADMIN },
  { email: 'verifier@qaryati.local', fullName: 'Verifier User', role: UserRole.VERIFIER },
  { email: 'contributor@qaryati.local', fullName: 'Contributor User', role: UserRole.CONTRIBUTOR },
];

// Coordinates are approximate.
const VILLAGES: {
  id: number;
  nameAr: string;
  nameEn: string;
  governorateEn: string;
  latitude: number;
  longitude: number;
}[] = [
  { id: 1, nameAr: 'سبسطية', nameEn: 'Sebastia', governorateEn: 'Nablus', latitude: 32.2764, longitude: 35.1958 },
  { id: 2, nameAr: 'برقة', nameEn: 'Burqa', governorateEn: 'Nablus', latitude: 32.3006, longitude: 35.1897 },
  { id: 3, nameAr: 'كفر قدوم', nameEn: 'Kafr Qaddum', governorateEn: 'Qalqilya', latitude: 32.215, longitude: 35.13 },
  { id: 4, nameAr: 'جفنا', nameEn: 'Jifna', governorateEn: 'Ramallah and Al-Bireh', latitude: 31.964, longitude: 35.215 },
  { id: 5, nameAr: 'الطيبة', nameEn: 'Taybeh', governorateEn: 'Ramallah and Al-Bireh', latitude: 31.956, longitude: 35.3 },
  { id: 6, nameAr: 'بتير', nameEn: 'Battir', governorateEn: 'Bethlehem', latitude: 31.73, longitude: 35.136 },
];

async function main(): Promise<void> {
  // 1. Governorates
  const governorateIds = new Map<string, number>();
  for (const g of GOVERNORATES) {
    const row = await prisma.governorate.upsert({
      where: { nameEn: g.nameEn },
      update: { nameAr: g.nameAr },
      create: g,
    });
    governorateIds.set(g.nameEn, row.id);
  }

  // 2. Users
  const password = process.env.SEED_USER_PASSWORD ?? 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);
  const userIds = new Map<UserRole, number>();
  for (const u of USERS) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role },
      create: { ...u, passwordHash },
    });
    userIds.set(u.role, row.id);
  }
  const contributorId = userIds.get(UserRole.CONTRIBUTOR)!;
  const verifierId = userIds.get(UserRole.VERIFIER)!;

  // 3. Sources (two sample sources, so we can show conflicting values)
  const sampleSourceA = await prisma.source.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      type: SourceType.OTHER,
      title: 'Sample source A (development data, not real)',
      year: 2017,
      createdBy: contributorId,
    },
  });
  const sampleSourceB = await prisma.source.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      type: SourceType.OTHER,
      title: 'Sample source B (development data, not real)',
      year: 2018,
      createdBy: contributorId,
    },
  });

  // 4. Villages, each with a verified Arabic and English name
  const verified = {
    status: VerificationStatus.VERIFIED,
    submittedById: contributorId,
    verifiedById: verifierId,
    verifiedAt: new Date(),
  };

  for (const v of VILLAGES) {
    const { governorateEn, ...village } = v;
    await prisma.village.upsert({
      where: { id: v.id },
      update: {},
      create: { ...village, governorateId: governorateIds.get(governorateEn)! },
    });

    const names = [
      { name: v.nameAr, language: NameLanguage.AR, type: NameType.CURRENT },
      { name: v.nameEn, language: NameLanguage.EN, type: NameType.ENGLISH },
    ];
    for (const n of names) {
      await prisma.villageName.upsert({
        where: { villageId_name_type: { villageId: v.id, name: n.name, type: n.type } },
        update: {},
        create: { ...n, villageId: v.id, isPreferred: true, ...verified },
      });
    }
  }

  // 5. Population: a conflict example for Sebastia (two sources disagree about 2017,
  //    one is preferred) and one pending record waiting for a verifier.
  const population = [
    { villageId: 1, year: 2017, population: 3200, sourceId: sampleSourceA.id, isPreferred: true, ...verified },
    { villageId: 1, year: 2017, population: 3350, sourceId: sampleSourceB.id, isPreferred: null, ...verified },
    {
      villageId: 2,
      year: 2017,
      population: 4100,
      sourceId: sampleSourceA.id,
      isPreferred: null,
      status: VerificationStatus.PENDING,
      submittedById: contributorId,
    },
  ];
  for (const p of population) {
    await prisma.populationRecord.upsert({
      where: { villageId_year_sourceId: { villageId: p.villageId, year: p.year, sourceId: p.sourceId } },
      update: {},
      create: { ...p, notes: 'Sample value for development, not a real figure.' },
    });
  }

  console.log(
    `Seeded ${GOVERNORATES.length} governorates, ${USERS.length} users, 2 sources, ` +
      `${VILLAGES.length} villages, ${population.length} population records.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
