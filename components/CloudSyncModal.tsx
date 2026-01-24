import React, { useState, useEffect } from 'react';
import { getSupabase, clearSupabaseConfig } from '../utils/supabaseClient';
import { ProjectPlan } from '../types';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: ProjectPlan;
  onLoadProject: (data: ProjectPlan) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ 
    isOpen, 
    onClose, 
    projectData, 
    onLoadProject 
}) => {
  const [step, setStep] = useState<'config' | 'actions'>('config');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'error'|'success', text: string} | null>(null);
  
  // List of saved projects
  const [savedProjects, setSavedProjects] = useState<any[]>([]);

  // Initialize
  useEffect(() => {
    if (isOpen) {
        const client = getSupabase();
        if (client) {
            setStep('actions');
            fetchProjects(client);
        } else {
            // Check local storage pre-fill
            const savedUrl = localStorage.getItem('dt_supabase_url');
            if (savedUrl) setUrl(savedUrl);
            const savedKey = localStorage.getItem('dt_supabase_key');
            if (savedKey) setKey(savedKey);
        }
        setStatusMsg(null);
    }
  }, [isOpen]);

  const formatUrl = (input: string) => {
    let formatted = input.trim();
    if (!formatted) return '';
    // Auto-add https if missing
    if (!/^https?:\/\//i.test(formatted)) {
        formatted = `https://${formatted}`;
    }
    // Remove trailing slash
    return formatted.replace(/\/+$/, '');
  };

  const fetchProjects = async (client: any) => {
      setLoading(true);
      try {
        const { data, error } = await client
            .from('projects')
            .select('id, name, updated_at')
            .order('updated_at', { ascending: false });
        
        if (error) throw error;
        setSavedProjects(data || []);
      } catch (err: any) {
          console.error("Supabase Error:", err);
          
          let msg = "Failed to fetch projects.";
          if (err.message === "Failed to fetch") {
              msg = "Connection failed. Please check your Project URL format.";
          } else if (err.message?.includes('does not exist')) {
              msg = "Table 'projects' not found. Please create it in Supabase.";
          } else if (err.message) {
              msg = err.message;
          }

          setStatusMsg({type: 'error', text: msg});
      } finally {
          setLoading(false);
      }
  };

  const handleConnect = async () => {
      const cleanUrl = formatUrl(url);
      const cleanKey = key.trim();

      if (!cleanUrl || !cleanKey) {
          setStatusMsg({type: 'error', text: "URL and Key are required"});
          return;
      }
      
      // Update UI with cleaned values
      setUrl(cleanUrl);
      setKey(cleanKey);

      setLoading(true);
      
      // Initialize client with specific credentials
      const client = getSupabase(cleanUrl, cleanKey);
      
      if (client) {
          // Verify connection by trying to fetch
          try {
            await fetchProjects(client);
            // If successful, move to actions
            setStep('actions');
            setStatusMsg(null);
          } catch (e: any) {
             // Handled in fetchProjects
             // If it failed, we stay on config
             setStatusMsg({type: 'error', text: "Connection failed. Please check your credentials."});
          }
      } else {
          setStatusMsg({type: 'error', text: "Could not initialize client."});
      }
      setLoading(false);
  };

  const handleSave = async () => {
      const client = getSupabase();
      if (!client) return;
      setLoading(true);
      
      try {
        // Ensure ID
        const idToSave = projectData.id || crypto.randomUUID();
        const planToSave = { ...projectData, id: idToSave };
        
        const payload = {
            id: idToSave,
            name: projectData.smart_goal.substring(0, 50) + (projectData.smart_goal.length > 50 ? '...' : ''),
            data: planToSave,
            updated_at: new Date().toISOString()
        };

        const { error } = await client.from('projects').upsert(payload);
        if (error) throw error;

        setStatusMsg({type: 'success', text: "Project saved successfully!"});
        fetchProjects(client); // Refresh list
        
      } catch (err: any) {
          console.error(err);
          const msg = err.message === "Failed to fetch" 
            ? "Network error. Check your internet or Project URL." 
            : err.message;
          setStatusMsg({type: 'error', text: "Save failed: " + msg});
      } finally {
          setLoading(false);
      }
  };

  const handleLoad = async (projectId: string) => {
      const client = getSupabase();
      if (!client) return;
      setLoading(true);
      
      try {
          const { data, error } = await client.from('projects').select('data').eq('id', projectId).single();
          if (error) throw error;
          
          if (data && data.data) {
              onLoadProject(data.data as ProjectPlan);
              onClose();
          }
      } catch (err: any) {
          setStatusMsg({type: 'error', text: "Load failed: " + err.message});
      } finally {
          setLoading(false);
      }
  };

  const handleLogout = () => {
      clearSupabaseConfig();
      setStep('config');
      setUrl('');
      setKey('');
      setSavedProjects([]);
      setStatusMsg(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 p-1 rounded text-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z" clipRule="evenodd" />
                    <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
                </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Supabase Cloud Sync</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
            {statusMsg && (
                <div className={`mb-4 p-3 rounded text-sm font-medium ${statusMsg.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                    {statusMsg.text}
                </div>
            )}

            {step === 'config' ? (
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Connect to your Supabase project. You need two tables:
                    </p>
                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded text-xs font-mono text-slate-500 overflow-x-auto space-y-2">
                        <div>
                            -- 1. Projects (Main Save)<br/>
                            create table projects (id text primary key, name text, data jsonb, updated_at timestamptz default now());
                        </div>
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                             -- 2. System Status (Nightly Chronological Snapshot)<br/>
                             create table system_status (id uuid default gen_random_uuid() primary key, project_id text, data jsonb, created_at timestamptz default now());
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project URL</label>
                        <input 
                            type="text" 
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://your-project.supabase.co"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Must start with https://</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Anon Key</label>
                        <input 
                            type="password" 
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5c..."
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <button 
                        onClick={handleConnect}
                        disabled={loading}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shadow-sm disabled:opacity-50"
                    >
                        {loading ? 'Connecting...' : 'Connect to Supabase'}
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Current Project Action */}
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-2">Current Workspace</div>
                        <div className="font-bold text-slate-800 dark:text-slate-100 mb-4 line-clamp-1">{projectData.smart_goal}</div>
                        <button 
                            onClick={handleSave}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shadow-sm disabled:opacity-50 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                            </svg>
                            {loading ? 'Saving...' : 'Save Current Plan'}
                        </button>
                    </div>

                    {/* Saved Projects List */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <div className="text-xs font-bold text-slate-400 uppercase">Remote Projects</div>
                            <button onClick={() => fetchProjects(getSupabase())} className="text-slate-400 hover:text-indigo-500">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.433l-.31-.311a7 7 0 00-11.711 3.139.75.75 0 001.449.389 5.5 5.5 0 019.201-2.466l.312.312h-2.433a.75.75 0 000 1.5h4.193z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                            {savedProjects.length === 0 ? (
                                <div className="p-4 text-center text-sm text-slate-500">No saved projects found.</div>
                            ) : (
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {savedProjects.map(proj => (
                                        <li key={proj.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center group">
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate">{proj.name || 'Untitled Project'}</div>
                                                <div className="text-xs text-slate-400">
                                                    {new Date(proj.updated_at).toLocaleDateString()} at {new Date(proj.updated_at).toLocaleTimeString()}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleLoad(proj.id)}
                                                className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200"
                                            >
                                                Load
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-600 underline text-center w-full">
                        Disconnect Supabase
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};