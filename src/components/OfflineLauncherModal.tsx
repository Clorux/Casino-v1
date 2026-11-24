import React, { useRef, useState } from 'react';
import { Check, Copy, Download, Terminal, Upload, X } from 'lucide-react';

interface OfflineLauncherModalProps {
  open: boolean;
  onClose: () => void;
  onExportSave: () => void;
  onImportSave: (jsonText: string) => { ok: boolean; message: string };
}

const LAUNCH_COMMANDS = [
  {
    id: 'ps',
    platform: 'Windows PowerShell',
    webCmd: '.\\launch-casino.ps1',
    cliCmd: '.\\launch-casino.ps1 -CliOnly',
    notes: 'Launches the full 60fps offline web casino on localhost:3000, or pass -CliOnly to play directly inside PowerShell.',
  },
  {
    id: 'dos',
    platform: 'Windows CMD / DOS',
    webCmd: 'launch-casino.bat',
    cliCmd: 'node cli\\casino-cli.mjs',
    notes: 'Interactive batch launcher prompting for Web UI or zero-browser terminal mode.',
  },
  {
    id: 'unix',
    platform: 'macOS / Linux Terminal',
    webCmd: 'chmod +x launch-casino.sh && ./launch-casino.sh',
    cliCmd: './launch-casino.sh --cli',
    notes: 'Runs Vite completely offline with zero external API dependencies.',
  },
  {
    id: 'termux',
    platform: 'Android Termux',
    webCmd: 'pkg install nodejs-lts -y && chmod +x launch-termux.sh && ./launch-termux.sh',
    cliCmd: './launch-termux.sh --cli',
    notes: 'Auto-opens Android browser at http://127.0.0.1:3000 or plays natively inside Termux with --cli.',
  },
];

export const OfflineLauncherModal: React.FC<OfflineLauncherModalProps> = ({
  open,
  onClose,
  onExportSave,
  onImportSave,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const copyText = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const res = onImportSave(text);
      setImportNotice(res);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Offline PowerShell, Terminal, and Termux Launcher Guide"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-[#11161D] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-[#D4AF37]" aria-hidden="true" />
            <div>
              <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">
                100% Offline Launchers &amp; CLI Mode
              </h2>
              <p className="text-xs text-slate-400">
                Included scripts run locally in PowerShell, CMD/DOS, Linux/macOS Terminal &amp; Android Termux
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close offline launcher guide"
            onClick={onClose}
            className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-slate-500 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {LAUNCH_COMMANDS.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-800 bg-[#090C10] p-4">
              <div className="text-sm font-semibold text-slate-100">{item.platform}</div>
              <p className="mt-1 text-xs text-slate-400">{item.notes}</p>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-[#11161D] px-3 py-2">
                  <code className="font-mono-num overflow-x-auto text-xs text-[#ECCB63]">
                    {item.webCmd}
                  </code>
                  <button
                    type="button"
                    aria-label={`Copy ${item.platform} web launcher command`}
                    onClick={() => copyText(`${item.id}-web`, item.webCmd)}
                    className="shrink-0 text-slate-400 hover:text-white"
                  >
                    {copiedId === `${item.id}-web` ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-[#11161D] px-3 py-2">
                  <code className="font-mono-num overflow-x-auto text-xs text-emerald-300">
                    {item.cliCmd}
                  </code>
                  <button
                    type="button"
                    aria-label={`Copy ${item.platform} CLI command`}
                    onClick={() => copyText(`${item.id}-cli`, item.cliCmd)}
                    className="shrink-0 text-slate-400 hover:text-white"
                  >
                    {copiedId === `${item.id}-cli` ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {importNotice && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
              importNotice.ok
                ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-300'
                : 'border-rose-500/50 bg-rose-950/50 text-rose-300'
            }`}
          >
            {importNotice.message}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExportSave}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#171E28] px-4 py-2 text-xs font-semibold text-slate-100 hover:border-[#D4AF37]"
            >
              <Download className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
              <span>Export Save (JSON)</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#171E28] px-4 py-2 text-xs font-semibold text-slate-100 hover:border-emerald-400"
            >
              <Upload className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span>Import Save</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#D4AF37] px-5 py-2 text-xs font-bold text-[#090C10] hover:bg-[#ECCB63]"
          >
            Back to Floor
          </button>
        </div>
      </div>
    </div>
  );
};
