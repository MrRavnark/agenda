const SPREADSHEET_ID = "1k9eaBYaArmcPfi38HaYY48FXbPkCeKy7FVKyP3m-N-Q";
const SHEET_NAME = "Agendamentos";

const HEADERS = [
  "id",
  "patient",
  "psychologist",
  "date",
  "start",
  "end",
  "room",
  "notes",
  "createdAt",
  "updatedAt",
];

const ROOM_NAMES = {
  "pm-4": "PM - Sala 4",
  "pm-3": "PM - Sala 3",
  "pm-1": "PM - Sala 1",
  "mf-2": "MF - Sala 2",
};

function setup() {
  getAppointmentsSheet_();
}

function doGet(e) {
  return handleRequest_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  return handleRequest_({
    action: body.action,
    key: body.key,
    payload: JSON.stringify(body.payload || {}),
  });
}

function handleRequest_(params) {
  let locked = false;
  const lock = LockService.getScriptLock();

  try {
    assertAccess_(params);

    const action = params.action || "list";
    let result;

    if (action === "list") {
      result = { ok: true, appointments: listAppointments_() };
    } else if (action === "save") {
      lock.waitLock(10000);
      locked = true;
      result = saveAppointment_(parsePayload_(params.payload));
    } else if (action === "delete") {
      lock.waitLock(10000);
      locked = true;
      result = deleteAppointment_(parsePayload_(params.payload));
    } else {
      throw new Error("Acao desconhecida.");
    }

    return output_(result, params.callback);
  } catch (error) {
    return output_({ ok: false, message: error.message || "Erro inesperado." }, params.callback);
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

function assertAccess_(params) {
  const expectedKey = PropertiesService.getScriptProperties().getProperty("ACCESS_KEY");

  if (expectedKey && params.key !== expectedKey) {
    throw new Error("Chave de acesso invalida.");
  }
}

function parsePayload_(payload) {
  if (!payload) {
    return {};
  }

  if (typeof payload === "string") {
    return JSON.parse(payload);
  }

  return payload;
}

function saveAppointment_(payload) {
  const sheet = getAppointmentsSheet_();
  const currentAppointments = readAppointments_(sheet);
  const appointment = sanitizeAppointment_(payload);
  const existing = currentAppointments.find((item) => item.id === appointment.id);
  const now = new Date().toISOString();

  appointment.createdAt = existing ? existing.createdAt : now;
  appointment.updatedAt = now;

  validateAppointment_(appointment, currentAppointments);

  const row = appointmentToRow_(appointment);
  const rowNumber = findAppointmentRow_(sheet, appointment.id);

  if (rowNumber > 0) {
    sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return { ok: true, appointments: listAppointments_() };
}

function deleteAppointment_(payload) {
  const id = cleanText_(payload.id);

  if (!id) {
    throw new Error("Atendimento nao informado.");
  }

  const sheet = getAppointmentsSheet_();
  const rowNumber = findAppointmentRow_(sheet, id);

  if (rowNumber > 0) {
    sheet.deleteRow(rowNumber);
  }

  return { ok: true, appointments: listAppointments_() };
}

function listAppointments_() {
  return readAppointments_(getAppointmentsSheet_());
}

function getAppointmentsSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 1), HEADERS.length).setNumberFormat("@");
    return;
  }

  const headerWidth = Math.max(sheet.getLastColumn(), HEADERS.length);
  const currentHeaders = sheet.getRange(1, 1, 1, headerWidth).getDisplayValues()[0].map(cleanText_);
  const isMissingHeaders = HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (!isMissingHeaders) {
    repairShiftedLegacyRows_(sheet);
    generateMissingIds_(sheet);
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 1), HEADERS.length).setNumberFormat("@");
    return;
  }

  if (isLegacySheet_(currentHeaders)) {
    migrateLegacySheet_(sheet, currentHeaders);
  } else {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  generateMissingIds_(sheet);
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 1), HEADERS.length).setNumberFormat("@");
}

function isLegacySheet_(headers) {
  return (
    getHeaderIndex_(headers, "Data") >= 0 &&
    getHeaderIndex_(headers, "Hora") >= 0 &&
    getHeaderIndex_(headers, "Paciente") >= 0 &&
    getHeaderIndex_(headers, "Sala") >= 0
  );
}

