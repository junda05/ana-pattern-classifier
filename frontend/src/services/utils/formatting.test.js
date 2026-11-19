import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { formatDate, formatDateOnly } from './dateUtils';
import { buildAuditCsv, formatDateTime, formatFieldValue, transformTraceabilityListFromBackend } from './traceabilityUtils';
import { transformBackendResultToFrontend } from './resultsUtils';
import {
  DOCUMENT_TYPES,
  formatDocumentType,
  formatDocumentTypeShort,
  formatRoleLabel,
} from './constants';

// Runs dateUtils in a separate Node process with the given TZ (the test runner's
// time zone is fixed when it starts, so changing process.env.TZ here has no effect).
const formatInTimeZone = (timeZone, expression) => {
  const source = fs.readFileSync(path.join(__dirname, 'dateUtils.js'), 'utf8').replace(/^export /gm, '');
  return execFileSync(process.execPath, ['-e', `${source}
process.stdout.write(${expression});`], {
    env: { ...process.env, TZ: timeZone },
  }).toString();
};

describe('dateUtils.formatDateOnly', () => {
  it.each(['America/Denver', 'UTC', 'Asia/Tokyo', 'America/New_York', 'Pacific/Kiritimati'])(
    'shows a date-only value on its own calendar day in %s',
    (timeZone) => {
      expect(formatInTimeZone(timeZone, "formatDateOnly('1990-05-15')")).toBe('May 15, 1990');
      expect(formatInTimeZone(timeZone, "formatDateOnly('1990-05-15T00:00:00.000Z')")).toBe('May 15, 1990');
    }
  );

  it('returns N/A for empty or invalid values', () => {
    expect(formatDateOnly(null)).toBe('N/A');
    expect(formatDateOnly('not a date')).toBe('N/A');
  });
});

describe('traceabilityUtils.formatDateTime', () => {
  it('uses the shared en-US date-time format', () => {
    const value = '2026-09-24T13:55:00.000Z';
    expect(formatDateTime(value)).toBe(formatDate(value));
    expect(formatDateTime(null)).toBe('-');
  });
});

describe('formatFieldValue', () => {
  it.each([
    ['role', 'ADMIN', 'Administrator'],
    ['documentType', 'PASSPORT', 'Passport'],
    ['patientDocumentType', 'FOREIGNER_ID', 'Foreign resident ID'],
    ['gender', 'M', 'Male'],
    ['patientGender', 'F', 'Female'],
    ['status', 'CORRECTED', 'Corrected'],
    ['isActive', 'false', 'No'],
    ['newPredictionsAdded', '1', '1 new image'],
    ['predictionsCount', '3', '3 images'],
    ['correctedPrediction', 'NUCLEAR_SPECKLED', 'AC-4/AC-5 Nuclear Speckled'],
  ])('formats %s=%s as %s', (field, value, expected) => {
    expect(formatFieldValue(field, value)).toBe(expected);
  });

  it.each([
    ['observations', 'ADMIN'],
    ['observations', 'M'],
    ['documentNumber', 'PASSPORT'],
    ['fullName', 'F'],
    ['observations', 'true'],
  ])('leaves %s=%s unchanged (relabelling applies per field)', (field, value) => {
    expect(formatFieldValue(field, value)).toBe(value);
  });
});

describe('buildAuditCsv', () => {
  it('exports the columns that audit-trail list rows actually have', () => {
    const csv = buildAuditCsv([
      {
        id: 1,
        userName: 'Jane Doe',
        userRole: 'ADMIN',
        dateTime: '2026-09-24T13:55:00.000Z',
        activityType: 'UPDATE',
        activityTypeLabel: 'Update',
        entityType: 'RESULT',
      },
      { id: 2, userName: 'System', userRole: null, dateTime: '2026-09-24T14:00:00.000Z', activityType: 'CREATE' },
    ]);

    const [header, first, second] = csv.split('\n');
    expect(header).toBe('"Date and Time","User","Role","Activity","Entity"');
    expect(first).toBe(`"${formatDate('2026-09-24T13:55:00.000Z')}","Jane Doe","Administrator","Update","Result"`);
    expect(second).toContain('"System","System","Create","-"');
    expect(csv).not.toContain('undefined');
  });

  it('fills the Entity column from the entityType of the API list items', () => {
    const records = transformTraceabilityListFromBackend([
      {
        traceabilityId: 7,
        userFullName: 'Dr. Jane Doe',
        userRole: 'STANDARD',
        dateAndHour: '2026-09-24T13:55:00.000Z',
        activityType: 'CREATE',
        activityTypeLabel: 'Create',
        entityType: 'CORRECTION',
      },
      {
        traceabilityId: 8,
        userFullName: 'Dr. Jane Doe',
        userRole: 'STANDARD',
        dateAndHour: '2026-09-24T14:00:00.000Z',
        activityType: 'CREATE',
        activityTypeLabel: 'Create',
        entityType: 'PATIENT',
      },
    ]);

    const [, correction, patient] = buildAuditCsv(records).split('\n');
    expect(correction.endsWith(',"Correction"')).toBe(true);
    expect(patient.endsWith(',"Patient"')).toBe(true);
  });

  it('escapes quotes in cell values', () => {
    const csv = buildAuditCsv([{ userName: 'Jane "JD" Doe', userRole: 'STANDARD', dateTime: null, activityType: 'DELETE' }]);
    expect(csv.split('\n')[1]).toContain('"Jane ""JD"" Doe"');
  });
});

describe('resultsUtils.transformBackendResultToFrontend', () => {
  it('does not invent a document type when the patient has none', () => {
    const row = transformBackendResultToFrontend({ resultId: 1, patient: { fullName: 'Jane Doe', documentNumber: '123' } });

    expect(row.documentType).not.toBe('NATIONAL_ID');
    expect(formatDocumentTypeShort(row.documentType)).toBe('Unknown');
  });
});

describe('document type labels', () => {
  it('derives every label from the single DOCUMENT_TYPES list', () => {
    DOCUMENT_TYPES.forEach(({ value, label, shortLabel }) => {
      expect(formatDocumentType(value)).toBe(label);
      expect(formatDocumentTypeShort(value)).toBe(shortLabel);
    });
  });

  it('uses "Foreign resident ID" for foreigner IDs in full and short form', () => {
    expect(formatDocumentType('FOREIGNER_ID')).toBe('Foreign resident ID');
    expect(formatDocumentTypeShort('FOREIGNER_ID')).toBe('Foreign resident ID');
  });
});

describe('formatRoleLabel', () => {
  it('labels role codes and flags anything else', () => {
    expect(formatRoleLabel('ADMIN')).toBe('Administrator');
    expect(formatRoleLabel('STANDARD')).toBe('Standard');
    expect(formatRoleLabel('SOMETHING')).toBe('Unknown role');
  });
});
