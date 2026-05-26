const ROOMS = [
  { id: "pm-4", name: "PM - Sala 4", className: "room-3" },
  { id: "pm-3", name: "PM - Sala 3", className: "room-2" },
  { id: "pm-1", name: "PM - Sala 1", className: "room-1" },
  { id: "mf-2", name: "MF - Sala 2", className: "room-4" },
];

const STORAGE_KEY = "espaco-do-pensar-agenda-v1";
const ACCESS_KEY_STORAGE_KEY = "espaco-do-pensar-access-key";
const OPEN_MINUTES = 7 * 60;
const CLOSE_MINUTES = 22 * 60;
const SLOT_HEIGHT = 86;
const GRID_HEADER_HEIGHT = 42;
const DROP_SNAP_MINUTES = 60;
const APPOINTMENT_BLOCK_INSET = 8;
const AUTO_REFRESH_INTERVAL_MS = 60000;
const MOBILE_LAYOUT_QUERY = "(max-width: 720px)";
const CONFIG = window.AGENDA_CONFIG || {};
const DIRECTORY = window.AGENDA_DIRECTORY || {};

let appointments = [];
let selectedDate = toDateInputValue(new Date());
let currentView = "day";
let remoteBackendMode = "unknown";
let draggedAppointmentId = "";
let dragOffsetY = 0;
let lastFormTrigger = null;
let globalNoticeTimeoutId = 0;
let pendingConfirmation = null;

const elements = {
  appShell: document.querySelector(".app-shell"),
  formPanel: document.querySelector(".schedule-form-panel"),
  form: document.querySelector("#appointment-form"),
  formTitle: document.querySelector("#form-title"),
  appointmentId: document.querySelector("#appointment-id"),
  patient: document.querySelector("#patient"),
  psychologist: document.querySelector("#psychologist"),
  patientOptions: document.querySelector("#patient-options"),
  psychologistOptions: document.querySelector("#psychologist-options"),
  date: document.querySelector("#date"),
  start: document.querySelector("#start"),
  end: document.querySelector("#end"),
  room: document.querySelector("#room"),
  notes: document.querySelector("#notes"),
  feedback: document.querySelector("#form-feedback"),
  submit: document.querySelector("#submit-appointment"),
  deleteBtn: document.querySelector("#delete-appointment"),
  clearForm: document.querySelector("#clear-form"),
  closeForm: document.querySelector("#close-form"),
  previousDate: document.querySelector("#previous-date"),
  todayDate: document.querySelector("#today-date"),
  nextDate: document.querySelector("#next-date"),
  currentPeriod: document.querySelector("#current-period"),
  summaryStrip: document.querySelector("#summary-strip"),
  scheduleContent: document.querySelector("#schedule-content"),
  syncStatus: document.querySelector("#sync-status"),
  filterRoom: document.querySelector("#filter-room"),
  filterPsychologist: document.querySelector("#filter-psychologist"),
  newAppointment: document.querySelector("#new-appointment"),
  fabNewAppointment: document.querySelector("#fab-new-appointment"),
  appointmentTemplate: document.querySelector("#appointment-template"),
  tabs: Array.from(document.querySelectorAll(".tab-button")),
};

initialise();

function initialise() {
  ROOMS.forEach((room) => {
    const option = document.createElement("option");
    option.value = room.id;
    option.textContent = room.name;
    elements.room.append(option);

    const filterOption = document.createElement("option");
    filterOption.value = room.id;
    filterOption.textContent = room.name;
    elements.filterRoom.append(filterOption);
  });

  elements.date.value = selectedDate;
  elements.start.value = "08:00";
  elements.end.value = "09:00";
  elements.room.value = ROOMS[0].id;

  elements.form.addEventListener("submit", handleSubmit);
  elements.clearForm.addEventListener("click", resetForm);
  elements.closeForm.addEventListener("click", () => closeFormPanel());
  elements.deleteBtn.addEventListener("click", () => {
    const id = elements.appointmentId.value;
    if (id) {
      deleteAppointment(id);
    }
  });
  elements.newAppointment.addEventListener("click", () => {
    resetForm();
    openFormPanel(elements.newAppointment);
  });
  if (elements.fabNewAppointment) {
    elements.fabNewAppointment.addEventListener("click", () => {
      resetForm();
      openFormPanel(elements.fabNewAppointment);
    });
  }
  elements.previousDate.addEventListener("click", () => moveDate(-1));
  elements.nextDate.addEventListener("click", () => moveDate(1));
  elements.todayDate.addEventListener("click", () => {
    selectedDate = toDateInputValue(new Date());
    elements.date.value = selectedDate;
    render();
  });

  elements.date.addEventListener("change", () => {
    selectedDate = elements.date.value || selectedDate;
    render();
  });

  elements.start.addEventListener("change", suggestEndTime);
  elements.filterRoom.addEventListener("change", render);
  if (elements.filterPsychologist) {
    elements.filterPsychologist.addEventListener("change", render);
  }
  window.addEventListener("resize", () => {
    render();
    syncFormPresentation();
  });
  document.addEventListener("keydown", handleDocumentKeydown);

  initialiseViewTabs();
  syncFormPresentation();

  render();
  refreshAppointments();
  window.setInterval(() => refreshAppointments({ silent: true }), AUTO_REFRESH_INTERVAL_MS);
}

async function handleSubmit(event) {
  event.preventDefault();
  const appointment = readForm();
  const appointmentToSave = { ...appointment, id: appointment.id || createId() };
  const validation = validateAppointment(appointmentToSave);

  if (!validation.ok) {
    showFeedback(validation.message, "error");
    return;
  }

  setFormBusy(true);
  showFeedback("Salvando atendimento...", "success");

  try {
    appointments = await persistAppointment(appointmentToSave);
    selectedDate = appointmentToSave.date;
    resetForm(false);
    closeFormPanel();
    render();
    showFeedback(appointment.id ? "Atendimento atualizado." : "Atendimento salvo.", "success");
  } catch (error) {
    showFeedback(error.message || "Nao foi possivel salvar o atendimento.", "error");
  } finally {
    setFormBusy(false);
  }
}

function readForm() {
  return {
    id: elements.appointmentId.value || "",
    patient: cleanName(elements.patient.value),
    psychologist: cleanName(elements.psychologist.value),
    date: elements.date.value,
    start: elements.start.value,
    end: elements.end.value,
    room: elements.room.value,
    notes: elements.notes.value.trim(),
  };
}

