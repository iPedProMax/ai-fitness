"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  APPEARANCE_KEY, APPEARANCE_UPDATED_EVENT, AVATAR_BUCKET,
  PROFILE_UPDATED_EVENT, PROFILE_FOCUS, compressAvatar,
  safeAvatarPath, validateProfileBio, validateProfileName,
  type KhaloriesAppearance, type ProfileFocus,
} from "@/lib/profile-appearance";

type Props = {
  userId: string;
  email: string;
  initialName: string;
  initialBio: string;
  initialFocus: ProfileFocus;
  initialAvatarPath: string | null;
};

export function ProfilePersonalization({ userId, email, initialName, initialBio, initialFocus, initialAvatarPath }: Props) {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [focus, setFocus] = useState<ProfileFocus>(initialFocus);
  const [avatarPath, setAvatarPath] = useState<string | null>(initialAvatarPath);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [busy, setBusy] = useState<"upload" | "remove" | "save" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<KhaloriesAppearance>("system");
  const [avatarIsDark, setAvatarIsDark] = useState(false);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(APPEARANCE_KEY);
      if (value === "light" || value === "dark" || value === "system") setAppearance(value);
    } catch { /* Local storage may be disabled. */ }
  }, []);

  // Track the actual active theme, including the header toggle and System changes.
  // CSS utility backgrounds must not override the avatar panel's theme surface.
  useEffect(() => {
    const root = document.documentElement;
    const syncAvatarTheme = () => setAvatarIsDark(root.getAttribute("data-aura-theme") === "dark");
    syncAvatarTheme();
    const observer = new MutationObserver(syncAvatarTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-aura-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const path = safeAvatarPath(userId, avatarPath);
    if (!path) { setAvatarUrl(null); return; }
    let alive = true;
    let objectUrl: string | null = null;
    const supabase = createClient();
    void supabase.storage.from(AVATAR_BUCKET).download(path).then(({ data, error: downloadError }) => {
      if (!alive || downloadError || !data) return;
      objectUrl = URL.createObjectURL(data);
      setAvatarUrl(objectUrl);
    });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [avatarPath, avatarRevision, userId]);

  async function verifyUser() {
    const client = createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user || user.id !== userId) throw new Error("Please sign in again before editing your profile.");
    return client;
  }

  function announce(message: string) {
    setNotice(message);
    setError(null);
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
  }

  async function onAvatarSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setError(null); setNotice(null); setBusy("upload");
    try {
      const compressed = await compressAvatar(file);
      const client = await verifyUser();
      const path = `${userId}/avatar.webp`;
      const { error: uploadError } = await client.storage.from(AVATAR_BUCKET)
        .upload(path, compressed, { contentType: "image/webp", cacheControl: "60", upsert: true });
      if (uploadError) throw new Error("Photo upload failed. Confirm the private avatar Storage migration is installed.");
      const { error: metadataError } = await client.auth.updateUser({ data: { khalories_avatar_path: path } });
      if (metadataError) throw new Error("Photo uploaded, but profile could not be updated. Try again.");
      // A revision refreshes the private download even if the avatar path is unchanged.
      setAvatarPath(path);
      setAvatarRevision(current => current + 1);
      announce(`Profile photo updated! Optimized to 256 × 256 WebP (${Math.round(compressed.size / 1024)} KB).`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't update your photo.");
    } finally { setBusy(null); }
  }

  async function removeAvatar() {
    if (busy || !avatarPath) return;
    setBusy("remove"); setError(null); setNotice(null);
    try {
      const client = await verifyUser();
      const path = safeAvatarPath(userId, avatarPath);
      if (!path) throw new Error("Invalid avatar path.");
      const { error: removeError } = await client.storage.from(AVATAR_BUCKET).remove([path]);
      if (removeError) throw new Error("Could not remove the avatar from private storage.");
      const { error: updateError } = await client.auth.updateUser({ data: { khalories_avatar_path: null } });
      if (updateError) throw new Error("Photo removed, but the profile needs refreshing.");
      setAvatarPath(null); setAvatarUrl(null);
      announce("Profile photo removed.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove photo."); }
    finally { setBusy(null); }
  }

  async function saveProfile() {
    if (busy) return;
    const normalizedName = validateProfileName(name);
    const normalizedBio = validateProfileBio(bio);
    if (!normalizedName) { setError("Your display name needs 2–40 characters."); return; }
    if (normalizedBio === null) { setError("Your bio must be 140 characters or fewer."); return; }
    setError(null); setNotice(null); setBusy("save");
    try {
      const client = await verifyUser();
      const { error: updateError } = await client.auth.updateUser({ data: {
        full_name: normalizedName, khalories_bio: normalizedBio, khalories_focus: focus,
      } });
      if (updateError) throw new Error("Could not save your profile. Please try again.");
      setName(normalizedName); setBio(normalizedBio);
      announce("Your profile is looking good! Changes saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save changes."); }
    finally { setBusy(null); }
  }

  function chooseAppearance(next: KhaloriesAppearance) {
    setAppearance(next);
    try { window.localStorage.setItem(APPEARANCE_KEY, next); }
    catch { /* Still update the current view. */ }
    const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-aura-theme", next === "system" ? (isSystemDark ? "dark" : "light") : next);
    window.dispatchEvent(new Event(APPEARANCE_UPDATED_EVENT));
  }

  const selectedFocus = PROFILE_FOCUS.find(item => item.value === focus) ?? PROFILE_FOCUS[0];
  return (
    <section className="space-y-5" aria-label="Profile customization">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">01 / Your profile</p><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Just for you</span></div>
        <h2 className="mt-2 text-xl font-extrabold">Give your profile some personality.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Make that little circle in the top-right actually look like you.</p>
        <div className="khalories-settings-avatar-panel mt-6 flex flex-wrap items-center gap-5 rounded-2xl p-4 sm:p-5"
          style={{ backgroundColor: avatarIsDark ? "#284438" : "#f4f9ef", color: avatarIsDark ? "#f3fbf4" : "#173221" }}>
          <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[28px] border-4 border-white bg-gradient-to-br from-emerald-600 to-lime-300 text-4xl font-extrabold text-white shadow-lg">
            {avatarUrl ? <img src={avatarUrl} alt="Current profile photo" className="h-full w-full object-cover" /> : <span>{(name.trim()[0] ?? "K").toUpperCase()}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-slate-900"><span style={{ color: avatarIsDark ? "#f3fbf4" : "#173221" }}>{name || "Your profile"}</span></p>
            <p className="truncate text-xs text-slate-600"><span style={{ color: avatarIsDark ? "#c3ddce" : "#526758" }}>{email}</span></p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className={`inline-flex min-h-10 items-center rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-800 ${busy ? "cursor-wait opacity-60" : "cursor-pointer"}`}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onAvatarSelected} disabled={busy !== null} className="sr-only" aria-label="Upload profile photo" />
                {busy === "upload" ? "Optimizing…" : "📷 Change photo"}
              </label>
              {avatarPath && <button type="button" onClick={removeAvatar} disabled={busy !== null} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:text-red-600 disabled:opacity-60">Remove</button>}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">JPG, PNG or WebP · Max original size 6 MB · Automatically cropped and converted to private 256 × 256 WebP under 128 KB.</p>
        <div className="mt-6 grid gap-4">
          <div>
            <label htmlFor="profile-display-name" className="text-sm font-bold">Display name</label>
            <input id="profile-display-name" value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="What should we call you?" autoComplete="nickname" className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm" />
          </div>
          <div>
            <label htmlFor="profile-bio" className="text-sm font-bold">Your little tagline <span className="font-normal text-slate-500">(optional)</span></label>
            <textarea id="profile-bio" value={bio} maxLength={140} onChange={e => setBio(e.target.value)} rows={2} placeholder="Big cravings. Bigger goals. ✨" className="mt-2 block w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm" />
            <p className="mt-1 text-right text-xs text-slate-500">{bio.length}/140</p>
          </div>
          <fieldset>
            <legend className="text-sm font-bold">What's your vibe right now?</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PROFILE_FOCUS.map(option => <button key={option.value} type="button" onClick={() => setFocus(option.value)} aria-pressed={focus === option.value}
                className={`min-h-12 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${focus === option.value ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"}`}>
                <span className="mr-1" aria-hidden="true">{option.emoji}</span>{option.label}</button>)}
            </div>
          </fieldset>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-500">Your current focus: <strong className="text-emerald-700">{selectedFocus.label}</strong></p>
          <button type="button" onClick={saveProfile} disabled={busy !== null} className="min-h-11 rounded-xl bg-emerald-700 px-5 py-2 text-sm font-extrabold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">{busy === "save" ? "Saving…" : "Save profile changes"}</button>
        </div>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">02 / Appearance</p>
        <h2 className="mt-2 text-xl font-extrabold">Set the mood.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">A fresh daylight look, cozy night mode, or whatever your device prefers.</p>
        <div role="group" aria-label="App appearance" className="mt-5 grid grid-cols-3 gap-2">
          {([{value:"light",label:"Light",emoji:"☀️"},{value:"dark",label:"Dark",emoji:"🌙"},{value:"system",label:"System",emoji:"💻"}] as const).map(option =>
            <button key={option.value} type="button" onClick={() => chooseAppearance(option.value)} aria-pressed={appearance === option.value}
              className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-xs font-extrabold transition ${appearance === option.value ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-200"}`}>
              <span aria-hidden="true" className="text-2xl">{option.emoji}</span>{option.label}
            </button>)}
        </div>
        <p className="mt-3 text-xs text-slate-500">Appearance is saved on this device. No AI credits used.</p>
      </div>
    </section>
  );
}
