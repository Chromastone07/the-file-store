"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { 
  Download, Upload, Search, ShieldCheck, Trash2, X, Eye, 
  Loader2, User, ShieldAlert, FileIcon, Clock, Timer,
  Settings2, Fingerprint, Lock, Unlock, Globe, FileText
} from 'lucide-react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const BUCKET_NAME = "files";

export default function VaultApp() {
  const [search, setSearch] = useState("");
  const [passInput, setPassInput] = useState("");
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [showAdminCard, setShowAdminCard] = useState(false);
  const [showUploadSettings, setShowUploadSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [uploadExpiry, setUploadExpiry] = useState(24);
  const [perms, setPerms] = useState({ public_view: false, public_upload: true, public_delete: false });

  // --- SYNC & PRIVACY ---
  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single();
      if (data) setPerms({ public_view: data.public_view, public_upload: data.public_upload, public_delete: data.public_delete });
    } catch (e) { console.warn("Syncing..."); }
  }, []);


useEffect(() => {
  const initDevice = () => {
    let id = localStorage.getItem('vault_device_id');
    if (!id) {
      
      id = 'VAULT-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      localStorage.setItem('vault_device_id', id);
    }
    setDeviceId(id);
  };
  initDevice();
  fetchSettings();
}, [fetchSettings]);


const saveCustomKey = (customWord: string) => {
  
  const cleanKey = customWord.trim().replace(/\s+/g, '-').toUpperCase();

  if (cleanKey.length < 3) {
    toast.error("Key is too short (Min 3 chars)");
    return;
  }


  localStorage.setItem('vault_device_id', cleanKey);
  setDeviceId(cleanKey);
  
  
  fetchFiles(); 
  
  toast.success("Identity Updated", { 
    description: `Active Vault: ${cleanKey}`,
    icon: <Fingerprint className="text-blue-600" />
  });
};


const syncIdentity = (newKey: string) => {
  if (newKey.length < 4) {
    toast.error("Invalid Sync Key");
    return;
  }

  localStorage.setItem('vault_device_id', newKey);
  setDeviceId(newKey);
  
  
  fetchFiles(); 
  
  toast.success("Identity Synced", {
    description: "Vault re-linked to ID: " + newKey,
    icon: <Fingerprint className="text-blue-600" />
  });
};