function migrateLegacySheet_(sheet, headers) {
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const now = new Date().toISOString();
  const rows = [];

  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
    const displayValues = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
    const dataColumn = getHeaderIndex_(headers, "Data");
    const timeColumn = getHeaderIndex_(headers, "Hora");
    const patientColumn = getHeaderIndex_(headers, "Paciente");
    const roomColumn = getHeaderIndex_(headers, "Sala");

    values.forEach((row, index) => {
      const displayRow = displayValues[index];
      const patient = cleanText_(displayRow[patientColumn] || row[patientColumn]);

      if (!patient) {
        return;
      }

      const start = normalizeLegacyTime_(row[timeColumn], displayRow[timeColumn]);
      const end = start ? minutesToTime_(Math.min(timeToMinutes_(start) + 60, 22 * 60)) : "";

      rows.push(
        appointmentToRow_({
          id: `row_${index + 2}`,
          patient,
          psychologist: "",
          date: normalizeLegacyDate_(row[dataColumn], displayRow[dataColumn]),
          start,
          end,
          room: normalizeLegacyRoom_(displayRow[roomColumn] || row[roomColumn]),
          notes: "",
          createdAt: now,
          updatedAt: now,
        }),
      );
    });
  }

  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  }

  sheet.setFrozenRows(1);
}

function repairShiftedLegacyRows_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
  const now = new Date().toISOString();
  let changed = false;

  const repairedRows = rows.map((row, index) => {
    const looksShifted =
      /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanText_(row[0])) &&
      /^\d{1,2}:\d{2}$/.test(cleanText_(row[1])) &&
      isRoomName_(row[3]) &&
      !cleanText_(row[4]) &&
      !cleanText_(row[5]);

    if (!looksShifted) {
      return row;
    }

    changed = true;
    const start = normalizeLegacyTime_("", row[1]);

    return appointmentToRow_({
      id: `row_${index + 2}`,
      patient: cleanText_(row[2]),
      psychologist: "",
      date: normalizeLegacyDate_("", row[0]),
      start,
      end: minutesToTime_(Math.min(timeToMinutes_(start) + 60, 22 * 60)),
      room: normalizeLegacyRoom_(row[3]),
      notes: "",
      createdAt: now,
      updatedAt: now,
    });
  });

  if (changed) {
    sheet.getRange(2, 1, repairedRows.length, HEADERS.length).setValues(repairedRows);
  }
}

function generateMissingIds_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const range = sheet.getRange(2, 1, lastRow - 1, HEADERS.length);
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  const now = new Date().toISOString();
  let changed = false;

  const repairedRows = values.map((row, index) => {
    const id = cleanText_(displayValues[index][0] || row[0]);
    const patient = cleanText_(displayValues[index][1] || row[1]);
    const date = cleanText_(displayValues[index][3] || row[3]);

    if (!id && (patient || date)) {
      row[0] = `row_${index + 2}_${Math.random().toString(36).slice(2, 6)}`;
      row[8] = row[8] || now; // createdAt
      row[9] = now; // updatedAt
      changed = true;
    }
    return row;
  });

  if (changed) {
    range.setValues(repairedRows);
  }
}

function isRoomName_(value) {
  return Object.keys(ROOM_NAMES).some((roomId) => normalize_(ROOM_NAMES[roomId]) === normalize_(value));
}

function getHeaderIndex_(headers, headerName) {
  const normalizedHeaderName = normalize_(headerName);
  return headers.findIndex((header) => normalize_(header) === normalizedHeaderName);
}

function normalizeLegacyDate_(value, displayValue) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  const text = cleanText_(displayValue || value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parts = text.split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }

  return text;
}

function normalizeLegacyTime_(value, displayValue) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm");
  }

  const text = cleanText_(displayValue || value);

  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const parts = text.split(":");
    return `${parts[0].padStart(2, "0")}:${parts[1]}`;
  }

  if (/^\d{3,4}$/.test(text)) {
    return `${text.slice(0, -2).padStart(2, "0")}:${text.slice(-2)}`;
  }

  return text;
}

function normalizeLegacyRoom_(value) {
  const roomText = cleanText_(value);
  const existingRoomId = Object.keys(ROOM_NAMES).find((roomId) => roomId === roomText);

  if (existingRoomId) {
    return existingRoomId;
  }

  return Object.keys(ROOM_NAMES).find((roomId) => normalize_(ROOM_NAMES[roomId]) === normalize_(roomText)) || "pm-1";
}

