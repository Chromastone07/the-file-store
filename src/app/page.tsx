"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner'; // Using this for all notifications
import { 
  FileText, Download, Upload, Search, ShieldCheck, 
  Trash2, X, Eye, Video, Loader2, Lock, Unlock, 
  User, ShieldAlert, FileIcon, Clock, HardDrive, Timer
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const BUCKET_NAME = "files";

export default function VaultApp() {
  const [search, setSearch] = useState("");
  const [passInput, setPassInput] = useState("");
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [showAdminCard, setShowAdminCard] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [perms, setPerms] = useState({
    public_view: true,
    public_upload: false,
    public_delete: false,
    auto_purge: false,
    purge_duration_hours: 24
  });

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.storage.from(BUCKET_NAME).list('', {
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) throw error;
      setFiles(data || []);
    } catch (err: any) {
      console.error("Fetch Error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    if (data) setPerms(data);
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchFiles();
  }, [fetchFiles, fetchSettings]);

  const verifyAdmin = () => {
    if (passInput === "mysecret123") {
      setIsAdmin(true);
      toast.success("Administrator Verified", { description: "Session started successfully." });
    } else {
      toast.error("Access Denied", { description: "The security key provided is incorrect." });
    }
    setPassInput("");
  };

  async function updateSetting(key: string, value: any) {
    const updated = { ...perms, [key]: value };
    setPerms(updated);
    await supabase.from('app_settings').update({ [key]: value }).eq('id', 1);
    toast.info("Policy Updated", { description: `${key.replace('_', ' ')} is now ${value ? 'enabled' : 'disabled'}.` });
  }

  async function handleUpload(file: File) {
    if (!perms.public_upload && !isAdmin) {
      return toast.warning("Access Restricted", { description: "Public uploads are currently disabled by the admin." });
    }
    
    setUploading(true);
    const { error } = await supabase.storage.from(BUCKET_NAME).upload(`${Date.now()}_${file.name}`, file);
    
    if (!error) { 
      fetchFiles(); 
      toast.success("File Secured", { description: `${file.name} added to the vault.` }); 
    } else {
      toast.error("Upload Failed", { description: "Please check your connection and try again." });
    }
    setUploading(false);
  }

  return (
    <div 
      className="min-h-screen bg-[#F9FBFF] text-slate-900 pb-20 font-sans selection:bg-blue-100"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async (e) => { 
        e.preventDefault(); 
        setIsDragging(false); 
        const file = e.dataTransfer.files[0];
        if (file) await handleUpload(file); 
      }}
    >
      {/* DRAG OVERLAY */}
      {isDragging && (
        <div className="fixed inset-0 z-[60] bg-blue-600/5 backdrop-blur-sm border-4 border-dashed border-blue-400 m-8 rounded-[3.5rem] flex items-center justify-center pointer-events-none animate-in fade-in zoom-in-95">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center">
            <Upload className="w-12 h-12 text-blue-600 animate-bounce mx-auto mb-4" />
            <p className="text-blue-600 font-black uppercase tracking-[0.2em] text-[10px]">Release to Secure</p>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="bg-white/70 backdrop-blur-xl border-b sticky top-0 z-40 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-100">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-black tracking-tighter italic">VAULT<span className="text-blue-600">.</span></h1>
        </div>
        
        <div className="relative">
          <button onClick={() => setShowAdminCard(!showAdminCard)} className={`p-3 rounded-2xl transition-all border ${isAdmin ? 'bg-blue-600 text-white shadow-lg border-blue-600' : 'bg-white text-slate-400'}`}>
            {isAdmin ? <ShieldAlert size={20} /> : <User size={20} />}
          </button>

          {showAdminCard && (
            <div className="absolute right-0 mt-4 w-72 bg-white rounded-[2.5rem] shadow-2xl border p-6 z-50 animate-in fade-in zoom-in-95">
              {!isAdmin ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1"><Lock size={12} className="text-slate-300"/><span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Master Key</span></div>
                  <input type="password" value={passInput} onChange={(e) => setPassInput(e.target.value)} placeholder="••••••••" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 ring-blue-500 text-sm" />
                  <button onClick={verifyAdmin} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Verify</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Admin Control</span><button onClick={() => setShowAdminCard(false)}><X size={16} className="text-slate-300"/></button></div>
                  <AdminToggle label="Allow View" active={perms.public_view} onClick={() => updateSetting('public_view', !perms.public_view)} />
                  <AdminToggle label="Allow Upload" active={perms.public_upload} onClick={() => updateSetting('public_upload', !perms.public_upload)} />
                  <AdminToggle label="Allow Delete" active={perms.public_delete} onClick={() => updateSetting('public_delete', !perms.public_delete)} />
                  
                  <div className={`p-4 rounded-2xl border transition-all ${perms.auto_purge ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-50'}`}>
                    <div className="flex justify-between items-center mb-3">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${perms.auto_purge ? 'text-blue-700' : 'text-slate-400'}`}>Auto-Purge</span>
                        <input type="checkbox" checked={perms.auto_purge} onChange={() => updateSetting('auto_purge', !perms.auto_purge)} className="w-4 h-4 accent-blue-600 rounded" />
                    </div>
                    {perms.auto_purge && (
                        <div className="animate-in slide-in-from-top-2">
                            <input type="range" min="1" max="168" value={perms.purge_duration_hours || 24} onChange={(e) => updateSetting('purge_duration_hours', parseInt(e.target.value))} className="w-full h-1.5 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                            <p className="text-[9px] font-bold text-blue-600 mt-2 text-center uppercase tracking-widest">Expiry: {perms.purge_duration_hours}h</p>
                        </div>
                    )}
                  </div>
                  <button onClick={() => {setIsAdmin(false); setShowAdminCard(false); toast.info("Admin Logged Out");}} className="w-full pt-4 text-[9px] font-black text-red-400 uppercase tracking-widest text-center hover:text-red-600">Terminate Session</button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8 mt-4">
        {/* SEARCH BAR */}
        <div className="flex flex-col md:flex-row gap-6 mb-16">
            <div className="relative flex-1 group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
                <input type="text" value={search} placeholder="Search repository..." className="w-full pl-16 pr-6 py-6 rounded-[2.2rem] border-none bg-white shadow-xl shadow-slate-200/40 focus:ring-2 ring-blue-500 outline-none transition-all text-lg font-medium" onChange={(e) => setSearch(e.target.value)} />
                <div className="absolute -bottom-1.5 inset-x-12 h-2 bg-blue-500/40 blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity rounded-full"></div>
            </div>
            <label className="bg-slate-900 text-white px-12 py-6 rounded-[2.2rem] cursor-pointer hover:bg-blue-600 flex gap-3 font-black text-xs uppercase tracking-widest items-center shadow-2xl transition-all active:scale-95 shrink-0">
                {uploading ? <Loader2 className="animate-spin" /> : <Upload size={20}/>}
                Add File
                <input type="file" className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files[0])} disabled={uploading} />
            </label>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {loading ? [1,2,3,4].map(i => <div key={i} className="h-72 bg-slate-100 rounded-[2.8rem] animate-pulse" />) : 
             files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())).map((file) => {
                const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${file.name}`;
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const cleanName = file.name.split('_').slice(1).join('_') || file.name;
                const size = (file.metadata?.size / 1024 / 1024).toFixed(2);
                const date = new Date(file.created_at).toLocaleDateString();

                const expiryDate = new Date(new Date(file.created_at).getTime() + ((perms.purge_duration_hours || 24) * 60 * 60 * 1000));
                const timeLeft = Math.max(0, Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60)));

                let type = 'other';
                if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) type = 'img';
                else if (['mp4', 'webm', 'mov', 'ogg'].includes(ext)) type = 'vid';
                else if (ext === 'pdf') type = 'pdf';
                else if (['docx', 'xlsx', 'pptx'].includes(ext)) type = 'doc';

                return (
                  <div key={file.id} className="group relative bg-white rounded-[2.8rem] p-5 shadow-sm border border-slate-100 transition-all duration-500 hover:-translate-y-2">
                      <div className="absolute -bottom-1.5 inset-x-12 h-2.5 bg-blue-500/50 blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-full" />
                      
                      {perms.auto_purge && (
                        <div className="absolute top-8 left-8 z-10 bg-white/90 backdrop-blur-md border border-blue-100 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                            <Timer size={10} className="text-blue-500 animate-pulse" />
                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{timeLeft}H LEFT</span>
                        </div>
                      )}

                      <div className="aspect-[4/3] bg-slate-50 rounded-[2rem] mb-5 overflow-hidden flex items-center justify-center relative border border-slate-50">
                          {type === 'img' ? <img src={url} className="object-cover w-full h-full grayscale-[20%] group-hover:grayscale-0 transition-all duration-700" /> : 
                           type === 'vid' ? <Video size={40} className="text-blue-300" /> :
                           type === 'pdf' ? <FileText size={40} className="text-red-300" /> : <FileIcon size={40} className="text-slate-200" />}
                          
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-4 backdrop-blur-[2px]">
                              <button onClick={() => setPreviewFile({ url, name: cleanName, type })} className="p-4 bg-white rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-xl hover:scale-110"><Eye size={22}/></button>
                              <button 
                                onClick={async () => { 
                                    if (!perms.public_delete && !isAdmin) return toast.warning("Delete Restricted", { description: "You don't have permission to purge files." });
                                    
                                    // Custom toast for confirmation instead of window.confirm
                                    toast("Confirm Purge", {
                                      description: `Are you sure you want to delete ${cleanName}?`,
                                      action: {
                                        label: "Delete",
                                        onClick: async () => {
                                          await supabase.storage.from(BUCKET_NAME).remove([file.name]);
                                          fetchFiles();
                                          toast.success("Purged", { description: "File permanently removed." });
                                        },
                                      },
                                    });
                                }} 
                                className="p-4 bg-white rounded-2xl hover:bg-red-600 hover:text-white text-red-600 transition-all shadow-xl hover:scale-110"
                              >
                                <Trash2 size={22}/>
                              </button>
                          </div>
                      </div>
                      <div className="px-2">
                        <h3 className="text-sm font-black text-slate-800 truncate mb-1">{cleanName}</h3>
                        <div className="flex justify-between items-center mb-5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1"><HardDrive size={10} /> {size} MB</span>
                          <span className="flex items-center gap-1"><Clock size={10} /> {date}</span>
                        </div>
                        <a href={url} download className="flex items-center justify-center gap-2 w-full py-4 bg-slate-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95">
                          <Download size={14}/> Download
                        </a>
                      </div>
                  </div>
                );
            })}
        </div>
      </main>

      {/* MODAL */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-8 animate-in fade-in duration-300">
          <button onClick={() => setPreviewFile(null)} className="absolute top-10 right-10 text-white/50 hover:text-white transition-colors bg-white/5 p-4 rounded-full"><X size={32}/></button>
          <div className="w-full h-full flex items-center justify-center">
            {previewFile.type === 'img' && <img src={previewFile.url} className="max-h-full rounded-[2.5rem] shadow-2xl object-contain border border-white/5" />}
            {previewFile.type === 'vid' && <video src={previewFile.url} controls autoPlay className="max-h-[85vh] w-full max-w-5xl rounded-[2.5rem] shadow-2xl bg-black" />}
            {(previewFile.type === 'pdf' || previewFile.type === 'doc') && (
              <iframe src={previewFile.type === 'pdf' ? previewFile.url : `https://docs.google.com/gview?url=${encodeURIComponent(previewFile.url)}&embedded=true`} className="w-full h-full max-w-6xl rounded-[3rem] bg-white border-none shadow-2xl" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminToggle({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all border ${active ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-slate-50 border-slate-50 text-slate-400'}`}>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-slate-300'}`} />
    </button>
  );
}