function validateAppointment(appointment) {
  if (!appointment.patient || !appointment.psychologist || !appointment.date || !appointment.start || !appointment.end) {
    return { ok: false, message: "Preencha paciente, profissional, data e horário." };
  }

  if (!isAllowedRoomId(appointment.room)) {
    return { ok: false, message: "Selecione uma sala válida." };
  }

  const start = timeToMinutes(appointment.start);
  const end = timeToMinutes(appointment.end);

  if (end <= start) {
    return { ok: false, message: "O término precisa ser depois do início." };
  }

  const conflict = appointments.find((item) => {
    if (item.id === appointment.id || item.date !== appointment.date) {
      return false;
    }

    const overlaps = start < timeToMinutes(item.end) && end > timeToMinutes(item.start);
    if (!overlaps) {
      return false;
    }

    const sameRoom = item.room === appointment.room;
    const sameProfessional = normalize(item.psychologist) === normalize(appointment.psychologist);
    return sameRoom || sameProfessional;
  });

  if (conflict) {
    const roomConflict = conflict.room === appointment.room;
    const reason = roomConflict ? `a sala ${getRoomName(conflict.room)}` : `o profissional ${conflict.psychologist}`;
    return {
      ok: false,
      message: `Conflito: ${reason} já tem atendimento de ${conflict.start} às ${conflict.end}.`,
    };
  }

  return { ok: true };
}

function resetForm(clearMessage = true) {
  elements.form.reset();
  elements.appointmentId.value = "";
  elements.formTitle.textContent = "Novo atendimento";
  elements.submit.textContent = "Salvar atendimento";
  elements.deleteBtn.classList.add("is-hidden");
  elements.date.value = selectedDate;
  elements.start.value = "08:00";
  elements.end.value = "09:00";
  elements.room.value = ROOMS[0].id;

  if (clearMessage) {
    showFeedback("", "success");
  }
}

function editAppointment(id, trigger = null) {
  const appointment = appointments.find((item) => item.id === id);
  if (!appointment) {
    return;
  }

  elements.appointmentId.value = appointment.id;
  elements.patient.value = appointment.patient;
  elements.psychologist.value = appointment.psychologist;
  elements.date.value = appointment.date;
  elements.start.value = appointment.start;
  elements.end.value = appointment.end;
  elements.room.value = appointment.room;
  elements.notes.value = appointment.notes;
  elements.formTitle.textContent = "Editar atendimento";
  elements.submit.textContent = "Atualizar atendimento";
  elements.deleteBtn.classList.remove("is-hidden");
  selectedDate = appointment.date;
  showFeedback("", "success");
  render();
  openFormPanel(trigger);
}

function initialiseViewTabs() {
  elements.tabs.forEach((tab) => {
    if (!tab.id && tab.dataset.view) {
      tab.id = `view-tab-${tab.dataset.view}`;
    }

    tab.setAttribute("aria-controls", elements.scheduleContent.id);
    tab.tabIndex = tab.dataset.view === currentView ? 0 : -1;
    tab.addEventListener("click", () => activateView(tab));
    tab.addEventListener("keydown", handleTabKeydown);
  });

  const activeTab = elements.tabs.find((tab) => tab.dataset.view === currentView) || elements.tabs[0];
  activateView(activeTab, { renderView: false });
}

function activateView(tab, { focus = false, renderView = true } = {}) {
  if (!tab) {
    return;
  }

  currentView = tab.dataset.view || currentView;
  elements.tabs.forEach((item) => {
    const isActive = item === tab;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-selected", String(isActive));
    item.tabIndex = isActive ? 0 : -1;

    if (isActive && item.id) {
      elements.scheduleContent.setAttribute("aria-labelledby", item.id);
    }
  });

  if (focus) {
    focusElement(tab);
  }

  if (renderView) {
    render();
  }
}

function handleTabKeydown(event) {
  const currentIndex = elements.tabs.indexOf(event.currentTarget);
  if (currentIndex < 0) {
    return;
  }

  const keyActions = {
    ArrowDown: (currentIndex + 1) % elements.tabs.length,
    ArrowRight: (currentIndex + 1) % elements.tabs.length,
    ArrowLeft: (currentIndex - 1 + elements.tabs.length) % elements.tabs.length,
    ArrowUp: (currentIndex - 1 + elements.tabs.length) % elements.tabs.length,
    End: elements.tabs.length - 1,
    Home: 0,
  };

  if (!(event.key in keyActions)) {
    return;
  }

  event.preventDefault();
  activateView(elements.tabs[keyActions[event.key]], { focus: true });
}

function handleDocumentKeydown(event) {
  const isOpen = !elements.formPanel.classList.contains("is-hidden");
  if (!isOpen) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeFormPanel();
    return;
  }

  if (event.key === "Tab" && isMobileLayout()) {
    trapFormFocus(event);
  }
}

function openFormPanel(trigger = null) {
  if (trigger) {
    lastFormTrigger = trigger;
  }

  elements.formPanel.classList.remove("is-hidden");
  elements.appShell.classList.add("form-open");
  setFormExpandedState(true);
  syncFormPresentation();
  window.requestAnimationFrame(() => {
    if (!elements.formPanel.classList.contains("is-hidden")) {
      focusElement(elements.patient);
    }
  });
}

function closeFormPanel({ restoreFocus = true } = {}) {
  const wasOpen = !elements.formPanel.classList.contains("is-hidden");
  elements.formPanel.classList.add("is-hidden");
  elements.appShell.classList.remove("form-open");
  setFormExpandedState(false);
  document.body.style.overflow = "";
  elements.formPanel.setAttribute("role", "complementary");
  elements.formPanel.removeAttribute("aria-modal");

  if (restoreFocus && wasOpen) {
    restoreFormFocus();
  }
}

function syncFormPresentation() {
  const isOpen = !elements.formPanel.classList.contains("is-hidden");
  setFormExpandedState(isOpen);

  if (!isOpen) {
    document.body.style.overflow = "";
    elements.formPanel.setAttribute("role", "complementary");
    elements.formPanel.removeAttribute("aria-modal");
    return;
  }

  if (isMobileLayout()) {
    document.body.style.overflow = "hidden";
    elements.formPanel.setAttribute("role", "dialog");
    elements.formPanel.setAttribute("aria-modal", "true");
    return;
  }

  document.body.style.overflow = "";
  elements.formPanel.setAttribute("role", "complementary");
  elements.formPanel.removeAttribute("aria-modal");
}

function setFormExpandedState(isExpanded) {
  elements.formPanel.setAttribute("aria-hidden", String(!isExpanded));
  document.body.classList.toggle("form-panel-open", isExpanded);
  [elements.newAppointment, elements.fabNewAppointment].filter(Boolean).forEach((button) => {
    button.setAttribute("aria-expanded", String(isExpanded));
  });
}

function restoreFormFocus() {
  const target = [lastFormTrigger, elements.fabNewAppointment, elements.newAppointment].find(isElementFocusable);
  lastFormTrigger = null;
  focusElement(target);
}

