import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Save, UserRound } from 'lucide-react';
import { apiFetch } from '@/services/api';
import { setToken } from '@/services/auth';

interface CredentialsPanelProps {
  authToken: string;
}

export function CredentialsPanel({ authToken }: CredentialsPanelProps) {
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiFetch('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(async (response) => response.ok ? response.json() as Promise<{ username: string }> : null)
      .then((profile) => { if (profile) setUsername(profile.username); });
  }, [authToken]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    if (newPassword && newPassword !== confirmation) {
      setStatus({ type: 'error', text: 'La nueva contraseña y su confirmación no coinciden.' });
      return;
    }
    if (!currentPassword) {
      setStatus({ type: 'error', text: 'Ingrese su contraseña actual para confirmar el cambio.' });
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch('/api/auth/credentials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ current_password: currentPassword, username, new_password: newPassword || undefined }),
      });
      const body = await response.json() as { detail?: string; access_token?: string };
      if (!response.ok || !body.access_token) {
        setStatus({ type: 'error', text: body.detail ?? 'No fue posible actualizar las credenciales.' });
        return;
      }
      setToken(body.access_token);
      setCurrentPassword(''); setNewPassword(''); setConfirmation('');
      setStatus({ type: 'success', text: 'Credenciales actualizadas. Tu sesión sigue protegida con un token nuevo.' });
    } catch {
      setStatus({ type: 'error', text: 'No se pudo conectar con el servidor.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      <div className="flex gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
        <span className="rounded-xl bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300"><KeyRound className="h-6 w-6" /></span>
        <div><h2 className="text-xl font-bold text-slate-900 dark:text-white">Credenciales de acceso</h2><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Actualiza tu usuario o contraseña. Se requiere tu contraseña actual para confirmar.</p></div>
      </div>
      <form className="mt-6 space-y-5" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200"><span className="mb-1.5 flex items-center gap-2"><UserRound className="h-4 w-4" /> Usuario</span><input value={username} onChange={(event) => setUsername(event.target.value)} required maxLength={80} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Contraseña actual<input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" autoComplete="current-password" required className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
        <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Nueva contraseña <span className="font-normal text-slate-400">(opcional)</span><input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" minLength={8} autoComplete="new-password" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Confirmar nueva contraseña<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type="password" minLength={newPassword ? 8 : undefined} autoComplete="new-password" disabled={!newPassword} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label></div>
        {status ? <p className={'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ' + (status.type === 'success' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200')}>{status.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}{status.text}</p> : null}
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Guardando…' : 'Guardar credenciales'}</button>
      </form>
    </section>
  );
}
