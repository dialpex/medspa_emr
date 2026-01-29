"use client";

import { useEffect, useState } from "react";
import {
  getAccountProfile,
  updateAccountProfile,
  changePassword,
  type AccountProfile,
} from "@/lib/actions/account";

export default function AccountSettingsPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [form, setForm] = useState({
    name: "",
    alias: "",
    pronouns: "",
    email: "",
    phone: "",
  });
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ current: "", new: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    getAccountProfile().then((p) => {
      setProfile(p);
      setForm({
        name: p.name,
        alias: p.alias ?? "",
        pronouns: p.pronouns ?? "",
        email: p.email,
        phone: p.phone ?? "",
      });
    });
  }, []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileSaving(true);
    const res = await updateAccountProfile(form);
    setProfileSaving(false);
    if (res.success) {
      setProfileMsg({ type: "success", text: "Profile updated." });
    } else {
      setProfileMsg({ type: "error", text: res.error ?? "Failed to update." });
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pwForm.new !== pwForm.confirm) {
      setPwMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    setPwSaving(true);
    const res = await changePassword(pwForm.current, pwForm.new);
    setPwSaving(false);
    if (res.success) {
      setPwMsg({ type: "success", text: "Password changed." });
      setPwForm({ current: "", new: "", confirm: "" });
    } else {
      setPwMsg({ type: "error", text: res.error ?? "Failed to change password." });
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const inputCls =
    "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500";

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>

      {/* Profile Section */}
      <form onSubmit={handleProfileSave} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Profile</h2>

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-400 text-white text-xl font-bold">
            {initials}
          </div>
          <p className="text-sm text-gray-500">Profile image upload coming soon.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Alias</label>
            <input
              className={inputCls}
              value={form.alias}
              onChange={(e) => setForm({ ...form, alias: e.target.value })}
              placeholder="Display name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pronouns</label>
            <input
              className={inputCls}
              value={form.pronouns}
              onChange={(e) => setForm({ ...form, pronouns: e.target.value })}
              placeholder="e.g. she/her"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
            <input
              type="email"
              className={inputCls}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              className={inputCls}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        {profileMsg && (
          <p className={`text-sm ${profileMsg.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {profileMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={profileSaving}
          className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
        >
          {profileSaving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {/* Password Section */}
      <form onSubmit={handlePasswordChange} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>

        <div className="grid gap-4 sm:grid-cols-1 max-w-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Current Password</label>
            <input
              type="password"
              className={inputCls}
              value={pwForm.current}
              onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">New Password</label>
            <input
              type="password"
              className={inputCls}
              value={pwForm.new}
              onChange={(e) => setPwForm({ ...pwForm, new: e.target.value })}
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Confirm New Password</label>
            <input
              type="password"
              className={inputCls}
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              required
              minLength={8}
            />
          </div>
        </div>

        {pwMsg && (
          <p className={`text-sm ${pwMsg.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {pwMsg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={pwSaving}
          className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
        >
          {pwSaving ? "Changing..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