function trapFormFocus(event) {
  const focusable = getFocusableElements(elements.formPanel);

  if (!focusable.length) {
    event.preventDefault();
    focusElement(elements.formPanel);
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (!elements.formPanel.contains(document.activeElement)) {
    event.preventDefault();
    focusElement(first);
    return;
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    focusElement(last);
    return;
  }

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    focusElement(first);
  }
}

function getFocusableElements(container) {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  return Array.from(container.querySelectorAll(selector)).filter(isElementFocusable);
}

function isElementFocusable(element) {
  return Boolean(element && typeof element.focus === "function" && element.getClientRects().length);
}

function focusElement(element) {
  if (!element || typeof element.focus !== "function") {
    return;
  }

  try {
    element.focus({ preventScroll: true });
  } catch (error) {
    element.focus();
  }
}

function showGlobalMessage(message, type = "success") {
  clearGlobalNotice();

  if (!message) {
    return;
  }

  const notice = document.createElement("div");
  notice.className = `global-notice ${type}`;
  notice.setAttribute("role", type === "error" ? "alert" : "status");
  notice.textContent = message;
  document.body.classList.add("notice-open");
  document.body.append(notice);

  globalNoticeTimeoutId = window.setTimeout(() => {
    notice.remove();
    document.body.classList.remove("notice-open");
  }, 4200);
}

function requestConfirmation(message, { confirmText = "Confirmar", cancelText = "Cancelar", tone = "default" } = {}) {
  clearGlobalNotice();

  return new Promise((resolve) => {
    const notice = document.createElement("div");
    notice.className = `global-notice confirmation ${tone}`;
    notice.setAttribute("role", "alertdialog");
    notice.setAttribute("aria-label", message);

    const text = document.createElement("p");
    text.textContent = message;

    const actions = document.createElement("div");
    actions.className = "global-notice-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "ghost-button small";
    cancelButton.textContent = cancelText;

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "primary-button small";
    confirmButton.textContent = confirmText;

    const complete = (value) => {
      if (pendingConfirmation?.notice !== notice) {
        return;
      }

      pendingConfirmation = null;
      notice.remove();
      document.body.classList.remove("notice-open");
      resolve(value);
    };

    cancelButton.addEventListener("click", () => complete(false));
    confirmButton.addEventListener("click", () => complete(true));
    actions.append(cancelButton, confirmButton);
    notice.append(text, actions);
    document.body.classList.add("notice-open");
    document.body.append(notice);
    pendingConfirmation = { notice, resolve };
    window.requestAnimationFrame(() => focusElement(cancelButton));
  });
}

function requestAccessKey() {
  clearGlobalNotice();

  return new Promise((resolve) => {
    const notice = document.createElement("form");
    notice.className = "global-notice confirmation";
    notice.setAttribute("role", "dialog");
    notice.setAttribute("aria-label", "Chave de acesso da agenda");

    const text = document.createElement("p");
    text.textContent = "Digite a chave de acesso da agenda.";

    const input = document.createElement("input");
    input.className = "global-notice-field";
    input.type = "password";
    input.autocomplete = "current-password";
    input.required = true;
    input.placeholder = "Chave de acesso";

    const actions = document.createElement("div");
    actions.className = "global-notice-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "ghost-button small";
    cancelButton.textContent = "Cancelar";

    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.className = "primary-button small";
    submitButton.textContent = "Entrar";

    const complete = (value) => {
      notice.remove();
      document.body.classList.remove("notice-open");
      resolve(value);
    };

    cancelButton.addEventListener("click", () => complete(""));
    notice.addEventListener("submit", (event) => {
      event.preventDefault();
      complete(input.value.trim());
    });

    actions.append(cancelButton, submitButton);
    notice.append(text, input, actions);
    document.body.classList.add("notice-open");
    document.body.append(notice);
    window.requestAnimationFrame(() => focusElement(input));
  });
}

function clearGlobalNotice() {
  window.clearTimeout(globalNoticeTimeoutId);
  document.querySelector(".global-notice")?.remove();
  document.body.classList.remove("notice-open");

  if (pendingConfirmation) {
    pendingConfirmation.resolve(false);
    pendingConfirmation.notice.remove();
    pendingConfirmation = null;
  }
}

async function deleteAppointment(id) {
  const appointment = appointments.find((item) => item.id === id);
  if (!appointment) {
    return;
  }

  const confirmed = await requestConfirmation(`Excluir atendimento de ${appointment.patient} em ${formatDate(appointment.date)}?`, {
    confirmText: "Excluir",
    tone: "danger",
  });
  if (!confirmed) {
    return;
  }

  try {
    setSyncStatus("Excluindo...", "loading");
    appointments = await removeAppointment(id);
    closeFormPanel();
    render();
    setStorageStatus();
    showGlobalMessage("Atendimento excluído.", "success");
  } catch (error) {
    setSyncStatus("Erro ao excluir", "error");
    showGlobalMessage(error.message || "Nao foi possivel excluir o atendimento.", "error");
  }
}

function moveDate(direction) {
  const base = parseDate(selectedDate);

  if (currentView === "month") {
    base.setMonth(base.getMonth() + direction);
  } else {
    const amount = currentView === "week" || currentView === "rooms" ? direction * 7 : direction;
    base.setDate(base.getDate() + amount);
  }

  selectedDate = toDateInputValue(base);
  elements.date.value = selectedDate;
  render();
}

function render() {
  populateDirectoryOptions();
  populatePsychologistFilter();
  const selectedAppointments = getAppointmentsForSelectedPeriod();
  renderPeriodLabel();
  renderSummary(selectedAppointments);

  if (currentView === "day") {
    renderDayView();
  }

  if (currentView === "week") {
    renderWeekView();
  }

  if (currentView === "month") {
    renderMonthView();
  }

  if (currentView === "rooms") {
    renderRoomsView();
  }
}

function renderPeriodLabel() {
  if (currentView === "day") {
    elements.currentPeriod.textContent = formatLongDate(selectedDate);
    return;
  }

  if (currentView === "month") {
    elements.currentPeriod.textContent = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(parseDate(selectedDate));
    return;
  }

  const week = getWeekDates(selectedDate);
  elements.currentPeriod.textContent = `${formatShortDate(week[0])} a ${formatShortDate(week[6])}`;
}

function renderSummary(periodAppointments) {
  elements.summaryStrip.innerHTML = "";

  const total = createSummaryPill("Total", String(periodAppointments.length));
  elements.summaryStrip.append(total);

  ROOMS.forEach((room) => {
    const count = periodAppointments.filter((item) => item.room === room.id).length;
    elements.summaryStrip.append(createSummaryPill(room.name, String(count)));
  });
}

