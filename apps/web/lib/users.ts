import 'server-only';
import { fhirSearch, fhirCreate } from './medplum-client';
import type { Practitioner } from '@medplum/fhirtypes';
import { HH_EXT } from '@hh/fhir';

// Users are stored as Practitioner resources in Medplum.
// Password hash is kept in a custom extension.
// This keeps user management simple without a separate DB.

const PASSWORD_HASH_EXT = 'https://homehealth.com.br/fhir/StructureDefinition/password-hash';
const ROLE_EXT = 'https://homehealth.com.br/fhir/StructureDefinition/role';

async function hashPassword(password: string): Promise<string> {
  // Use Node.js crypto (bcrypt would require native addon — use scrypt instead)
  const { scrypt, randomBytes } = await import('node:crypto');
  const salt = randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  const { scrypt } = await import('node:crypto');
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString('hex') === hash);
    });
  });
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  practitionerId: string;
  projectId: string;
  role: string;
  createdAt: string;
  subscriptionStatus: string;
  subscriptionPlan: string;
}

export async function verifyUser(email: string, password: string): Promise<AppUser | null> {
  const practitioners = await fhirSearch<Practitioner>('Practitioner', {
    'telecom': `email|${email}`,
  });

  const practitioner = practitioners.find(p =>
    p.telecom?.some(t => t.system === 'email' && t.value === email)
  );

  if (!practitioner) return null;

  const storedHash = practitioner.extension?.find(e => e.url === PASSWORD_HASH_EXT)?.valueString;
  if (!storedHash) return null;

  const valid = await verifyPassword(password, storedHash);
  if (!valid) return null;

  const projectId = practitioner.extension?.find(e => e.url === HH_EXT.PROJECT_ID)?.valueString
    ?? process.env.MEDPLUM_PROJECT_ID!;
  const role = practitioner.extension?.find(e => e.url === ROLE_EXT)?.valueString ?? 'practitioner';
  const createdAt = practitioner.extension?.find(e => e.url === HH_EXT.CREATED_AT)?.valueString
    ?? practitioner.meta?.lastUpdated
    ?? new Date().toISOString();
  const subscriptionStatus = practitioner.extension?.find(e => e.url === HH_EXT.SUBSCRIPTION_STATUS)?.valueString
    ?? 'trial';
  const subscriptionPlan = practitioner.extension?.find(e => e.url === HH_EXT.SUBSCRIPTION_PLAN)?.valueString
    ?? 'starter';

  return {
    id: practitioner.id!,
    name: practitioner.name?.[0]?.text ?? email,
    email,
    practitionerId: practitioner.id!,
    projectId,
    role,
    createdAt,
    subscriptionStatus,
    subscriptionPlan,
  };
}

export async function createUser(params: {
  name: string;
  email: string;
  password: string;
  role?: string;
  projectId?: string;
  ownerId?: string;
}): Promise<AppUser> {
  const passwordHash = await hashPassword(params.password);
  const role = params.role ?? 'owner';
  const projectId = params.projectId ?? process.env.MEDPLUM_PROJECT_ID!;

  const extensions: Array<{ url: string; valueString: string }> = [
    { url: PASSWORD_HASH_EXT, valueString: passwordHash },
    { url: ROLE_EXT, valueString: role },
    { url: HH_EXT.PROJECT_ID, valueString: projectId },
    { url: HH_EXT.CREATED_AT, valueString: new Date().toISOString() },
    { url: HH_EXT.SUBSCRIPTION_STATUS, valueString: role === 'owner' ? 'trial' : 'active' },
  ];
  if (params.ownerId) {
    extensions.push({ url: HH_EXT.OWNER_ID, valueString: params.ownerId });
  }

  const practitioner = await fhirCreate<Practitioner>('Practitioner', {
    resourceType: 'Practitioner',
    name: [{ text: params.name }],
    telecom: [{ system: 'email', value: params.email }],
    extension: extensions,
  }, projectId);

  const now = new Date().toISOString();
  return {
    id: practitioner.id!,
    name: params.name,
    email: params.email,
    practitionerId: practitioner.id!,
    projectId,
    role,
    createdAt: now,
    subscriptionStatus: role === 'owner' ? 'trial' : 'active',
    subscriptionPlan: 'starter',
  };
}
