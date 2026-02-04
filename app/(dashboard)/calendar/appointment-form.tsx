"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XIcon, SearchIcon, TrashIcon, Loader2Icon, PlusIcon } from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";
import {
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  searchPatients,
  quickCreatePatient,
  type CalendarAppointment,
  type Provider,
  type Room,
  type Service,
  type PatientSearchResult,
} from "@/lib/actions/appointments";
import { StatusSelector } from "./appointment-card";

export type AppointmentFormProps = {
  isOpen: boolean;
  onClose: () => void;
  providers: Provider[];
  rooms: Room[];
  services: Service[];
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  // For creating new appointment
  initialStartTime?: Date;
  initialEndTime?: Date;
  // For editing existing appointment
  appointment?: CalendarAppointment;
};

export function AppointmentForm({
  isOpen,
  onClose,
  providers,
  rooms,
  services,
  permissions,
  initialStartTime,
  initialEndTime,
  appointment,
}: AppointmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = !!appointment;

  // Form state
  const [patientSearch, setPatientSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [providerId, setProviderId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("Scheduled");
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Reset form state whenever the modal opens with new data
  useEffect(() => {
    if (!isOpen) return;

    setError("");
    setShowDeleteConfirm(false);
    setPatientSearch("");
    setSearchResults([]);
    setShowNewPatient(false);
    setNewFirst("");
    setNewLast("");
    setNewEmail("");
    setNewPhone("");

    if (appointment) {
      // Editing mode - populate from appointment
      setSelectedPatient({
        id: appointment.patientId,
        firstName: appointment.patientName.split(" ")[0],
        lastName: appointment.patientName.split(" ").slice(1).join(" "),
        email: null,
        phone: null,
      });
      setProviderId(appointment.providerId);
      setServiceId(appointment.serviceId || "");
      setRoomId(appointment.roomId || "");
      setStartTime(formatDateTimeLocal(appointment.startTime));
      setEndTime(formatDateTimeLocal(appointment.endTime));
      setNotes(appointment.notes || "");
      setStatus(appointment.status);
    } else {
      // Create mode - reset to defaults
      setSelectedPatient(null);
      setProviderId(providers[0]?.id || "");
      setServiceId("");
      setRoomId("");
      setStartTime(formatDateTimeLocal(snapTo15Min(initialStartTime || new Date())));
      setEndTime(formatDateTimeLocal(snapTo15Min(initialEndTime || addMinutes(new Date(), 30))));
      setNotes("");
      setStatus("Scheduled");
    }
  }, [isOpen, appointment, initialStartTime, initialEndTime, providers]);

  // Debounced patient search
  useEffect(() => {
    if (patientSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPatients(patientSearch);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearch]);

  // Auto-calculate end time when service changes
  useEffect(() => {
    if (serviceId && !isEditing) {
      const service = services.find((s) => s.id === serviceId);
      if (service) {
        const start = new Date(startTime);
        const end = addMinutes(start, service.duration);
        setEndTime(formatDateTimeLocal(end));
      }
    }
  }, [serviceId, startTime, services, isEditing]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate new patient fields if creating a new patient inline
    if (showNewPatient && !selectedPatient) {
      if (!newFirst.trim() || !newLast.trim()) {
        setError("First name and last name are required");
        return;
      }
      if (!newEmail.trim()) {
        setError("Email is required for new patients");
        return;
      }
      if (!newPhone.trim()) {
        setError("Phone is required for new patients");
        return;
      }
    } else if (!selectedPatient) {
      setError("Please select a patient");
      return;
    }

    if (!providerId) {
      setError("Please select a provider");
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      setError("End time must be after start time");
      return;
    }

    startTransition(async () => {
      try {
        // Resolve patient ID — create new patient first if needed
        let patientId = selectedPatient?.id;

        if (showNewPatient && !selectedPatient) {
          const newPatient = await quickCreatePatient({
            firstName: newFirst.trim(),
            lastName: newLast.trim(),
            email: newEmail.trim(),
            phone: newPhone.trim(),
          });
          patientId = newPatient.id;
        }

        if (!patientId) {
          setError("Failed to resolve patient");
          return;
        }

        if (isEditing) {
          // Update existing appointment
          const result = await updateAppointment(appointment.id, {
            patientId,
            providerId,
            serviceId: serviceId || null,
            roomId: roomId || null,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            notes: notes || undefined,
          });

          if (!result.success) {
            setError(result.error || "Failed to update appointment");
            return;
          }

          // Update status if changed
          if (status !== appointment.status) {
            const statusResult = await updateAppointmentStatus(appointment.id, status);
            if (!statusResult.success) {
              setError(statusResult.error || "Failed to update status");
              return;
            }
          }
        } else {
          // Create new appointment
          const result = await createAppointment({
            patientId,
            providerId,
            serviceId: serviceId || undefined,
            roomId: roomId || undefined,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            notes: notes || undefined,
          });

          if (!result.success) {
            setError(result.error || "Failed to create appointment");
            return;
          }
        }

        router.refresh();
        onClose();
      } catch (err) {
        console.error("[AppointmentForm] Submit error:", err);
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    });
  };

  // Handle delete
  const handleDelete = () => {
    if (!appointment) return;

    startTransition(async () => {
      try {
        const result = await deleteAppointment(appointment.id);
        if (!result.success) {
          setError(result.error || "Failed to delete appointment");
          return;
        }
        router.refresh();
        onClose();
      } catch (err) {
        console.error("[AppointmentForm] Delete error:", err);
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    });
  };

  // Select patient from search
  const selectPatient = (patient: PatientSearchResult) => {
    setSelectedPatient(patient);
    setPatientSearch("");
    setSearchResults([]);
  };

  if (!isOpen) return null;

  const canSubmit = isEditing ? permissions.canEdit : permissions.canCreate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Edit Appointment" : "New Appointment"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          {/* Patient Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient *
            </label>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </div>
                  {(selectedPatient.email || selectedPatient.phone) && (
                    <div className="text-sm text-gray-500">
                      {selectedPatient.email || selectedPatient.phone}
                    </div>
                  )}
                </div>
                {canSubmit && (
                  <button
                    type="button"
                    onClick={() => setSelectedPatient(null)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                {!showNewPatient && (
                  <>
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      placeholder="Search by name, email, or phone..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      disabled={!canSubmit}
                    />
                    {isSearching && (
                      <Loader2Icon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                    )}

                    {/* Search Results Dropdown */}
                    {patientSearch.length >= 2 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {searchResults.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => selectPatient(patient)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div className="font-medium">
                              {patient.firstName} {patient.lastName}
                            </div>
                            {(patient.email || patient.phone) && (
                              <div className="text-sm text-gray-500">
                                {patient.email || patient.phone}
                              </div>
                            )}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const parts = patientSearch.trim().split(/\s+/);
                            if (parts.length >= 2) {
                              setNewFirst(parts[0]);
                              setNewLast(parts.slice(1).join(" "));
                            } else if (parts.length === 1) {
                              setNewFirst(parts[0]);
                            }
                            setShowNewPatient(true);
                            setSearchResults([]);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors border-t flex items-center gap-2 text-gray-700"
                        >
                          <PlusIcon className="h-4 w-4" />
                          <span>New Patient</span>
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Inline New Patient Form */}
                {showNewPatient && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-gray-700">New Patient</div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewPatient(false);
                          setNewFirst("");
                          setNewLast("");
                          setNewEmail("");
                          setNewPhone("");
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Back to search
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">First Name *</label>
                        <input
                          type="text"
                          value={newFirst}
                          onChange={(e) => setNewFirst(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                          placeholder="First name"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Last Name *</label>
                        <input
                          type="text"
                          value={newLast}
                          onChange={(e) => setNewLast(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                          placeholder="Last name"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Email *</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                          placeholder="email@example.com"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Phone *</label>
                        <input
                          type="tel"
                          value={newPhone}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                            let formatted = "";
                            if (digits.length > 6) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                            else if (digits.length > 3) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                            else if (digits.length > 0) formatted = `(${digits}`;
                            else formatted = "";
                            setNewPhone(formatted);
                          }}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                          placeholder="(555) 555-5555"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provider *
            </label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              disabled={!canSubmit}
              required
            >
              <option value="">Select provider...</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          {/* Service */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service
            </label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              disabled={!canSubmit}
            >
              <option value="">No service selected</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ({service.duration} min - ${service.price})
                </option>
              ))}
            </select>
          </div>

          {/* Room */}
          {rooms.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room
              </label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                disabled={!canSubmit}
              >
                <option value="">No room assigned</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date/Time */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={startTime.split("T")[0] || ""}
                onChange={(e) => {
                  const date = e.target.value;
                  const startTimePart = startTime.split("T")[1] || "09:00";
                  const endTimePart = endTime.split("T")[1] || "09:30";
                  setStartTime(`${date}T${startTimePart}`);
                  setEndTime(`${date}T${endTimePart}`);
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                disabled={!canSubmit}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <TimeSelect
                  value={startTime.split("T")[1] || ""}
                  onChange={(time) => {
                    const date = startTime.split("T")[0] || "";
                    setStartTime(`${date}T${time}`);
                  }}
                  disabled={!canSubmit}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time *
                </label>
                <TimeSelect
                  value={endTime.split("T")[1] || ""}
                  onChange={(time) => {
                    const date = endTime.split("T")[0] || "";
                    setEndTime(`${date}T${time}`);
                  }}
                  disabled={!canSubmit}
                />
              </div>
            </div>
          </div>

          {/* Status (only for editing) */}
          {isEditing && permissions.canEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <StatusSelector
                value={status}
                onChange={setStatus}
                disabled={!permissions.canEdit}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
              disabled={!canSubmit}
              placeholder="Optional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            {/* Delete button (only when editing and has permission) */}
            {isEditing && permissions.canDelete ? (
              showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-600">Delete?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isPending}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </button>
              )
            ) : (
              <div />
            )}

            {/* Submit/Cancel */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              {canSubmit && (
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
                  {isEditing ? "Save Changes" : "Create Appointment"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper functions
function formatDateTimeLocal(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

// Snap minutes to nearest 15-min interval (0, 15, 30, 45)
function snapTo15Min(date: Date): Date {
  const d = new Date(date);
  const minutes = d.getMinutes();
  const snapped = Math.round(minutes / 15) * 15;
  d.setMinutes(snapped, 0, 0);
  return d;
}

const MINUTE_OPTIONS = ["00", "15", "30", "45"];

function TimeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string; // "HH:MM"
  onChange: (time: string) => void;
  disabled?: boolean;
}) {
  const [hour, minute] = (value || "09:00").split(":");
  const hourNum = parseInt(hour, 10);
  const isPM = hourNum >= 12;
  const display12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHour12 = parseInt(e.target.value, 10);
    const newHour24 = isPM
      ? newHour12 === 12 ? 12 : newHour12 + 12
      : newHour12 === 12 ? 0 : newHour12;
    onChange(`${String(newHour24).padStart(2, "0")}:${minute}`);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${hour}:${e.target.value}`);
  };

  const handleAmPmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIsPM = e.target.value === "PM";
    let newHour24: number;
    if (newIsPM) {
      newHour24 = display12 === 12 ? 12 : display12 + 12;
    } else {
      newHour24 = display12 === 12 ? 0 : display12;
    }
    onChange(`${String(newHour24).padStart(2, "0")}:${minute}`);
  };

  const selectClass =
    "px-2 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white text-sm";

  return (
    <div className="flex gap-1">
      <select
        value={display12}
        onChange={handleHourChange}
        disabled={disabled}
        className={selectClass + " w-[4.5rem]"}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <select
        value={MINUTE_OPTIONS.includes(minute) ? minute : "00"}
        onChange={handleMinuteChange}
        disabled={disabled}
        className={selectClass + " w-[4rem]"}
      >
        {MINUTE_OPTIONS.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        value={isPM ? "PM" : "AM"}
        onChange={handleAmPmChange}
        disabled={disabled}
        className={selectClass + " w-[4rem]"}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