function createSummaryPill(label, value) {
  const pill = document.createElement("span");
  pill.className = "summary-pill";
  pill.innerHTML = `<strong>${value}</strong>${label}`;
  return pill;
}

function renderDayView() {
  const visibleRooms = getVisibleRooms();
  const dayAppointments = sortAppointments(
    filterAppointments(appointments).filter((item) => item.date === selectedDate),
  );
  elements.scheduleContent.innerHTML = "";

  if (isMobileLayout()) {
    renderMobileDayList(dayAppointments);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "day-grid-wrap";

  const timeColWidth = 64;
  const colMinWidth = 190;
  const minGridWidth = timeColWidth + visibleRooms.length * 220;

  const grid = document.createElement("div");
  grid.className = "day-grid";
  grid.style.gridTemplateColumns = `${timeColWidth}px repeat(${visibleRooms.length}, minmax(${colMinWidth}px, 1fr))`;
  grid.style.minWidth = `${minGridWidth}px`;

  const timeColumn = document.createElement("div");
  timeColumn.className = "time-column";
  
  timeColumn.append(createHeaderCell("Horário", "time-head"));

  for (let hour = 7; hour < 22; hour += 1) {
    const slot = document.createElement("div");
    slot.className = "time-slot";
    slot.textContent = `${String(hour).padStart(2, "0")}:00`;
    timeColumn.append(slot);
  }

  grid.append(timeColumn);

  visibleRooms.forEach((room) => {
    const column = document.createElement("div");
    column.className = "room-column";
    column.dataset.roomId = room.id;
    column.append(createHeaderCell(room.name));

    // Drag and Drop
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      column.classList.add("drag-over");
      updateDropPreview(column, room, e.clientY);
    });
    column.addEventListener("dragleave", () => {
      column.classList.remove("drag-over");
      hideDropPreview(column);
    });
    column.addEventListener("drop", async (e) => {
      e.preventDefault();
      column.classList.remove("drag-over");
      hideDropPreview(column);
      
      const id = draggedAppointmentId || e.dataTransfer.getData("text/plain");
      const app = appointments.find((item) => item.id === id);
      if (!app) return;

      const duration = timeToMinutes(app.end) - timeToMinutes(app.start);
      const newStartMinutes = getSnappedStartMinutes(column, e.clientY, duration);
      const newEndMinutes = newStartMinutes + duration;

      await rescheduleAppointment(app, {
        room: room.id,
        start: minutesToTime(newStartMinutes),
        end: minutesToTime(newEndMinutes),
        date: selectedDate
      });
    });

    dayAppointments
      .filter((item) => item.room === room.id)
      .forEach((appointment) => {
        column.append(createAppointmentBlock(appointment, room.className));
      });

    grid.append(column);
  });

  wrap.append(grid);
  elements.scheduleContent.append(wrap);

  if (!dayAppointments.length) {
    elements.scheduleContent.append(createEmptyState("Nenhum atendimento neste dia."));
  }
}

function renderMobileDayList(dayAppointments) {
  const list = document.createElement("div");
  list.className = "mobile-agenda-list";

  if (!dayAppointments.length) {
    elements.scheduleContent.append(createEmptyState("Nenhum atendimento neste dia."));
    return;
  }

  dayAppointments.forEach((appointment) => {
    list.append(createMobileAppointmentCard(appointment));
  });

  elements.scheduleContent.append(list);
}

function getSnappedStartMinutes(column, clientY, duration) {
  const rect = column.getBoundingClientRect();
  const y = clientY - dragOffsetY - rect.top - GRID_HEADER_HEIGHT - APPOINTMENT_BLOCK_INSET / 2;
  const slotIndex = Math.round(y / SLOT_HEIGHT);
  const snappedMinutes = OPEN_MINUTES + slotIndex * DROP_SNAP_MINUTES;
  return Math.max(OPEN_MINUTES, Math.min(snappedMinutes, CLOSE_MINUTES - duration));
}

function getBlockTop(startMinutes) {
  return GRID_HEADER_HEIGHT + ((startMinutes - OPEN_MINUTES) / DROP_SNAP_MINUTES) * SLOT_HEIGHT + APPOINTMENT_BLOCK_INSET / 2;
}

function getBlockHeight(appointment) {
  const duration = timeToMinutes(appointment.end) - timeToMinutes(appointment.start);
  return Math.max(64, (duration / DROP_SNAP_MINUTES) * SLOT_HEIGHT - APPOINTMENT_BLOCK_INSET);
}

function updateDropPreview(column, room, clientY) {
  if (!draggedAppointmentId) {
    hideDropPreview(column);
    return;
  }

  const appointment = appointments.find((item) => item.id === draggedAppointmentId);
  if (!appointment) {
    hideDropPreview(column);
    return;
  }

  const duration = timeToMinutes(appointment.end) - timeToMinutes(appointment.start);
  const start = getSnappedStartMinutes(column, clientY, duration);
  const end = start + duration;
  const preview = getDropPreview(column);

  preview.className = `drop-preview ${room.className}`;
  preview.style.top = `${getBlockTop(start)}px`;
  preview.style.height = `${Math.max(64, (duration / DROP_SNAP_MINUTES) * SLOT_HEIGHT - APPOINTMENT_BLOCK_INSET)}px`;
  preview.textContent = `${minutesToTime(start)} - ${minutesToTime(end)}`;
}

function getDropPreview(column) {
  let preview = column.querySelector(".drop-preview");

  if (!preview) {
    preview = document.createElement("div");
    preview.className = "drop-preview is-hidden";
    column.append(preview);
  }

  return preview;
}

function hideDropPreview(column) {
  column.querySelector(".drop-preview")?.classList.add("is-hidden");
}

function hideAllDropPreviews() {
  document.querySelectorAll(".drop-preview").forEach((preview) => preview.classList.add("is-hidden"));
}

async function rescheduleAppointment(appointment, changes) {
  const updatedApp = {
    ...appointment,
    ...changes,
  };

  if (
    appointment.room === updatedApp.room &&
    appointment.start === updatedApp.start &&
    appointment.end === updatedApp.end &&
    appointment.date === updatedApp.date
  ) {
    return;
  }

  await saveRescheduledAppointment(updatedApp);
}

async function saveRescheduledAppointment(updatedApp) {
  const validation = validateAppointment(updatedApp);
  if (!validation.ok) {
    setSyncStatus("Conflito", "error");
    showGlobalMessage(validation.message, "error");
    return false;
  }

  setSyncStatus("Salvando...", "loading");

  try {
    appointments = await persistAppointment(updatedApp);
    render();
    setStorageStatus();
    showGlobalMessage("Atendimento reagendado.", "success");
    return true;
  } catch (error) {
    setSyncStatus("Erro ao salvar", "error");
    showGlobalMessage(error.message || "Não foi possível reagendar.", "error");
    setStorageStatus();
    return false;
  }
}