//  The Transfer Function
const transferVault = (newKey: string) => {
  if (newKey.length < 4) return toast.error("Invalid Key");
  localStorage.setItem('vault_device_id', newKey);
  setDeviceId(newKey);
  fetchFiles(); 
  toast.success("Identity Synced", { description: "Your files are now linked to this device." });
};

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const { data: dbData } = await supabase.from('file_expiration').select('*');
      const { data: storageData, error } = await supabase.storage.from(BUCKET_NAME).list('', {
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) throw error;
      const myFiles = storageData?.map(file => {
        const meta = dbData?.find(db => db.file_id === file.name);
        return { ...file, expiry_data: meta };
      }).filter(file => perms.public_view || (file.expiry_data && file.expiry_data.device_id === localStorage.getItem('vault_device_id')));
      setFiles(myFiles || []);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  }, [perms.public_view]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  async function handleUpload(file: File) {
    if (!file || (!perms.public_upload && !isAdmin)) return;
    setUploading(true);
    const fileId = `${Date.now()}_${file.name}`;
    const { error: sErr } = await supabase.storage.from(BUCKET_NAME).upload(fileId, file, { contentType: file.type });
    if (!sErr) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + uploadExpiry);
      await supabase.from('file_expiration').insert([{ file_id: fileId, file_name: file.name, expires_at: expiresAt.toISOString(), device_id: deviceId }]);
      await fetchFiles();
      toast.success("File Secured");
    }
    setUploading(false);
  }

  return (
    <div className="min-h-screen bg-[#e0e5ec] pb-20 font-sans text-slate-800 selection:bg-blue-200" 
         onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} 
         onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
         onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if(f) handleUpload(f); }}>
      
      {/* DRAG OVERLAY (RE-ACTIVATED) */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-blue-500/10 backdrop-blur-xl border-[10px] border-dashed border-blue-400 m-8 rounded-[4rem] flex items-center justify-center pointer-events-none animate-in fade-in zoom-in-90 duration-300">
           <div className="bg-[#e0e5ec] p-16 rounded-[3rem] shadow-[20px_20px_60px_#bebebe,-20px_-20px_60px_#ffffff] text-center border-t-2 border-white/50">
              <Upload className="w-20 h-20 text-blue-600 animate-bounce mx-auto mb-6" />
              <p className="text-blue-600 font-black uppercase tracking-widest text-sm">Drop to Secure</p>
           </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="bg-[#e0e5ec]/80 backdrop-blur-lg sticky top-0 z-40 px-8 py-6 flex justify-between items-center shadow-[12px_12px_24px_#bebebe,-12px_-12px_24px_#ffffff] border-b-2 border-white/20">
        <div className="flex items-center gap-3">
          <div className="bg-[#e0e5ec] p-3 rounded-2xl shadow-[inset_6px_6px_12px_#bebebe,inset_-6px_-6px_12px_#ffffff] border-t border-white/40"><ShieldCheck className="text-blue-600 w-6 h-6" /></div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 italic">VAULT<span className="text-blue-600">.</span></h1>
        </div>
        <button onClick={() => setShowAdminCard(!showAdminCard)} className={`p-4 rounded-3xl transition-all shadow-[8px_8px_16px_#bebebe,-8px_-8px_16px_#ffffff] active:shadow-[inset_4px_4px_8px_#bebebe,inset_-4px_-4px_8px_#ffffff] border-t border-white/40 ${isAdmin ? 'text-blue-600' : 'text-slate-400'}`}>
          {isAdmin ? <ShieldAlert size={22} /> : <User size={22} />}
        </button>

        {showAdminCard && (
            <div className="absolute right-8 top-28 w-80 bg-[#e0e5ec] rounded-[3.5rem] shadow-[25px_25px_50px_#bebebe,-25px_-25px_50px_#ffffff] p-8 z-50 border-t border-white/60 animate-in fade-in zoom-in-95">
              {!isAdmin ? (
                <div className="space-y-4">
                  <input type="password" value={passInput} onChange={(e) => setPassInput(e.target.value)} placeholder="Security Key" className="w-full p-5 bg-[#e0e5ec] shadow-[inset_8px_8px_16px_#bebebe,inset_-8px_-8px_16px_#ffffff] rounded-[1.5rem] outline-none text-slate-900 font-black placeholder:text-slate-400" />
                  <button onClick={() => passInput === "mysecret123" ? (setIsAdmin(true), setPassInput("")) : toast.error("Denied")} className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-[6px_6px_12px_#939393] active:scale-95 transition-transform">Verify Access</button>
                </div>
              ) : (
                <div className="space-y-4">
                   <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] block mb-2">Global Policies</span>
                   <AdminBtn label="Public View" active={perms.public_view} onClick={async () => { const v = !perms.public_view; setPerms({...perms, public_view: v}); await supabase.from('app_settings').update({ public_view: v }).eq('id', 1); }} icon={<Globe size={14}/>} />
                   <AdminBtn label="Allow Upload" active={perms.public_upload} onClick={async () => { const v = !perms.public_upload; setPerms({...perms, public_upload: v}); await supabase.from('app_settings').update({ public_upload: v }).eq('id', 1); }} icon={<Upload size={14}/>} />
                   <AdminBtn label="Allow Purge" active={perms.public_delete} onClick={async () => { const v = !perms.public_delete; setPerms({...perms, public_delete: v}); await supabase.from('app_settings').update({ public_delete: v }).eq('id', 1); }} icon={<Trash2 size={14}/>} />
                   <button onClick={() => setIsAdmin(false)} className="w-full pt-4 text-[10px] font-black text-red-500 uppercase border-t border-slate-300 hover:text-red-600 transition-colors">Logout System</button>
                </div>
              )}
            </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto p-8">
        {/* POPPING SEARCH BAR */}
        <div className="flex flex-col lg:flex-row gap-8 mb-20 mt-4">
            <div className="relative flex-1 group">
                <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
                <input type="text" value={search} placeholder="Search your vault..." className="w-full pl-16 pr-8 py-8 bg-[#e0e5ec] rounded-[3rem] shadow-[inset_10px_10px_20px_#bebebe,inset_-10px_-10px_20px_#ffffff] outline-none text-slate-900 font-black text-xl placeholder:text-slate-400 border-t border-white/20" onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-4 bg-[#e0e5ec] p-3 rounded-[3rem] shadow-[12px_12px_24px_#bebebe,-12px_-12px_24px_#ffffff] border-t border-white/40">
                <button onClick={() => setShowUploadSettings(!showUploadSettings)} className={`p-6 rounded-[2rem] transition-all ${showUploadSettings ? 'shadow-[inset_5px_5px_10px_#bebebe,inset_-5px_-5px_10px_#ffffff] text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}><Settings2 size={26} /></button>
                <label className="bg-blue-600 text-white px-12 py-6 rounded-[2rem] cursor-pointer hover:bg-blue-700 flex gap-4 font-black text-xs uppercase tracking-[0.2em] items-center active:scale-95 shadow-[8px_8px_16px_#939393] transition-all">
                    {uploading ? <Loader2 className="animate-spin" /> : <Upload size={22}/>} Secure
                    <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleUpload(f); }} />
                </label>
            </div>
        </div>

       {showUploadSettings && (
  <div className="max-w-md mx-auto mb-16 p-10 bg-[#e0e5ec] rounded-[3.5rem] shadow-[20px_20px_40px_#bebebe,-20px_-20px_40px_#ffffff] border-t-2 border-white/60 animate-in slide-in-from-top-6 relative overflow-hidden">
    
    {/* The Expiry Slider */}
    <div className="mb-12">
      <div className="flex justify-between items-center mb-6 px-2">
          <span className="text-[11px] font-black uppercase text-blue-600 tracking-[0.2em] flex items-center gap-2">
            <Clock size={16} className="text-blue-500" /> Expiry Timer
          </span>
          <span className="px-5 py-2 bg-[#e0e5ec] rounded-[1.5rem] shadow-[inset_4px_4px_8px_#bebebe,inset_-4px_-4px_8px_#ffffff] text-blue-600 text-sm font-black border-t border-white/40">
            {uploadExpiry}h
          </span>
      </div>
      
      <div className="px-2">
        <input 
          type="range" 
          min="1" 
          max="168" 
          value={uploadExpiry} 
          onChange={(e) => setUploadExpiry(parseInt(e.target.value))} 
          className="w-full h-3 bg-slate-300 rounded-full appearance-none accent-blue-600 shadow-[inset_2px_2px_4px_#bebebe] cursor-pointer" 
        />
        <div className="flex justify-between mt-3 px-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            <span>1 Hour</span>
            <span>1 Week</span>
        </div>
      </div>
    </div>


    <div className="pt-10 border-t-2 border-white/30">
      <div className="flex items-center justify-center gap-2 mb-6">
        <Fingerprint size={14} className="text-slate-400" />
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Customize Vault Key</span>
      </div>
      
      <div className="flex gap-4 items-center">
        <div className="flex-1">
           <input 
            type="text" 
            value={deviceId} 
            onChange={(e) => setDeviceId(e.target.value)} 
            placeholder="e.g. SURAJ-VAULT"
            className="w-full p-6 bg-[#e0e5ec] shadow-[inset_8px_8px_16px_#bebebe,inset_-8px_-8px_16px_#ffffff] rounded-[2rem] outline-none text-blue-600 font-black text-center text-sm tracking-[0.1em] placeholder:text-slate-300 border-none transition-all focus:shadow-[inset_4px_4px_8px_#bebebe,inset_-4px_-4px_8px_#ffffff]"
          />
        </div>

        <button 
          onClick={() => saveCustomKey(deviceId)}
          className="p-6 bg-[#e0e5ec] rounded-[2rem] shadow-[10px_10px_20px_#bebebe,-10px_-10px_20px_#ffffff] text-blue-600 active:shadow-[inset_6px_6px_12px_#bebebe,inset_-6px_-6px_12px_#ffffff] active:scale-95 border-t border-white/50 transition-all flex items-center justify-center group"
        >
          <Fingerprint size={28} className="group-hover:scale-110 transition-transform" />
        </button>
      </div>
      
      <div className="mt-8 p-5 bg-white/10 rounded-3xl border border-white/10">
        <p className="text-[10px] text-slate-500 text-center font-bold leading-relaxed px-4">
          "Set a word only you know. To access these files on your phone, simply enter the same word there and sync."
        </p>
      </div>
    </div>
  </div>
)}

        {/* CLAY GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-14">
            {files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())).map((file) => {
                const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${file.name}`;
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const cleanName = file.name.split('_').slice(1).join('_') || file.name;
                const size = (file.metadata?.size / 1024 / 1024).toFixed(2);
                const hoursLeft = file.expiry_data ? Math.max(0, Math.floor((new Date(file.expiry_data.expires_at).getTime() - Date.now()) / (1000 * 60 * 60))) : '∞';

                return (
                  <div key={file.id} className="group bg-[#e0e5ec] rounded-[4rem] p-7 shadow-[25px_25px_50px_#bebebe,-25px_-25px_50px_#ffffff] hover:scale-[1.02] transition-all duration-500 border-t-2 border-white/50 relative">
                      <div className="aspect-square bg-[#e0e5ec] rounded-[3rem] mb-7 flex items-center justify-center relative shadow-[inset_10px_10px_20px_#bebebe,inset_-10px_-10px_20px_#ffffff] overflow-hidden border-b border-white/20">
                          {['jpg','png','webp','jpeg'].includes(ext) ? <img src={url} className="w-full h-full object-cover p-3 rounded-[3.5rem] grayscale-[20%] group-hover:grayscale-0 transition-all" /> : <FileText size={56} className="text-slate-300" />}
                          <div className="absolute top-5 left-5 bg-[#e0e5ec] p-3 rounded-2xl shadow-[5px_5px_10px_#bebebe,-5px_-5px_10px_#ffffff] border-t border-white/60"><Lock size={16} className="text-blue-600" /></div>
                      </div>
                      
                      <div className="px-2 space-y-2">
                        <h3 className="text-base font-black text-slate-900 truncate">{cleanName}</h3>
                        
                        <div className="flex justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-white/40 pb-5">
                            <span className="bg-slate-200/50 px-2 py-0.5 rounded-md">{size} MB</span>
                            <span className="flex items-center gap-1.5 text-orange-500"><Timer size={12}/> {hoursLeft}h Left</span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 pt-2">
                            <ActionBtn onClick={() => setPreviewFile({ url, name: cleanName, ext })} icon={<Eye size={20}/>} />
                            <a href={url} download className="flex-1 flex justify-center p-5 bg-[#e0e5ec] rounded-[1.8rem] shadow-[8px_8px_16px_#bebebe,-8px_-8px_16px_#ffffff] text-slate-400 hover:text-blue-600 transition-all border-t border-white/40 active:shadow-inset"><Download size={20}/></a>
                            <ActionBtn color="text-red-400" onClick={() => { 
                                toast("Confirm Deletion?", {
                                  description: "Permanent system purge.",
                                  action: { label: "Delete", onClick: async () => {
                                      if (!perms.public_delete && !isAdmin) return toast.error("Locked");
                                      await supabase.storage.from(BUCKET_NAME).remove([file.name]);
                                      fetchFiles();
                                      toast.success("Purged");
                                  }}
                                });
                            }} icon={<Trash2 size={20}/>} />
                        </div>
                      </div>
                  </div>
                );
            })}
        </div>
      </main>

      
      {previewFile && (
        <div className="fixed inset-0 bg-[#e0e5ec]/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-8 animate-in fade-in duration-300">
          <button onClick={() => setPreviewFile(null)} className="absolute top-10 right-10 p-6 bg-[#e0e5ec] rounded-full shadow-[10px_10px_20px_#bebebe,-10px_-10px_20px_#ffffff] text-slate-600 hover:text-red-500 transition-colors border-t border-white/40"><X size={36}/></button>
          <div className="w-full h-full max-w-7xl bg-[#e0e5ec] rounded-[5rem] shadow-[40px_40px_80px_#bebebe,-40px_-40px_80px_#ffffff] overflow-hidden flex items-center justify-center p-6 border-t-2 border-white/60">
            {['jpg','png','webp','jpeg'].includes(previewFile.ext) ? <img src={previewFile.url} className="max-h-full object-contain rounded-[3rem] shadow-xl" /> : 
             previewFile.ext === 'mp4' ? <video src={previewFile.url} controls autoPlay muted playsInline className="w-full h-full rounded-[3rem] shadow-xl bg-black" /> : 
             <iframe 
                src={['docx','xlsx','pptx','doc'].includes(previewFile.ext) 
                    ? `https://docs.google.com/gview?url=${encodeURIComponent(previewFile.url)}&embedded=true` 
                    : previewFile.url} 
                className="w-full h-full rounded-[3rem] border-none bg-white" 
             />}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminBtn({ label, active, onClick, icon }: any) {
  return (
    <button onClick={onClick} className={`w-full p-6 rounded-[2rem] flex items-center justify-between transition-all border-t border-white/20 ${active ? 'shadow-[inset_6px_6px_12px_#bebebe,inset_-6px_-6px_12px_#ffffff] text-blue-600' : 'shadow-[10px_10px_20px_#bebebe,-10px_-10px_20px_#ffffff] text-slate-400 hover:text-slate-600'}`}>
      <div className="flex items-center gap-3">{icon}<span className="text-[11px] font-black uppercase tracking-widest">{label}</span></div>
      {active ? <Unlock size={16} className="text-blue-500" /> : <Lock size={16} />}
    </button>
  );
}

function ActionBtn({ icon, onClick, color="text-slate-400" }: any) {
  return (
    <button onClick={onClick} className={`flex-1 flex justify-center p-5 bg-[#e0e5ec] rounded-[1.8rem] shadow-[8px_8px_16px_#bebebe,-8px_-8px_16px_#ffffff] ${color} hover:text-blue-600 transition-all border-t border-white/40 active:shadow-[inset_4px_4px_8px_#bebebe,inset_-4px_-4px_8px_#ffffff]`}>
      {icon}
    </button>
  );
}