function readAppointments_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
  return rows.map(rowToAppointment_).filter((appointment) => appointment.id);
}

function findAppointmentRow_(sheet, id) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return -1;
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  const index = ids.findIndex((row) => row[0] === id);

  return index >= 0 ? index + 2 : -1;
}

function sanitizeAppointment_(payload) {
  const appointment = {
    id: cleanText_(payload.id) || Utilities.getUuid(),
    patient: cleanText_(payload.patient),
    psychologist: cleanLookupError_(payload.psychologist),
    date: normalizeStoredDate_(payload.date),
    start: normalizeStoredTime_(payload.start),
    end: normalizeStoredTime_(payload.end),
    room: normalizeStoredRoom_(payload.room),
    notes: cleanText_(payload.notes),
    createdAt: cleanText_(payload.createdAt),
    updatedAt: cleanText_(payload.updatedAt),
  };

  if (!appointment.patient || !appointment.psychologist || !appointment.date || !appointment.start || !appointment.end) {
    throw new Error("Preencha paciente, psicologa, data e horario.");
  }

  if (!ROOM_NAMES[appointment.room]) {
    throw new Error("Sala invalida.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment.date)) {
    throw new Error("Data invalida.");
  }

  if (!/^\d{2}:\d{2}$/.test(appointment.start) || !/^\d{2}:\d{2}$/.test(appointment.end)) {
    throw new Error("Horario invalido.");
  }

  if (timeToMinutes_(appointment.end) <= timeToMinutes_(appointment.start)) {
    throw new Error("O termino precisa ser depois do inicio.");
  }

  return appointment;
}

function validateAppointment_(appointment, appointments) {
  const start = timeToMinutes_(appointment.start);
  const end = timeToMinutes_(appointment.end);

  const conflict = appointments.find((item) => {
    if (item.id === appointment.id || item.date !== appointment.date) {
      return false;
    }

    const overlaps = start < timeToMinutes_(item.end) && end > timeToMinutes_(item.start);
    const sameRoom = item.room === appointment.room;
    const sameProfessional = normalize_(item.psychologist) === normalize_(appointment.psychologist);

    return overlaps && (sameRoom || sameProfessional);
  });

  if (!conflict) {
    return;
  }

  const reason =
    conflict.room === appointment.room
      ? `a sala ${ROOM_NAMES[conflict.room]}`
      : `a psicologa ${conflict.psychologist}`;

  throw new Error(`Conflito: ${reason} ja tem atendimento de ${conflict.start} as ${conflict.end}.`);
}

function appointmentToRow_(appointment) {
  return HEADERS.map((header) => appointment[header] || "");
}

function rowToAppointment_(row) {
  return {
    id: cleanText_(row[0]),
    patient: cleanText_(row[1]),
    psychologist: cleanLookupError_(row[2]),
    date: normalizeStoredDate_(row[3]),
    start: normalizeStoredTime_(row[4]),
    end: normalizeStoredTime_(row[5]),
    room: normalizeStoredRoom_(row[6]),
    notes: cleanText_(row[7]),
    createdAt: cleanText_(row[8]),
    updatedAt: cleanText_(row[9]),
  };
}

function output_(result, callback) {
  const body = JSON.stringify(result);
  const safeCallback = /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback || "")
    ? callback
    : "";

  if (safeCallback) {
    return ContentService.createTextOutput(`${safeCallback}(${body});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function cleanText_(value) {
  return String(value || "").trim();
}

function normalize_(value) {
  return cleanText_(value).toLowerCase();
}

function cleanLookupError_(value) {
  const text = cleanText_(value);
  return /^#N\/A(?:\s*\(\))?$/.test(text) ? "" : text;
}

function normalizeStoredDate_(value) {
  return normalizeLegacyDate_("", value);
}

function normalizeStoredTime_(value) {
  return normalizeLegacyTime_("", value);
}

function normalizeStoredRoom_(value) {
  const roomText = cleanText_(value);

  if (!roomText || ROOM_NAMES[roomText]) {
    return roomText;
  }

  return Object.keys(ROOM_NAMES).find((roomId) => normalize_(ROOM_NAMES[roomId]) === normalize_(roomText)) || roomText;
}

function timeToMinutes_(value) {
  const parts = value.split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

function minutesToTime_(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