function renderWeekView() {
  const week = getWeekDates(selectedDate);
  const weekDates = new Set(week.map(toDateInputValue));
  const weekAppointments = sortAppointments(filterAppointments(appointments).filter((item) => weekDates.has(item.date)));

  elements.scheduleContent.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "week-grid";

  week.forEach((date) => {
    const dateValue = toDateInputValue(date);
    const column = document.createElement("section");
    column.className = "day-column";
    column.append(createColumnHeading(formatWeekday(dateValue), formatShortDate(date)));

    // Drag and Drop
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      column.classList.add("drag-over");
    });
    column.addEventListener("dragleave", () => {
      column.classList.remove("drag-over");
    });
    column.addEventListener("drop", async (e) => {
      e.preventDefault();
      column.classList.remove("drag-over");
      
      const id = e.dataTransfer.getData("text/plain");
      const app = appointments.find((item) => item.id === id);
      if (!app) return;

      if (app.date === dateValue) {
        return;
      }

      const updatedApp = {
        ...app,
        date: dateValue
      };

      await saveRescheduledAppointment(updatedApp);
    });

    const list = document.createElement("div");
    list.className = "appointment-list";

    const dayAppointments = weekAppointments.filter((item) => item.date === dateValue);
    if (dayAppointments.length) {
      dayAppointments.forEach((appointment) => list.append(createAppointmentCard(appointment, true)));
    } else {
      list.append(createMutedText("Sem atendimentos"));
    }

    column.append(list);
    grid.append(column);
  });

  elements.scheduleContent.append(grid);
}

function renderMonthView() {
  const monthDates = getMonthCalendarDates(selectedDate);
  const monthAppointments = sortAppointments(filterAppointments(appointments));
  const selectedDateObject = parseDate(selectedDate);
  const selectedMonth = selectedDateObject.getMonth();
  const selectedYear = selectedDateObject.getFullYear();

  elements.scheduleContent.innerHTML = "";

  if (isMobileLayout()) {
    renderMobileMonthList(monthAppointments, selectedMonth, selectedYear);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "month-grid";

  ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].forEach((weekday) => {
    const header = document.createElement("div");
    header.className = "month-weekday";
    header.textContent = weekday;
    grid.append(header);
  });

  monthDates.forEach((date) => {
    const dateValue = toDateInputValue(date);
    const cell = document.createElement("section");
    cell.className = "month-day";

    if (date.getMonth() !== selectedMonth) {
      cell.classList.add("outside-month");
    }

    if (dateValue === toDateInputValue(new Date())) {
      cell.classList.add("today");
    }

    const dateLabel = document.createElement("span");
    dateLabel.className = "month-date";
    dateLabel.textContent = String(date.getDate());

    const events = document.createElement("div");
    events.className = "month-events";

    const dayAppointments = monthAppointments.filter((item) => item.date === dateValue);
    dayAppointments.slice(0, 3).forEach((appointment) => {
      events.append(createMonthEvent(appointment));
    });

    if (dayAppointments.length > 3) {
      const more = document.createElement("span");
      more.className = "muted-small";
      more.textContent = `+${dayAppointments.length - 3} atendimento(s)`;
      events.append(more);
    }

    cell.append(dateLabel, events);
    grid.append(cell);
  });

  const wrap = document.createElement("div");
  wrap.className = "month-grid-wrap";
  wrap.append(grid);
  elements.scheduleContent.append(wrap);
}

function renderMobileMonthList(monthAppointments, selectedMonth, selectedYear) {
  const visibleMonthAppointments = monthAppointments.filter((item) => {
    const date = parseDate(item.date);
    return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
  });
  const byDate = new Map();

  visibleMonthAppointments.forEach((appointment) => {
    if (!byDate.has(appointment.date)) {
      byDate.set(appointment.date, []);
    }

    byDate.get(appointment.date).push(appointment);
  });

  if (!byDate.size) {
    elements.scheduleContent.append(createEmptyState("Nenhum atendimento neste mês."));
    return;
  }

  const list = document.createElement("div");
  list.className = "mobile-month-list";

  Array.from(byDate.entries()).forEach(([date, dayAppointments]) => {
    const section = document.createElement("section");
    section.className = "mobile-date-group";

    const heading = document.createElement("header");
    heading.className = "mobile-date-heading";

    const title = document.createElement("h3");
    title.textContent = `${formatWeekday(date)}, ${formatDate(date)}`;

    const count = document.createElement("span");
    count.textContent = `${dayAppointments.length} atendimento${dayAppointments.length === 1 ? "" : "s"}`;

    heading.append(title, count);
    section.append(heading);

    dayAppointments.forEach((appointment) => {
      section.append(createMobileAppointmentCard(appointment));
    });

    list.append(section);
  });

  elements.scheduleContent.append(list);
}

function renderRoomsView() {
  const week = getWeekDates(selectedDate);
  const weekDates = new Set(week.map(toDateInputValue));
  const weekAppointments = sortAppointments(filterAppointments(appointments).filter((item) => weekDates.has(item.date)));
  const visibleRooms = getVisibleRooms();

  elements.scheduleContent.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "rooms-grid";
  if (!isMobileLayout()) {
    grid.style.gridTemplateColumns = `repeat(${visibleRooms.length}, minmax(220px, 1fr))`;
  }

  visibleRooms.forEach((room) => {
    const column = document.createElement("section");
    column.className = "room-week-column";
    column.append(createColumnHeading(room.name, "Semana selecionada"));

    // Drag and Drop
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      column.classList.add("drag-over");
    });
    column.addEventListener("dragleave", () => {
      column.classList.remove("drag-over");
    });
    column.addEventListener("drop", async (e) => {
      e.preventDefault();
      column.classList.remove("drag-over");
      
      const id = e.dataTransfer.getData("text/plain");
      const app = appointments.find((item) => item.id === id);
      if (!app) return;

      if (app.room === room.id) {
        return;
      }

      const updatedApp = {
        ...app,
        room: room.id
      };

      await saveRescheduledAppointment(updatedApp);
    });

    const list = document.createElement("div");
    list.className = "appointment-list";
    const roomAppointments = weekAppointments.filter((item) => item.room === room.id);

    if (roomAppointments.length) {
      roomAppointments.forEach((appointment) => list.append(createAppointmentCard(appointment, true)));
    } else {
      list.append(createMutedText("Sala livre na semana"));
    }

    column.append(list);
    grid.append(column);
  });

  elements.scheduleContent.append(grid);
}

