import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, Blob as GenAIBlob } from '@google/genai';
import { ProjectPlan, ProcessedTask } from '../types';

interface LiveAudioBotProps {
  projectPlan: ProjectPlan;
  processedTasks: ProcessedTask[];
  onTaskToggle: (taskId: string) => void;
}

export const LiveAudioBot: React.FC<LiveAudioBotProps> = ({ 
  projectPlan, 
  processedTasks, 
  onTaskToggle 
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [volume, setVolume] = useState(0);
  
  // Audio Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  // Helper to get formatted task context for the AI
  const getContextString = () => {
    const tasks = processedTasks.map(t => 
      `ID: ${t.id}, Name: "${t.task_name}", Status: ${t.isCompleted ? 'Done' : 'Pending'}, Due: ${t.endDate.toLocaleDateString()}`
    ).join('\n');
    
    return `Project Goal: ${projectPlan.smart_goal}\n\nTasks:\n${tasks}`;
  };

  const startSession = async () => {
    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // 1. Tool Definition
      const markDoneTool: FunctionDeclaration = {
        name: 'markTaskComplete',
        description: 'Mark a task as completed/done. Use this when the user says they finished something.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: {
              type: Type.STRING,
              description: 'The exact ID of the task to mark done (e.g., "1", "2").',
            },
          },
          required: ['taskId'],
        },
      };

      // 2. Audio Setup
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      // 3. Connect to Gemini Live
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `You are the "AI Boss", a strict but helpful project manager. 
          You are talking to the user via voice. Keep responses concise (1-2 sentences) as it is a voice conversation.
          
          Context:
          ${getContextString()}
          
          If the user completes a task, congratulate them briefly and call the tool 'markTaskComplete'.
          If they ask about consequences, explain dependencies based on the task IDs.`,
          tools: [{ functionDeclarations: [markDoneTool] }],
        },
        callbacks: {
          onopen: async () => {
             console.log("Gemini Live Connected");
             setIsActive(true);
             setIsConnecting(false);
             
             // Start Mic Stream
             try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
                
                const source = inputCtx.createMediaStreamSource(stream);
                const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                
                sourceRef.current = source;
                processorRef.current = processor;

                processor.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    
                    // Simple Volume Meter
                    let sum = 0;
                    for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                    setVolume(Math.sqrt(sum / inputData.length) * 10); // Scale up

                    const pcmBlob = createBlob(inputData);
                    sessionPromiseRef.current?.then((session) => {
                         session.sendRealtimeInput({ media: pcmBlob });
                    });
                };

                source.connect(processor);
                processor.connect(inputCtx.destination);
             } catch (err) {
                 console.error("Mic Error", err);
                 stopSession();
             }
          },
          onmessage: async (msg: LiveServerMessage) => {
            // 1. Handle Tool Calls (Task Marking)
            if (msg.toolCall) {
                for (const fc of msg.toolCall.functionCalls) {
                    if (fc.name === 'markTaskComplete') {
                        const tId = (fc.args as any).taskId;
                        // Execute locally
                        onTaskToggle(tId);
                        
                        // Tell Model it's done
                        sessionPromiseRef.current?.then((session) => {
                            session.sendToolResponse({
                                functionResponses: {
                                    id: fc.id,
                                    name: fc.name,
                                    response: { result: "Task marked done successfully." }
                                }
                            });
                        });
                    }
                }
            }

            // 2. Handle Audio Output
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                try {
                    if (outputCtx.state === 'suspended') await outputCtx.resume();
                    
                    const audioBuffer = await decodeAudioData(
                        decode(base64Audio),
                        outputCtx,
                        24000,
                        1
                    );

                    // Basic scheduling to prevent gaps
                    const currentTime = outputCtx.currentTime;
                    if (nextStartTimeRef.current < currentTime) {
                        nextStartTimeRef.current = currentTime;
                    }

                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputNode);
                    
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    
                    audioQueueRef.current.add(source);
                    source.onended = () => audioQueueRef.current.delete(source);

                } catch (e) {
                    console.error("Audio Decode Error", e);
                }
            }

            // 3. Handle Interruptions
            if (msg.serverContent?.interrupted) {
                audioQueueRef.current.forEach(src => {
                    try { src.stop(); } catch(e){}
                });
                audioQueueRef.current.clear();
                nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
              console.log("Gemini Live Closed");
              stopSession();
          },
          onerror: (e) => {
              console.error("Gemini Live Error", e);
              stopSession();
          }
        }
      });

    } catch (e) {
      console.error(e);
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    // Stop Mic
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }

    // Stop Output
    if (inputAudioContextRef.current) inputAudioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();

    // Close Session
    sessionPromiseRef.current?.then(s => s.close()); // No explicit close on chat interface, but good practice if available
    
    setIsActive(false);
    setIsConnecting(false);
    setVolume(0);
  };

  // --- Audio Utils (From Spec) ---

  function createBlob(data: Float32Array): GenAIBlob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        // Clamp and scale
        let s = Math.max(-1, Math.min(1, data[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
  }

  function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
  }


  return (
    <>
        <button
            onClick={isActive ? stopSession : startSession}
            disabled={isConnecting}
            className={`fixed bottom-6 right-24 p-4 rounded-full shadow-2xl z-50 transition-all duration-300 print:hidden flex items-center justify-center border-2 border-white/20 ${
                isActive 
                ? 'bg-rose-500 hover:bg-rose-600 scale-110' 
                : 'bg-slate-800 hover:bg-slate-700'
            }`}
            title="Live Voice Mode"
        >
            {isConnecting ? (
                <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : isActive ? (
                // Active State (Waveform visualizer approx)
                <div className="flex items-end gap-1 h-6 w-6 justify-center">
                    <div className="w-1 bg-white rounded-full transition-all duration-75" style={{ height: `${Math.max(20, Math.min(100, volume * 100))}%` }}></div>
                    <div className="w-1 bg-white rounded-full transition-all duration-75" style={{ height: `${Math.max(30, Math.min(100, volume * 150))}%` }}></div>
                    <div className="w-1 bg-white rounded-full transition-all duration-75" style={{ height: `${Math.max(20, Math.min(100, volume * 80))}%` }}></div>
                </div>
            ) : (
                // Mic Icon
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                    <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                    <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 9.375v1.875a.75.75 0 0 1-1.5 0v-1.875A6.751 6.751 0 0 1 5.25 12.75v-1.5a.75.75 0 0 1 .75-.75Z" />
                </svg>
            )}
        </button>
        
        {isActive && (
             <div className="fixed bottom-24 right-24 bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-lg shadow-lg z-50 animate-bounce print:hidden">
                 Live Audio Active
             </div>
        )}
    </>
  );
};
