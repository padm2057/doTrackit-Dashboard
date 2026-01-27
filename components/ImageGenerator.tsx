import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

interface ImageGeneratorProps {
  initialPrompt: string;
}

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({ initialPrompt }) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Handle API Key Selection
      // @ts-ignore
      if (typeof window !== 'undefined' && window.aistudio) {
           // @ts-ignore
           const hasKey = await window.aistudio.hasSelectedApiKey();
           if (!hasKey) {
              // @ts-ignore
              await window.aistudio.openSelectKey();
           }
      }

      let apiKey = process.env.API_KEY;
      if (!apiKey) {
           // @ts-ignore
           if (typeof window !== 'undefined' && window.aistudio && window.aistudio.openSelectKey) {
                // @ts-ignore
                await window.aistudio.openSelectKey();
                apiKey = process.env.API_KEY;
           }
      }

      if (!apiKey) {
          throw new Error("API Key not found in environment.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: `A high quality, professional, futuristic concept visualization for a project with this goal: ${prompt}` }],
        },
        config: {
          imageConfig: {
            imageSize: imageSize
          }
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      let base64Image = null;
      let mimeType = 'image/png';

      if (parts) {
        for (const part of parts) {
            if (part.inlineData) {
                base64Image = part.inlineData.data;
                mimeType = part.inlineData.mimeType || 'image/png';
                break;
            }
        }
      }

      if (base64Image) {
        setImageUrl(`data:${mimeType};base64,${base64Image}`);
        if (!isOpen) setIsOpen(true); // Auto-open on success if closed
      } else {
        setError('No image returned. Try a different prompt.');
      }

    } catch (err: any) {
        console.error(err);
        if (err.message && err.message.includes("Requested entity was not found")) {
             // @ts-ignore
             if (window.aistudio && window.aistudio.openSelectKey) {
                 // @ts-ignore
                 await window.aistudio.openSelectKey();
             }
             setError("API Key session issue. Please try again.");
        } else {
            setError(err.message || 'Generation failed');
        }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `project-visualization-${new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 mb-8 break-inside-avoid overflow-hidden transition-all duration-300">
      
      {/* Header / Toggle */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isOpen ? 'border-b border-slate-200 dark:border-slate-800' : ''}`}
      >
        <div className="flex items-center gap-3">
             <div className="bg-indigo-100 dark:bg-indigo-900/30 p-1.5 rounded text-indigo-600 dark:text-indigo-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
                </svg>
             </div>
             <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Project Visualization</h3>
        </div>
        
        <div className="flex items-center gap-4">
             {imageUrl && !isOpen && (
                 <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                     Image Ready
                 </span>
             )}
             <div className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
            </div>
        </div>
      </div>

      {isOpen && (
        <div className="p-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    Generate a concept visualization based on your project goal.
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto print:hidden">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Size</span>
                        <select 
                            value={imageSize} 
                            onChange={(e) => setImageSize(e.target.value as any)}
                            className="text-xs font-mono font-bold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                            <option value="1K">1K</option>
                            <option value="2K">2K</option>
                            <option value="4K">4K</option>
                        </select>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded transition-colors disabled:opacity-50 shadow-sm"
                    >
                        {loading ? 'Dreaming...' : 'Generate Art'}
                    </button>
                </div>
            </div>
            
            <div className="mb-4 print:hidden">
                <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px] resize-y"
                    placeholder="Describe the vision for this project..."
                />
            </div>

            {error && <div className="text-red-500 text-xs font-bold mb-4 bg-red-50 dark:bg-red-900/10 p-3 rounded border border-red-100 dark:border-red-900/20">{error}</div>}

            <div className={`relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 ${!imageUrl ? 'h-64' : ''}`}>
                {!imageUrl && !loading && (
                    <div className="text-slate-400 text-sm font-medium flex flex-col items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-30">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        <div className="text-center">
                            <p>No Visualization Generated</p>
                            <p className="text-xs text-slate-500 mt-1">Select size and click Generate to visualize the goal.</p>
                        </div>
                    </div>
                )}
                
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-slate-900/80 z-10 backdrop-blur-sm">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider animate-pulse">Generating 3D Visualization...</span>
                    </div>
                )}

                {imageUrl && (
                    <>
                        <img src={imageUrl} alt="Project Visualization" className="w-full h-auto object-cover max-h-[500px]" />
                        <button 
                            onClick={handleDownload}
                            className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 p-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 transition-all group z-20"
                            title="Download Image"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </>
                )}
            </div>
            
            {imageUrl && (
                <div className="mt-4 flex justify-between items-center print:hidden">
                    <div className="text-[10px] text-slate-400 font-mono">
                        Generated with gemini-3-pro-image-preview ({imageSize})
                    </div>
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                        </svg>
                        Download PNG
                    </button>
                </div>
            )}
        </div>
      )}
    </section>
  );
};