function createHeaderCell(text, className = "") {
  const cell = document.createElement("div");
  cell.className = `grid-head ${className}`.trim();
  cell.textContent = text;
  return cell;
}

function createColumnHeading(title, subtitle) {
  const heading = document.createElement("header");
  heading.className = "column-heading";

  const strong = document.createElement("strong");
  strong.textContent = title;
  const span = document.createElement("span");
  span.textContent = subtitle;

  heading.append(strong, span);
  return heading;
}

function createAppointmentBlock(appointment, roomClassName) {
  const block = document.createElement("button");
  block.type = "button";
  block.className = `appointment-block ${roomClassName}`;
  block.style.top = `${getBlockTop(timeToMinutes(appointment.start))}px`;
  block.style.height = `${getBlockHeight(appointment)}px`;
  block.title = "Editar atendimento";
  block.setAttribute("aria-label", getAppointmentActionLabel("Editar", appointment));
  block.innerHTML = `
    <span class="block-time">${appointment.start} - ${appointment.end}</span>
    <span class="block-patient">${escapeHtml(appointment.patient)}</span>
    <span class="block-meta">${escapeHtml(appointment.psychologist)}</span>
  `;
  block.addEventListener("click", (event) => {
    if (block.dataset.suppressClick === "true") {
      delete block.dataset.suppressClick;
      return;
    }

    editAppointment(appointment.id, event.currentTarget);
  });

  if (!isMobileLayout()) {
    block.setAttribute("draggable", "true");
    block.addEventListener("pointerdown", (event) => captureDragOffset(event, block));
    block.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      captureDragOffset(e, block);
      draggedAppointmentId = appointment.id;
      e.dataTransfer.setData("text/plain", appointment.id);
      e.dataTransfer.effectAllowed = "move";
      block.classList.add("dragging");
      document.body.classList.add("is-dragging-appointment");
    });
    block.addEventListener("dragend", (e) => {
      e.stopPropagation();
      draggedAppointmentId = "";
      dragOffsetY = 0;
      block.classList.remove("dragging");
      document.body.classList.remove("is-dragging-appointment");
      hideAllDropPreviews();
    });
  }

  return block;
}

function captureDragOffset(event, element) {
  if (event.pointerType && event.pointerType !== "mouse") {
    return;
  }

  if (event.clientY <= 0) {
    return;
  }

  const rect = element.getBoundingClientRect();
  dragOffsetY = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
}

function createAppointmentCard(appointment, showDate) {
  const fragment = elements.appointmentTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".appointment-card");
  const room = ROOMS.find((item) => item.id === appointment.room);

  card.style.borderColor = getRoomColor(room?.className);
  card.querySelector(".appointment-time").textContent = `${showDate ? `${formatShortDate(parseDate(appointment.date))} · ` : ""}${appointment.start} - ${appointment.end}`;
  card.querySelector(".appointment-patient").textContent = appointment.patient;
  card.querySelector(".appointment-meta").textContent = `${appointment.psychologist} · ${getRoomName(appointment.room)}`;

  const editButton = card.querySelector(".edit");
  const deleteButton = card.querySelector(".delete");

  editButton.setAttribute("aria-label", getAppointmentActionLabel("Editar", appointment));
  deleteButton.setAttribute("aria-label", getAppointmentActionLabel("Excluir", appointment));
  editButton.addEventListener("click", (event) => editAppointment(appointment.id, event.currentTarget));
  deleteButton.addEventListener("click", () => deleteAppointment(appointment.id));

  if (!isMobileLayout()) {
    card.setAttribute("draggable", "true");
    card.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      draggedAppointmentId = appointment.id;
      e.dataTransfer.setData("text/plain", appointment.id);
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
      document.body.classList.add("is-dragging-appointment");
    });
    card.addEventListener("dragend", (e) => {
      e.stopPropagation();
      draggedAppointmentId = "";
      dragOffsetY = 0;
      card.classList.remove("dragging");
      document.body.classList.remove("is-dragging-appointment");
    });
  }

  return card;
}

function createMobileAppointmentCard(appointment) {
  const room = ROOMS.find((item) => item.id === appointment.room);
  const card = document.createElement("article");
  card.className = `mobile-appointment-card ${room?.className || ""}`.trim();

  const main = document.createElement("button");
  main.type = "button";
  main.className = "mobile-card-main";
  main.title = "Editar atendimento";
  main.setAttribute("aria-label", getAppointmentActionLabel("Editar", appointment));
  main.addEventListener("click", (event) => editAppointment(appointment.id, event.currentTarget));

  const top = document.createElement("div");
  top.className = "mobile-card-top";

  const time = document.createElement("span");
  time.className = "mobile-card-time";
  time.textContent = `${appointment.start} - ${appointment.end}`;

  const roomBadge = document.createElement("span");
  roomBadge.className = "room-badge";
  roomBadge.textContent = getRoomName(appointment.room);

  const patient = document.createElement("h3");
  patient.textContent = appointment.patient;

  const meta = document.createElement("p");
  meta.className = "mobile-card-meta";
  meta.textContent = appointment.psychologist || "Profissional não informada";

  top.append(time, roomBadge);
  main.append(top, patient, meta);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "mobile-delete-button";
  remove.textContent = "Excluir";
  remove.setAttribute("aria-label", getAppointmentActionLabel("Excluir", appointment));
  remove.addEventListener("click", () => deleteAppointment(appointment.id));

  card.append(main, remove);
  return card;
}

function createMonthEvent(appointment) {
  const room = ROOMS.find((item) => item.id === appointment.room);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `month-event ${room?.className || ""}`.trim();
  button.title = "Editar atendimento";
  button.textContent = `${appointment.start} ${appointment.patient}`;
  button.setAttribute("aria-label", getAppointmentActionLabel("Editar", appointment));
  button.addEventListener("click", (event) => editAppointment(appointment.id, event.currentTarget));
  return button;
}

function getAppointmentActionLabel(action, appointment) {
  return `${action} atendimento de ${appointment.patient}, ${formatDate(appointment.date)}, das ${appointment.start} às ${appointment.end}`;
}

function createMutedText(text) {
  const paragraph = document.createElement("p");
  paragraph.className = "muted-small";
  paragraph.textContent = text;
  return paragraph;
}

function createEmptyState(text) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = text;
  return empty;
}

async function refreshAppointments(options = {}) {
  if (elements.submit.disabled) {
    return;
  }

  if (!options.silent) {
    setStorageStatus("loading");
  }

  try {
    appointments = await loadAppointments();
    render();
    setStorageStatus();
  } catch (error) {
    appointments = loadLocalAppointments();
    render();
    setSyncStatus("Erro na planilha", "error");

    if (!options.silent) {
      showFeedback(error.message || "Nao foi possivel carregar a planilha.", "error");
    }
  }
}

