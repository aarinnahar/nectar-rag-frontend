import React, { useState } from 'react';
import { 
  UploadCloud, FileText, CheckCircle2, 
  Sparkles, Key, Cpu, Zap, Layers, Play, AlertCircle, 
  Trash2, ArrowRight, ArrowLeft, ShieldCheck, Terminal,
  X, Eye, Database, BarChart, Download // <-- Added Download Icon
} from 'lucide-react';

export default function NectarRagDashboard() {

  // --- Execution & Streaming State ---
  const [isRunning, setIsRunning] = useState(false);
  const [reportHtml, setReportHtml] = useState(null); 
  const [liveNode, setLiveNode] = useState('');
  
  // --- UI State ---
  const [currentStep, setCurrentStep] = useState(1);
  const [showSamplesModal, setShowSamplesModal] = useState(false);

  // --- File Upload State ---
  const [docFile, setDocFile] = useState(null);
  const [goldenDataFile, setGoldenDataFile] = useState(null);
  const [docError, setDocError] = useState('');
  const [jsonError, setJsonError] = useState('');

  // --- Chunking State ---
  const [chunkSize, setChunkSize] = useState(500);
  const [chunkOverlap, setChunkOverlap] = useState(50);

  // --- LLM Config State ---
  const [llmProvider, setLlmProvider] = useState('openai');
  const [llmKey, setLlmKey] = useState('');
  const [llmModel, setLlmModel] = useState('gpt-4o');
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  
  // --- Provider Catalogs ---
  const llmModelCatalog = {
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o (Omni)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
    ],
    groq: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
      { id: 'openai/gpt-oss-20b', name: 'Open AI-GPT OSS 20B' }
    ],
    ollama: [
      { id: 'llama3:latest', name: 'Llama 3 (Local)' },
      { id: 'mistral:7b', name: 'Mistral 7B (Local)' },
      { id: 'deepseek-r1:8b', name: 'DeepSeek R1 8B (Local)' }
    ]
  };

  const handleLlmProviderChange = (e) => {
    const p = e.target.value;
    setLlmProvider(p);
    setLlmModel(llmModelCatalog[p][0].id);
  };

  const handleDocUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setDocError('File size exceeds 100MB.');
      return;
    }
    setDocError('');
    setDocFile(file);
    setReportHtml(null); // Reset report if a new file is uploaded
  };

  const handleJsonUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setJsonError('Invalid format. .json only.');
      return;
    }
    setJsonError('');
    setGoldenDataFile(file);
    setReportHtml(null); // Reset report if a new file is uploaded
  };

  const handleRunEvaluation = async () => {
    if (!docFile || !goldenDataFile) return;
    
    setIsRunning(true);
    setReportHtml(null); 
    setLiveNode('Initializing Server...'); // <-- Triggers the Modal

    try {
      const API_BASE_URL = 'https://erasable-debtor-moisten.ngrok-free.dev'; 

      const formData = new FormData();
      formData.append('file', docFile);
      formData.append('dataset', goldenDataFile);
      formData.append('chunk_size', chunkSize);
      formData.append('chunk_overlap', chunkOverlap);
      formData.append('provider', llmProvider);
      formData.append('model_choice', llmModel);
      formData.append('api_key', llmKey);
      formData.append('api_url', ollamaEndpoint);

      const response = await fetch(`${API_BASE_URL}/evaluate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        // Try to safely parse the FastAPI error detail
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          // If it's not JSON, ignore
        }

        // If FastAPI sent a specific detail message (like the 100-page limit)
        if (errorData.detail) {
          setDocError(errorData.detail); // Put the red text under the upload box
          setLiveNode('');               // <--- CRITICAL: Close the modal!
          return;                        // Abort the rest of the pipeline
        }
        
        // If it's a generic server crash (like 500)
        throw new Error(`Server returned ${response.status}`);
      }

      // --- Read the Live Stream ---
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop(); // Keep incomplete event string in buffer
          
          for (const event of events) {
            if (event.startsWith('data: ')) {
              const dataStr = event.slice(6);
              const data = JSON.parse(dataStr);
              
              if (data.error) throw new Error(data.error);
              
              if (data.status === 'completed') {
                setReportHtml(data.report_html);
                setLiveNode(''); // Close Modal
              } else if (data.node) {
                // Formatting internal LangGraph names like "generate_report" to "Generate Report"
                const formattedNodeName = data.node.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                setLiveNode(formattedNodeName); 
              }
            }
          }
        }
      }

    } catch (error) {
      console.error("Evaluation failed:", error);
      alert(`Pipeline Error: ${error.message}`);
      setLiveNode(''); // Close Modal on error
    } finally {
      setIsRunning(false);
    }
  };

  // <-- Handle forcing the browser to download the stored HTML string
  const handleDownloadReport = () => {
    if (!reportHtml) return;
    
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const downloadUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'nectar_evaluation_report.html';
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  const steps = [
    { id: 1, title: 'Knowledge Ingestion', icon: Layers },
    { id: 2, title: 'Chunking Strategy', icon: Sparkles },
    { id: 3, title: 'Model Config', icon: Cpu }
  ];

  const filesReady = docFile && goldenDataFile;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 font-sans antialiased selection:bg-amber-400 selection:text-black flex flex-col">
      
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Main Container */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 w-full max-w-4xl mx-auto z-10">
        
        {/* Hero Section */}
        <div className="text-center mb-12 mt-8">
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4">
            Nectar <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">RAG</span>
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            Evaluate, optimize, and deploy retrieval-augmented generation pipelines. Quantify precision-recall drift and tune hyperparameters for production-ready AI.
          </p>
        </div>

        {/* Wizard Form Container */}
        <div className="w-full flex flex-col">
          
          {/* Stepper Header */}
          <div className="flex items-center justify-between mb-8 relative w-full px-4 md:px-12">
            <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-px bg-white/5 z-0" />
            {steps.map((step) => {
              const isActive = step.id === currentStep;
              const isPassed = step.id < currentStep;
              const Icon = step.icon;
              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 bg-[#030712] px-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isActive ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 
                    isPassed ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-white/10 bg-[#0A0E17] text-slate-500'
                  }`}>
                    {isPassed ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-xs font-semibold tracking-wide ${isActive ? 'text-white' : 'text-slate-500'}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Dynamic Step Content */}
          <div className="w-full bg-[#0A0E17] border border-white/5 rounded-2xl shadow-2xl p-8 mb-6">
            
            {/* STEP 1 */}
            {currentStep === 1 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <h2 className="text-lg font-semibold text-white mb-6">Upload Context & Truth</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Source Documents */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Source Documents</label>
                    <div className={`relative group border border-dashed rounded-xl p-6 text-center transition duration-200 flex flex-col justify-center min-h-[140px] ${docFile ? 'border-amber-500/50 bg-amber-500/[0.02]' : 'border-white/10 hover:border-white/20 bg-white/[0.01]'}`}>
                      <input type="file" accept=".pdf,.ppt,.pptx,.doc,.docx" onChange={handleDocUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      {docFile ? (
                        <div className="flex items-center justify-between text-left">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center"><FileText className="w-5 h-5 text-amber-400" /></div>
                            <div>
                              <p className="text-sm font-medium text-white truncate max-w-[150px]">{docFile.name}</p>
                              <p className="text-xs text-slate-500">{(docFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setDocFile(null); setReportHtml(null); }} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-red-400 transition z-10 relative"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="space-y-2 pointer-events-none">
                          <UploadCloud className="w-8 h-8 mx-auto text-slate-500 group-hover:text-amber-400 transition" />
                          <p className="text-sm text-slate-400"><span className="text-amber-400 font-medium">Click to upload</span> or drag</p>
                          <p className="text-[11px] text-slate-500 font-medium">Supports PDF, PPT, DOC</p>
                        </div>
                      )}
                    </div>
                    {docError && <p className="mt-2 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{docError}</p>}
                  </div>

                  {/* Golden Dataset */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Golden Dataset (.json)</label>
                    <div className={`relative group border border-dashed rounded-xl p-6 text-center transition duration-200 flex flex-col justify-center min-h-[140px] ${goldenDataFile ? 'border-emerald-500/50 bg-emerald-500/[0.02]' : 'border-white/10 hover:border-white/20 bg-white/[0.01]'}`}>
                      <input type="file" accept=".json" onChange={handleJsonUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      {goldenDataFile ? (
                        <div className="flex items-center justify-between text-left">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-400/10 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-emerald-400" /></div>
                            <div>
                              <p className="text-sm font-medium text-white truncate max-w-[150px]">{goldenDataFile.name}</p>
                              <p className="text-xs text-slate-500">Schema Validated</p>
                            </div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setGoldenDataFile(null); setReportHtml(null); }} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-red-400 transition z-10 relative"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="space-y-2 pointer-events-none">
                          <UploadCloud className="w-8 h-8 mx-auto text-slate-500 group-hover:text-emerald-400 transition" />
                          <p className="text-sm text-slate-400"><span className="text-emerald-400 font-medium">Upload ground truth</span> set</p>
                          <p className="text-[11px] text-slate-500 font-medium">JSON only</p>
                        </div>
                      )}
                    </div>
                    {jsonError && <p className="mt-2 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{jsonError}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {currentStep === 2 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Chunk Partitioning</h2>
                  <span className="text-xs text-slate-500 font-mono bg-white/5 px-2 py-1 rounded">Sliding Window Alg</span>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Chunk Size</label>
                      <span className="font-mono text-sm px-3 py-1 rounded bg-black/50 border border-white/5 text-amber-400">{chunkSize} <span className="text-[10px] text-slate-500">TOKENS</span></span>
                    </div>
                    <input type="range" min="100" max="2000" step="50" value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400" />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Chunk Overlap</label>
                      <span className="font-mono text-sm px-3 py-1 rounded bg-black/50 border border-white/5 text-amber-400">{chunkOverlap} <span className="text-[10px] text-slate-500">TOKENS</span></span>
                    </div>
                    <input type="range" min="0" max="300" step="5" value={chunkOverlap} onChange={(e) => setChunkOverlap(Number(e.target.value))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400" />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {currentStep === 3 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <h2 className="text-lg font-semibold text-white">Model Selection</h2>
                
                <div className="grid grid-cols-1 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-amber-400 flex items-center gap-2 border-b border-white/5 pb-2"><Cpu className="w-4 h-4" /> LLM Inference</h3>
                    <div className="space-y-3">
                      <select value={llmProvider} onChange={handleLlmProviderChange} className="w-full bg-[#030712] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-400 outline-none">
                        <option value="openai">OpenAI</option>
                        <option value="groq">Groq</option>
                        <option value="ollama">Ollama (Local)</option>
                      </select>
                      
                      <select value={llmModel} onChange={(e) => setLlmModel(e.target.value)} className="w-full bg-[#030712] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-400 outline-none">
                        {llmModelCatalog[llmProvider].map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>

                      {llmProvider === 'ollama' && (
                        <div className="p-3.5 bg-blue-500/5 rounded-xl border border-blue-500/10 text-[11px] text-slate-300 space-y-2 mt-2">
                          <p className="font-semibold text-blue-400 uppercase tracking-wider">Prerequisites for Ollama:</p>
                          <ul className="list-disc pl-4 space-y-1.5 marker:text-blue-500/50">
                            <li>Install Ollama on your computer.</li>
                            <li>
                              Open your terminal and run:
                              <div className="mt-1.5 flex items-center gap-2 bg-[#030712] border border-white/10 px-2.5 py-1.5 rounded-lg text-blue-300 font-mono">
                                <Terminal className="w-3 h-3 text-slate-500" />
                                ollama pull {llmModel}
                              </div>
                            </li>
                            <li>Make sure Ollama is actively running.</li>
                          </ul>
                        </div>
                      )}

                      {llmProvider === 'ollama' ? (
                        <div className="relative pt-2">
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Ollama Endpoint</label>
                          <div className="relative">
                            <Zap className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                            <input type="text" placeholder="http://localhost:11434" value={ollamaEndpoint} onChange={(e) => setOllamaEndpoint(e.target.value)} className="w-full bg-[#030712] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-amber-400 outline-none transition" />
                          </div>
                        </div>
                      ) : (
                        <div className="relative pt-2">
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">API Key</label>
                          <div className="relative">
                            <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                            <input type="password" placeholder="API Key" value={llmKey} onChange={(e) => setLlmKey(e.target.value)} className="w-full bg-[#030712] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-amber-400 outline-none transition" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex gap-3 mt-4">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-[11px] text-slate-400 leading-tight">Keys use client-side ephemeral sessions and are never stored at rest.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between w-full">
            
            {/* Left Side Action: Samples on Step 1, Back on others */}
            {currentStep === 1 ? (
              <button 
                onClick={() => setShowSamplesModal(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 text-amber-400/80 hover:text-amber-400 bg-amber-400/5 hover:bg-amber-400/10 border border-amber-400/10"
              >
                <Eye className="w-4 h-4" /> View Samples
              </button>
            ) : (
              <button 
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            
            {/* Right Side Action */}
            {currentStep < 3 ? (
              <button 
                onClick={() => setCurrentStep(prev => Math.min(3, prev + 1))}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-2 ml-auto shadow-lg shadow-amber-500/20"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex flex-col items-end gap-2 ml-auto">
                <div className="flex items-center gap-3">
                  {/* <-- Add the Download button conditionally next to Initialize Run --> */}
                  {reportHtml && (
                    <button 
                      onClick={handleDownloadReport}
                      className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center gap-2 shadow-lg shadow-blue-500/20 animate-in fade-in zoom-in"
                    >
                      <Download className="w-4 h-4" /> Download Report
                    </button>
                  )}
                  
                  <button 
                    onClick={handleRunEvaluation}
                    disabled={isRunning || !filesReady}
                    className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-lg ${
                      isRunning || !filesReady
                        ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-400 hover:scale-[1.02] text-slate-950 shadow-emerald-500/20'
                    }`}
                  >
                    {isRunning ? (
                      <><span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /> Provisioning...</>
                    ) : (
                      <><Play className="w-4 h-4 fill-slate-950" /> Initialize Run</>
                    )}
                  </button>
                </div>
                {!filesReady && (
                  <span className="text-[10px] text-amber-500/70 font-medium uppercase tracking-wider">
                    Upload documents (Step 1) to enable
                  </span>
                )}
              </div>
            )}
          </div>

        </div>
      </main>
   
      {/* --- Live Stream Loading Modal --- */}
      {liveNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-all">
          <div className="bg-[#0A0E17] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-8 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-amber-400 rounded-full border-t-transparent animate-spin"></div>
              <Zap className="w-6 h-6 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Executing Pipeline</h3>
            <div className="flex items-center gap-2 text-sm font-mono text-amber-400 bg-amber-400/10 px-4 py-2 rounded-lg border border-amber-400/20">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping"></span>
              {liveNode}
            </div>
            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
              Evaluating RAG architecture and generating metrics...
            </p>
          </div>
        </div>
      )}
      
      {/* --- Samples Dialog Modal --- */}
      {showSamplesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0A0E17] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-400" />
                Example Datasets & Outputs
              </h3>
              <button 
                onClick={() => setShowSamplesModal(false)} 
                className="text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-[#030712] border border-white/5 rounded-xl p-6 flex flex-col items-center text-center gap-4 hover:border-amber-500/30 transition group">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Knowledge Source</h4>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">A sample PDF document containing standard corporate guidelines and HR policies.</p>
                </div>
                <button className="mt-auto px-4 py-2.5 bg-white/5 hover:bg-white/10 text-xs font-semibold rounded-lg text-white transition w-full">
                  Download PDF
                </button>
              </div>

              <div className="bg-[#030712] border border-white/5 rounded-xl p-6 flex flex-col items-center text-center gap-4 hover:border-emerald-500/30 transition group">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Database className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Golden Dataset</h4>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">Pre-formatted ground truth Q&A pairs in JSON format to validate pipeline recall.</p>
                </div>
                <button className="mt-auto px-4 py-2.5 bg-white/5 hover:bg-white/10 text-xs font-semibold rounded-lg text-white transition w-full">
                  Download JSON
                </button>
              </div>

              <div className="bg-[#030712] border border-white/5 rounded-xl p-6 flex flex-col items-center text-center gap-4 hover:border-blue-500/30 transition group">
                <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BarChart className="w-7 h-7 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Evaluation Report</h4>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">A sample output report showing generated RAG metrics, latency, and cost analysis.</p>
                </div>
                <button className="mt-auto px-4 py-2.5 bg-white/5 hover:bg-white/10 text-xs font-semibold rounded-lg text-white transition w-full">
                  View Report
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
