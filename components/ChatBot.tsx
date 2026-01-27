import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { ProjectPlan, ProcessedTask } from '../types';

interface ChatBotProps {
  projectPlan: ProjectPlan;
  processedTasks: ProcessedTask[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const ChatBot: React.FC<ChatBotProps> = ({ projectPlan, processedTasks }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hi! I\'m your AI Project Boss. Ask me anything about your plan.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSession = useRef<Chat | null>(null);

  // Invalidate chat session ONLY when structural project data changes.
  useEffect(() => {
     chatSession.current = null;
  }, [projectPlan.smart_goal, projectPlan.tasks.length, projectPlan.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, isOpen, isLoading]);

  const initializeChat = async () => {
    try {
        // Handle API Key Selection (Crucial for Incognito/Fresh Sessions)
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
        
        // If apiKey is still missing, force open the selector again
        if (!apiKey) {
             // @ts-ignore
             if (typeof window !== 'undefined' && window.aistudio && window.aistudio.openSelectKey) {
                  // @ts-ignore
                  await window.aistudio.openSelectKey();
                  // Re-read env var after selection
                  apiKey = process.env.API_KEY;
             }
        }

        if (!apiKey) {
            throw new Error("API Key not found in environment.");
        }

        const ai = new GoogleGenAI({ apiKey });
        
        // Prepare context summary using the latest processedTasks for accuracy at init time
        const scheduleContext = processedTasks.map(t => ({
            id: t.id,
            name: t.task_name,
            phase: t.phase,
            start: t.startDate.toDateString(),
            end: t.endDate.toDateString(),
            duration: t.duration_hours,
            predecessors: t.predecessors
        }));

        const contextStr = JSON.stringify({
            goal: projectPlan.smart_goal,
            totalEstHours: projectPlan.total_estimated_duration_hours,
            schedule: scheduleContext
        });

        // Using gemini-3-flash-preview for faster, more reliable chat interactions
        chatSession.current = ai.chats.create({
            model: 'gemini-3-flash-preview',
            config: {
                systemInstruction: `You are an AI Project Manager for the app 'doTrackit'.
                Your goal is to help the user execute their project.
                
                Current Project Context:
                ${contextStr}
                
                Guidelines:
                1. Answer questions about dates, dependencies, and risks based on the Schedule provided.
                2. Be concise, direct, and encouraging but realistic ("tough love").
                3. If the user asks to change the plan, guide them to use the Edit Data button, as you cannot modify the plan directly yet.
                `
            }
        });
        return true;
        
    } catch (error: any) {
        console.error("Failed to init AI chat", error);
        if (error.message && error.message.includes("Requested entity was not found")) {
            // @ts-ignore
             if (window.aistudio && window.aistudio.openSelectKey) {
                 // @ts-ignore
                 await window.aistudio.openSelectKey();
             }
             setMessages(prev => [...prev, { role: 'model', text: "API Key Required. Please select a key and try again." }]);
        } else {
             setMessages(prev => [...prev, { role: 'model', text: "Connection error: " + (error.message || "Unknown") }]);
        }
        return false;
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // Lazy initialization
      if (!chatSession.current) {
         const success = await initializeChat();
         if (!success) {
             setIsLoading(false);
             return;
         }
      }

      if (chatSession.current) {
        const response = await chatSession.current.sendMessage({ message: userMessage });
        const text = response.text;
        setMessages(prev => [...prev, { role: 'model', text: text || "I didn't have a response." }]);
      }
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "I lost the connection. Please try again." }]);
      chatSession.current = null; // Reset on error to force re-init next time
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-2xl z-50 transition-transform hover:scale-105 print:hidden"
        title="Ask AI Boss"
      >
        {isOpen ? (
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 h-[60vh] sm:h-[500px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 flex flex-col overflow-hidden animate-fade-in print:hidden">
            <div className="bg-slate-900 dark:bg-slate-950 p-4 text-white flex justify-between items-center">
                <div className="font-bold flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    AI Boss
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400">Powered by Gemini</span>
                    <span className="text-[9px] text-indigo-400 bg-indigo-900/50 px-1 rounded">3.0 Flash</span>
                </div>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto bg-slate-50 dark:bg-slate-800/50 space-y-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div 
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-sm' 
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-sm shadow-sm'
                            }`}
                            style={{ color: msg.role === 'user' ? '#ffffff' : '' }}
                        >
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-2xl px-4 py-3 text-sm shadow-sm flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about dates, risks..."
                        className="flex-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};