async function loadAppointments() {
  if (!isRemoteStorageEnabled()) {
    remoteBackendMode = "local";
    return loadLocalAppointments();
  }

  const response = await fetchRemoteList();

  if (Array.isArray(response)) {
    remoteBackendMode = "legacy";
    return normalizeAppointments(response);
  }

  if (response.ok) {
    remoteBackendMode = "modern";
    return normalizeAppointments(response.appointments || []);
  }

  if (/chave de acesso/i.test(response.message || "")) {
    const authedResponse = await apiRequest("list");
    remoteBackendMode = "modern";
    return normalizeAppointments(authedResponse.appointments || []);
  }

  throw new Error(response.message || "Erro na planilha.");
}

async function persistAppointment(appointment) {
  if (!isRemoteStorageEnabled()) {
    const nextAppointments = upsertAppointment(appointments, appointment);
    saveLocalAppointments(nextAppointments);
    return nextAppointments;
  }

  setSyncStatus("Salvando...", "loading");

  if (remoteBackendMode === "unknown") {
    await loadAppointments();
  }

  if (remoteBackendMode === "legacy") {
    const nextAppointments = upsertAppointment(appointments, appointment);
    await writeLegacyAppointments(nextAppointments);
    setSyncStatus("Planilha legado", "online");
    return nextAppointments;
  }

  const response = await apiRequest("save", appointment);
  setSyncStatus("Planilha sincronizada", "online");
  return normalizeAppointments(response.appointments || []);
}

async function removeAppointment(id) {
  if (!isRemoteStorageEnabled()) {
    const nextAppointments = appointments.filter((item) => item.id !== id);
    saveLocalAppointments(nextAppointments);
    return nextAppointments;
  }

  if (remoteBackendMode === "unknown") {
    await loadAppointments();
  }

  if (remoteBackendMode === "legacy") {
    const nextAppointments = appointments.filter((item) => item.id !== id);
    await writeLegacyAppointments(nextAppointments);
    return nextAppointments;
  }

  const response = await apiRequest("delete", { id });
  return normalizeAppointments(response.appointments || []);
}

function upsertAppointment(items, appointment) {
  const existingIndex = items.findIndex((item) => item.id === appointment.id);

  if (existingIndex >= 0) {
    const nextAppointments = [...items];
    nextAppointments[existingIndex] = appointment;
    return nextAppointments;
  }

  return [...items, appointment];
}

function loadLocalAppointments() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return normalizeAppointments(saved ? JSON.parse(saved) : []);
  } catch {
    return [];
  }
}

function saveLocalAppointments(nextAppointments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAppointments));
}

async function fetchRemoteList() {
  const url = new URL(CONFIG.apiUrl);
  url.searchParams.set("action", "list");

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Nao foi possivel carregar a planilha.");
    }

    return response.json();
  } catch {
    return jsonpRequest("list", {});
  }
}

async function writeLegacyAppointments(nextAppointments) {
  const payload = nextAppointments.map((appointment) => ({
    date: appointment.date,
    startTime: appointment.start,
    endTime: appointment.end,
    patient: appointment.patient,
    room: getRoomName(appointment.room),
  }));

  await fetch(CONFIG.apiUrl, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    method: "POST",
    mode: "no-cors",
  });

  saveLocalAppointments(nextAppointments);
}

async function apiRequest(action, payload = {}, allowAccessKeyRetry = true) {
  const response = await jsonpRequest(action, payload);

  if (response.ok) {
    return response;
  }

  if (allowAccessKeyRetry && /chave de acesso/i.test(response.message || "")) {
    sessionStorage.removeItem(ACCESS_KEY_STORAGE_KEY);
    const accessKey = await requestAccessKey();

    if (!accessKey) {
      throw new Error("Chave de acesso obrigatoria.");
    }

    sessionStorage.setItem(ACCESS_KEY_STORAGE_KEY, accessKey);
    return apiRequest(action, payload, false);
  }

  throw new Error(response.message || "Erro na planilha.");
}

