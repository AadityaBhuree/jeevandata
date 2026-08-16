import { PrismaClient, SessionStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

// Dev/demo credentials — override via env when seeding non-local environments.
// The default passwords are documented in README; never use them in production.
const SEED_PASSWORDS = {
  doctor: process.env.SEED_DOCTOR_PASSWORD ?? 'Doctor@123',
  receptionist: process.env.SEED_RECEPTION_PASSWORD ?? 'Reception@123',
  admin: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123',
};

async function main() {
  console.log('🌱 Seeding Jeevandata database...');

  // ─── Clinic (multi-tenancy root) ──────────────────────────────
  const clinic = await prisma.clinic.upsert({
    where: { code: 'JVD-DEMO' },
    update: { name: 'Jeevandata Demo Clinic', isActive: true },
    create: {
      name: 'Jeevandata Demo Clinic',
      code: 'JVD-DEMO',
      address: '123 Health Street, Pune, Maharashtra',
      phone: '+91-20-4123-4567',
      email: 'clinic@jeevandata.com',
    },
  });
  console.log(`  ✓ Clinic: ${clinic.name} (${clinic.id})`);

  // ─── Clinic Users (real bcrypt hashes — login-able) ──────────
  const doctor = await prisma.clinicUser.upsert({
    where: { email: 'doctor@jeevandata.com' },
    update: {
      passwordHash: await bcrypt.hash(SEED_PASSWORDS.doctor, BCRYPT_ROUNDS),
      name: 'Dr. Priya Sharma',
      role: UserRole.DOCTOR,
      clinicId: clinic.id,
      isActive: true,
    },
    create: {
      email: 'doctor@jeevandata.com',
      passwordHash: await bcrypt.hash(SEED_PASSWORDS.doctor, BCRYPT_ROUNDS),
      name: 'Dr. Priya Sharma',
      role: UserRole.DOCTOR,
      clinicId: clinic.id,
    },
  });

  const receptionist = await prisma.clinicUser.upsert({
    where: { email: 'reception@jeevandata.com' },
    update: {
      passwordHash: await bcrypt.hash(SEED_PASSWORDS.receptionist, BCRYPT_ROUNDS),
      name: 'Anita Verma',
      role: UserRole.RECEPTIONIST,
      clinicId: clinic.id,
      isActive: true,
    },
    create: {
      email: 'reception@jeevandata.com',
      passwordHash: await bcrypt.hash(SEED_PASSWORDS.receptionist, BCRYPT_ROUNDS),
      name: 'Anita Verma',
      role: UserRole.RECEPTIONIST,
      clinicId: clinic.id,
    },
  });

  const admin = await prisma.clinicUser.upsert({
    where: { email: 'admin@jeevandata.com' },
    update: {
      passwordHash: await bcrypt.hash(SEED_PASSWORDS.admin, BCRYPT_ROUNDS),
      name: 'System Administrator',
      role: UserRole.ADMIN,
      clinicId: clinic.id,
      isActive: true,
    },
    create: {
      email: 'admin@jeevandata.com',
      passwordHash: await bcrypt.hash(SEED_PASSWORDS.admin, BCRYPT_ROUNDS),
      name: 'System Administrator',
      role: UserRole.ADMIN,
      clinicId: clinic.id,
    },
  });

  console.log(
    `  ✓ Users: ${doctor.name} (DOCTOR), ${receptionist.name} (RECEPTIONIST), ${admin.name} (ADMIN)`,
  );

  // ─── Sample Patients ──────────────────────────────────────────
  const patient1 = await prisma.patient.upsert({
    where: { mobile: '+919876543210' },
    update: { clinicId: clinic.id, consentGranted: true },
    create: {
      name: 'Rajesh Kumar',
      dob: new Date('1985-06-15'),
      mobile: '+919876543210',
      consentGranted: true,
      clinicId: clinic.id,
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { mobile: '+919876543211' },
    update: { clinicId: clinic.id, consentGranted: true },
    create: {
      name: 'Sunita Patel',
      dob: new Date('1992-11-23'),
      mobile: '+919876543211',
      consentGranted: true,
      clinicId: clinic.id,
    },
  });

  console.log(`  ✓ Patients: ${patient1.name}, ${patient2.name}`);

  // ─── Sample Finished Session ──────────────────────────────────
  const session = await prisma.intakeSession.create({
    data: {
      patientId: patient1.id,
      clinicId: clinic.id,
      status: SessionStatus.COMPLETED,
      deviceId: 'camera-001',
      metadata: { camera: 'main-entrance' },
      endedAt: new Date(),
    },
  });

  await prisma.intakeRecord.create({
    data: {
      sessionId: session.id,
      patientId: patient1.id,
      brief: {
        summary:
          'Patient presents with persistent headache and mild fever for 3 days. No emergency symptoms detected.',
        chiefComplaint: 'Headache and fever',
        riskFlags: [],
        vitalsToCheck: ['Blood Pressure', 'Temperature', 'Heart Rate'],
        suggestedFollowups: ['Duration of headache episodes', 'Any visual disturbances'],
        medicationsNote: 'No recent changes',
        icd10Hints: ['R51', 'R50.9'],
      },
      intakeData: {
        chiefComplaint: 'Headache and fever for 3 days',
        symptoms: [
          { name: 'Headache', duration: '3 days', severity: 6 },
          { name: 'Fever', duration: '3 days', severity: 5 },
        ],
        associated: ['Mild body ache', 'Fatigue'],
        medicationChanges: 'None',
        allergyUpdates: 'No known allergies',
        patientNotes: 'Patient seems anxious about work deadlines',
      },
    },
  });

  console.log(`  ✓ Sample intake session for ${patient1.name}`);
  console.log('');
  console.log('✅ Seeding complete!');
  console.log('──────────────────────────────────────────────');
  console.log('  Login credentials (dev defaults):');
  console.log(`    Doctor       doctor@jeevandata.com    ${SEED_PASSWORDS.doctor}`);
  console.log(`    Receptionist reception@jeevandata.com  ${SEED_PASSWORDS.receptionist}`);
  console.log(`    Admin        admin@jeevandata.com     ${SEED_PASSWORDS.admin}`);
  console.log('  Override via SEED_DOCTOR_PASSWORD / SEED_RECEPTION_PASSWORD /');
  console.log('  SEED_ADMIN_PASSWORD env vars.');
  console.log('──────────────────────────────────────────────');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
