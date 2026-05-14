import React, { useRef, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Download, CheckCircle2, AlertCircle, FileText, ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type Field = "ignore" | "date" | "amount" | "type" | "category" | "subcategory" | "account" | "payee" | "note";
const FIELDS: { value: Field; label: string }[] = [
  { value: "ignore", label: "— Ignore" },
  { value: "date", label: "Date" },
  { value: "amount", label: "Amount" },
  { value: "type", label: "Type (income/expense)" },
  { value: "category", label: "Category (parent)" },
  { value: "subcategory", label: "Subcategory" },
  { value: "account", label: "Account name" },
  { value: "payee", label: "Payee" },
  { value: "note", label: "Note" },
];

const SAMPLE_CSV = `date,amount,type,category,subcategory,payee,note
2026-05-01,250,expense,Food & Drinks,Groceries,DMart,Weekly run
2026-05-02,5000,income,Income,Wage invoices,Acme Inc,May salary
2026-05-03,-300,,Vehicle,Fuel,Indian Oil,Tank refill
2026-05-04,1200,expense,Life & Entertainment,Holiday trips hotels,Booking.com,Hotel deposit`;

interface PreviewResp {
  columns: string[];
  suggested_mapping: Record<string, string>;
  preview_rows: string[][];
  total_rows: number;
}

interface CommitResp {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

const Import: React.FC = () => {
  const accounts = useAppStore((s) => s.accounts);
  const bumpRecords = useAppStore((s) => s.bumpRecords);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // column -> field
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [defaultType, setDefaultType] = useState<"income" | "expense">("expense");
  const [result, setResult] = useState<CommitResp | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    setFileName(f.name);
    const text = await f.text();
    setCsvText(text);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pocket-sample.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const runPreview = async () => {
    if (!csvText.trim()) return toast.error("Paste CSV text or pick a file first");
    setLoading(true);
    try {
      const { data } = await api.post<PreviewResp>("/import/preview", { csv_text: csvText });
      setPreview(data);
      // build column->field mapping from suggested_mapping (which is field->column)
      const inv: Record<string, string> = {};
      Object.entries(data.suggested_mapping).forEach(([field, col]) => { inv[col as string] = field; });
      const full: Record<string, string> = {};
      for (const c of data.columns) full[c] = inv[c] || "ignore";
      setMapping(full);
      setDefaultAccountId(accounts[0]?.id || "");
      setStep(2);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.detail || "Failed to parse CSV");
    } finally {
      setLoading(false);
    }
  };

  const runCommit = async () => {
    if (!defaultAccountId) return toast.error("Pick a default account");
    // Build mapping field->column (only mapped ones)
    const field2col: Record<string, string> = {};
    Object.entries(mapping).forEach(([col, field]) => {
      if (field !== "ignore") field2col[field] = col;
    });
    if (!field2col.amount) return toast.error("Please map the Amount column");
    setLoading(true);
    try {
      const { data } = await api.post<CommitResp>("/import/commit", {
        csv_text: csvText,
        mapping: field2col,
        default_account_id: defaultAccountId,
        default_type: defaultType,
      });
      setResult(data);
      bumpRecords();
      setStep(3);
      toast.success(`Imported ${data.imported} record${data.imported === 1 ? "" : "s"}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.detail || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(1); setCsvText(""); setFileName(""); setPreview(null); setMapping({}); setResult(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 md:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-stone-900 text-white">
          <Upload size={18} />
        </span>
        <div>
          <h1 className="font-['Outfit'] text-3xl font-bold text-stone-900">Import</h1>
          <p className="text-sm text-stone-500">Bring transactions from a CSV file — bank statement, spreadsheet or another app.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-3 mb-8 text-sm">
        {[1, 2, 3].map((n, i) => (
          <React.Fragment key={n}>
            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-['Outfit'] font-bold ${
              step >= n ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-400"
            }`}>{n}</span>
            <span className={step >= n ? "text-stone-900 font-medium" : "text-stone-400"}>
              {n === 1 ? "Upload" : n === 2 ? "Map columns" : "Done"}
            </span>
            {i < 2 && <ArrowRight size={14} className="text-stone-300" />}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div
            className="bg-white border-2 border-dashed border-stone-300 rounded-2xl p-10 text-center hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            data-testid="import-dropzone"
          >
            <FileText size={32} className="mx-auto mb-3 text-stone-400" />
            <div className="font-['Outfit'] font-semibold text-stone-900">
              {fileName ? fileName : "Drop a CSV file here or click to browse"}
            </div>
            <div className="text-xs text-stone-500 mt-1">Supports comma-separated values (.csv)</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              data-testid="import-file-input"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Or paste CSV</Label>
              <button onClick={downloadSample} className="text-xs text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1" data-testid="download-sample-btn">
                <Download size={12} /> Download sample template
              </button>
            </div>
            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={SAMPLE_CSV}
              rows={8}
              className="font-mono text-xs"
              data-testid="csv-textarea"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={runPreview} disabled={loading || !csvText.trim()} className="bg-emerald-600 hover:bg-emerald-700 rounded-full" data-testid="parse-csv-btn">
              {loading ? "Parsing..." : "Parse CSV"} <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <div className="space-y-5">
          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <h2 className="font-['Outfit'] font-bold text-lg mb-1">Map columns</h2>
            <p className="text-xs text-stone-500 mb-4">Detected <span className="font-semibold text-stone-900">{preview.total_rows} rows</span>. Tell Pocket what each column means.</p>
            <div className="space-y-2">
              {preview.columns.map((col) => (
                <div key={col} className="grid grid-cols-12 items-center gap-3" data-testid={`col-${col}`}>
                  <div className="col-span-5 truncate">
                    <span className="text-sm font-medium text-stone-900">{col}</span>
                    <div className="text-[10px] text-stone-400 truncate">e.g. {preview.preview_rows[0]?.[preview.columns.indexOf(col)] || "(empty)"}</div>
                  </div>
                  <div className="col-span-7">
                    <Select value={mapping[col] || "ignore"} onValueChange={(v) => setMapping((m) => ({ ...m, [col]: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Default account</Label>
              <Select value={defaultAccountId} onValueChange={setDefaultAccountId}>
                <SelectTrigger data-testid="default-account-select"><SelectValue placeholder="Pick account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-stone-400 mt-1">Used when a row has no Account column.</p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Default type</Label>
              <Select value={defaultType} onValueChange={(v: any) => setDefaultType(v)}>
                <SelectTrigger data-testid="default-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-stone-400 mt-1">Used when no Type column and amount sign is positive.</p>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-5 overflow-x-auto">
            <h3 className="text-xs uppercase tracking-wider text-stone-500 font-semibold mb-3">Preview (first 5 rows)</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-stone-500">
                  {preview.columns.map((c) => <th key={c} className="text-left font-semibold pb-2 px-2">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.preview_rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-stone-100">
                    {row.map((cell, j) => <td key={j} className="py-1.5 px-2 text-stone-700 truncate max-w-[200px]">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(1)} data-testid="back-step-btn"><RotateCcw size={14} className="mr-1.5" /> Back</Button>
            <Button onClick={runCommit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 rounded-full" data-testid="run-import-btn">
              {loading ? "Importing..." : `Import ${preview.total_rows} rows`} <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mb-4">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </div>
          <h2 className="font-['Outfit'] text-2xl font-bold text-stone-900">Import complete</h2>
          <p className="text-stone-500 mt-1">
            <span className="font-semibold text-emerald-600">{result.imported} record{result.imported === 1 ? "" : "s"} imported</span>
            {result.skipped > 0 && <> · <span className="text-rose-500 font-semibold">{result.skipped} skipped</span></>}
          </p>

          {result.errors.length > 0 && (
            <div className="mt-5 text-left bg-rose-50/50 border border-rose-200 rounded-xl p-4 max-h-48 overflow-y-auto">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-rose-600 font-semibold mb-2">
                <AlertCircle size={12} /> Skipped rows
              </div>
              <ul className="text-xs text-stone-700 space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i}><span className="font-mono text-stone-500">Row {e.row}:</span> {e.reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" onClick={reset} className="rounded-full" data-testid="import-again-btn"><RotateCcw size={14} className="mr-1.5" /> Import another</Button>
            <Button onClick={() => (window.location.href = "/records")} className="bg-emerald-600 hover:bg-emerald-700 rounded-full" data-testid="view-records-btn">
              View records <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Import;