function jsonpRequest(action, payload) {
  return new Promise((resolve, reject) => {
    const callbackName = `agendaCallback_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const url = new URL(CONFIG.apiUrl);
    const script = document.createElement("script");
    let timeoutId = 0;

    url.searchParams.set("action", action);
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("payload", JSON.stringify(payload));

    const accessKey = sessionStorage.getItem(ACCESS_KEY_STORAGE_KEY);
    if (accessKey) {
      url.searchParams.set("key", accessKey);
    }

    window[callbackName] = (response) => {
      window.clearTimeout(timeoutId);
      cleanupJsonp(script, callbackName);
      resolve(response);
    };

    script.src = url.toString();
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      cleanupJsonp(script, callbackName);
      reject(new Error("Nao foi possivel conectar ao Apps Script."));
    };

    timeoutId = window.setTimeout(() => {
      cleanupJsonp(script, callbackName);
      reject(new Error("Tempo esgotado ao conectar com a planilha."));
    }, 15000);

    document.body.append(script);
  });
}

function cleanupJsonp(script, callbackName) {
  delete window[callbackName];
  script.remove();
}

function isRemoteStorageEnabled() {
  return Boolean(CONFIG.apiUrl && /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/i.test(CONFIG.apiUrl));
}

function normalizeAppointments(items) {
  return items
    .map(normalizeAppointment)
    .filter((appointment) => appointment.id && appointment.patient && appointment.date && appointment.start && appointment.end && appointment.room);
}

function normalizeAppointment(item) {
  if (isShiftedLegacyAppointment(item)) {
    const start = String(item.patient || "").trim();

    return {
      id: String(item.id || createId()).trim(),
      patient: String(item.psychologist || "").trim(),
      psychologist: "",
      date: normalizeDateValue(item.id),
      start,
      end: minutesToTime(Math.min(timeToMinutes(start || "08:00") + 60, CLOSE_MINUTES)),
      room: normalizeRoomId(item.date),
      notes: "",
      createdAt: "",
      updatedAt: "",
    };
  }

  const start = String(item.start || item.startTime || "").trim();
  const end = String(item.end || item.endTime || "").trim() || minutesToTime(Math.min(timeToMinutes(start || "08:00") + 60, CLOSE_MINUTES));

  return {
    id: String(item.id || createId()),
    patient: String(item.patient || "").trim(),
    psychologist: cleanLookupError(item.psychologist),
    date: normalizeDateValue(item.date),
    start,
    end,
    room: normalizeRoomId(item.room),
    notes: String(item.notes || "").trim(),
    createdAt: String(item.createdAt || "").trim(),
    updatedAt: String(item.updatedAt || "").trim(),
  };
}

function isShiftedLegacyAppointment(item) {
  return (
    /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(item.id || "").trim()) &&
    /^\d{1,2}:\d{2}$/.test(String(item.patient || "").trim()) &&
    Boolean(String(item.psychologist || "").trim()) &&
    Boolean(String(item.date || "").trim()) &&
    !String(item.start || "").trim() &&
    !String(item.end || "").trim()
  );
}

function normalizeDateValue(value) {
  const text = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parts = text.split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }

  return text;
}

function normalizeRoomId(value) {
  const room = String(value || "").trim();

  if (isAllowedRoomId(room)) {
    return room;
  }

  return ROOMS.find((availableRoom) => normalize(availableRoom.name) === normalize(room))?.id || "";
}

function cleanLookupError(value) {
  const text = String(value || "").trim();
  return /^#N\/A(?:\s*\(\))?$/.test(text) ? "" : text;
}

function getAppointmentsForSelectedPeriod() {
  const visibleAppointments = filterAppointments(appointments);

  if (currentView === "day") {
    return visibleAppointments.filter((item) => item.date === selectedDate);
  }

  if (currentView === "month") {
    const base = parseDate(selectedDate);
    return visibleAppointments.filter((item) => {
      const date = parseDate(item.date);
      return date.getFullYear() === base.getFullYear() && date.getMonth() === base.getMonth();
    });
  }

  const weekDates = new Set(getWeekDates(selectedDate).map(toDateInputValue));
  return visibleAppointments.filter((item) => weekDates.has(item.date));
}

function getVisibleRooms() {
  const filter = elements.filterRoom.value;
  return filter === "all" ? ROOMS : ROOMS.filter((room) => room.id === filter);
}

function isAllowedRoomId(roomId) {
  return ROOMS.some((room) => room.id === roomId);
}

function filterAppointments(items) {
  let filtered = items;

  const roomFilter = elements.filterRoom.value;
  if (roomFilter !== "all") {
    filtered = filtered.filter((item) => item.room === roomFilter);
  }

  if (elements.filterPsychologist) {
    const psyFilter = elements.filterPsychologist.value;
    if (psyFilter !== "all") {
      const psyFilterKey = normalizeNameKey(psyFilter);
      filtered = filtered.filter((item) => normalizeNameKey(item.psychologist) === psyFilterKey);
    }
  }

  return filtered;
}

function populateDirectoryOptions() {
  populateDatalist(elements.patientOptions, getPatientNames());
  populateDatalist(elements.psychologistOptions, getPsychologistNames());
}

function populateDatalist(datalist, names) {
  if (!datalist) return;

  datalist.replaceChildren(
    ...names.map((name) => {
      const option = document.createElement("option");
      option.value = name;
      return option;
    })
  );
}

function getPatientNames() {
  return getUniqueSortedNames([
    ...(Array.isArray(DIRECTORY.patients) ? DIRECTORY.patients : []),
    ...appointments.map((app) => app.patient),
  ]);
}

function getPsychologistNames() {
  return getUniqueSortedNames([
    ...(Array.isArray(DIRECTORY.psychologists) ? DIRECTORY.psychologists : []),
    ...appointments.map((app) => app.psychologist),
  ]);
}

function getUniqueSortedNames(values) {
  const namesByKey = new Map();

  values.forEach((value) => {
    const name = cleanName(value);
    if (!name) {
      return;
    }

    const key = normalizeNameKey(name);
    if (!namesByKey.has(key)) {
      namesByKey.set(key, name);
    }
  });

  return Array.from(namesByKey.values()).sort(compareNames);
}

function cleanName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function compareNames(a, b) {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}

function normalizeNameKey(value) {
  return cleanName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function populatePsychologistFilter() {
  const select = elements.filterPsychologist;
  if (!select) return;

  const currentValue = select.value || "all";
  select.innerHTML = '<option value="all">Todas</option>';

  const psychologists = getPsychologistNames();

  psychologists.forEach((psy) => {
    const option = document.createElement("option");
    option.value = psy;
    option.textContent = psy;
    select.append(option);
  });

  if (psychologists.some((name) => normalizeNameKey(name) === normalizeNameKey(currentValue))) {
    select.value = psychologists.find((name) => normalizeNameKey(name) === normalizeNameKey(currentValue));
  } else {
    select.value = "all";
  }
}

function sortAppointments(items) {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return timeToMinutes(a.start) - timeToMinutes(b.start);
  });
}

function suggestEndTime() {
  if (!elements.start.value) {
    return;
  }

  const start = timeToMinutes(elements.start.value);
  const currentEnd = elements.end.value ? timeToMinutes(elements.end.value) : 0;

  if (!elements.end.value || currentEnd <= start) {
    elements.end.value = minutesToTime(Math.min(start + 60, CLOSE_MINUTES));
  }
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `appointment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setStorageStatus(state = "") {
  if (!isRemoteStorageEnabled()) {
    setSyncStatus("Local", "local");
    return;
  }

  if (state === "loading") {
    setSyncStatus("Carregando...", "loading");
    return;
  }

  setSyncStatus(remoteBackendMode === "legacy" ? "Planilha legado" : "Planilha", "online");
}

function setSyncStatus(message, state) {
  elements.syncStatus.textContent = message;
  elements.syncStatus.dataset.state = state;
}

function setFormBusy(isBusy) {
  elements.submit.disabled = isBusy;
  elements.submit.textContent = isBusy
    ? "Salvando..."
    : elements.appointmentId.value
      ? "Atualizar atendimento"
      : "Salvar atendimento";
}

function showFeedback(message, type) {
  elements.feedback.textContent = message;
  elements.feedback.classList.toggle("success", type === "success");
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekDates(dateValue) {
  const date = parseDate(dateValue);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    return current;
  });
}

function getMonthCalendarDates(dateValue) {
  const date = parseDate(dateValue);
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const startOffset = firstDay.getDay() === 0 ? -6 : 1 - firstDay.getDay();
  const firstVisibleDate = new Date(firstDay);
  firstVisibleDate.setDate(firstDay.getDate() + startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(firstVisibleDate);
    current.setDate(firstVisibleDate.getDate() + index);
    return current;
  });
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parseDate(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR").format(parseDate(value));
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatWeekday(value) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(parseDate(value));
}

function getRoomName(id) {
  return ROOMS.find((room) => room.id === id)?.name || id;
}

function getRoomColor(className) {
  const colors = {
    "room-1": "oklch(0.58 0.14 221)",
    "room-2": "oklch(0.55 0.17 294)",
    "room-3": "oklch(0.58 0.2 333)",
    "room-4": "oklch(0.55 0.15 259)",
  };
  return colors[className] || "oklch(0.58 0.14 221)";
}

function isMobileLayout() {
  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
