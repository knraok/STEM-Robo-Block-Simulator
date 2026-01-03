
import React, { useState, useEffect, useRef } from 'react';
import { BlockType, Block, HardwareConfig } from './types';
import RobotSimulator from './components/RobotSimulator';
import BlockCoding from './components/BlockCoding';
import { explainCode } from './services/geminiService';
import { 
  Brain, Play, Square, Cpu, Radio, ShieldAlert, Settings, 
  Link, Usb, Terminal, BookOpen, AlertTriangle, Sparkles, Radar,
  Search, Info, CheckCircle2
} from 'lucide-react';

const App: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<BlockType>(BlockType.STOP);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [ledOn, setLedOn] = useState(false);
  const [buzzerOn, setBuzzerOn] = useState(false);
  const [distance, setDistance] = useState(100);
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [isExplaining, setIsExplaining] = useState(false);
  
  const isRunningRef = useRef(false);
  const distanceRef = useRef(100);
  const [showConfig, setShowConfig] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [serialPort, setSerialPort] = useState<any>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isSerialSupported, setIsSerialSupported] = useState(true);
  const serialWriterRef = useRef<any>(null);

  const [config, setConfig] = useState<HardwareConfig>(() => {
    const saved = localStorage.getItem('robo_hw_config');
    return saved ? JSON.parse(saved) : {
      transmitterMac: 'BC:DD:C2:E1:92:44',
      receiverMac: 'BC:DD:C2:E1:92:F0'
    };
  });

  useEffect(() => {
    localStorage.setItem('robo_hw_config', JSON.stringify(config));
    // @ts-ignore
    if (!navigator.serial) setIsSerialSupported(false);
  }, [config]);

  const addLog = (msg: string, type: 'info' | 'error' | 'success' | 'tx' | 'rx' = 'info') => {
    const ts = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const prefixes = { info: 'ℹ️', error: '❌', success: '✅', tx: '📤', rx: '📥' };
    setTerminalLogs(prev => [`[${ts}] ${prefixes[type]} ${msg}`, ...prev].slice(0, 40));
  };

  const startSerialReading = async (port: any) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    try {
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            if (data.d !== undefined) {
              setDistance(data.d);
              distanceRef.current = data.d;
            }
            if (data.status === 'pong') {
              addLog("PONG: Link to Robot Verified!", 'success');
            }
          } catch (e) {
            // Log raw text if not JSON (useful for debugging MAC prints)
            addLog(`DEBUG: ${trimmed}`, 'rx');
          }
        }
      }
    } catch (error) {
      addLog("COMM ERROR: Serial reading stopped.", 'error');
    } finally {
      reader.releaseLock();
    }
  };

  const connectHardware = async () => {
    try {
      addLog("Scanning for ESP32 Controllers...", 'info');
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      serialWriterRef.current = port.writable.getWriter();
      setSerialPort(port);
      startSerialReading(port);
      addLog("Connected to USB Bridge. MAC Filter: " + config.receiverMac, 'success');
    } catch (err: any) {
      addLog("Link Failed: " + err.message, 'error');
    }
  };

  const testPing = async () => {
    if (!serialWriterRef.current) return;
    addLog("PING: Sending test packet to " + config.receiverMac, 'info');
    await sendToHardware({ type: BlockType.LED, state: true, speed: 0, duration: 0.1, id: 'ping' });
    setTimeout(() => sendToHardware({ type: BlockType.LED, state: false, speed: 0, duration: 0.1, id: 'ping' }), 200);
  };

  const disconnectHardware = async () => {
    if (serialWriterRef.current) {
      await serialWriterRef.current.releaseLock();
      serialWriterRef.current = null;
    }
    if (serialPort) {
      await serialPort.close();
      setSerialPort(null);
    }
    addLog("Serial Bridge Offline.", 'info');
  };

  const sendToHardware = async (block: Partial<Block> | null) => {
    if (!serialWriterRef.current) return;
    try {
      const payload = block 
        ? JSON.stringify({ t: block.type, s: block.speed, st: block.state, th: block.threshold })
        : JSON.stringify({ t: "STOP", s: 0 });
      const encoder = new TextEncoder();
      await serialWriterRef.current.write(encoder.encode(payload + "\n"));
      if (block && block.id !== 'ping') addLog(`SEND: ${block.type}`, 'tx');
    } catch (err) {
      disconnectHardware();
    }
  };

  const addBlock = (type: BlockType, parentId?: string) => {
    const newBlock: Block = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      duration: 1,
      speed: 80,
      threshold: 20,
      iterations: type === BlockType.REPEAT ? 3 : undefined,
      state: (type === BlockType.LED || type === BlockType.BUZZER) ? true : undefined,
      children: type === BlockType.REPEAT ? [] : undefined
    };

    if (parentId) {
      setBlocks(prev => {
        const updateChildren = (list: Block[]): Block[] => {
          return list.map(b => {
            if (b.id === parentId) return { ...b, children: [...(b.children || []), newBlock] };
            if (b.children) return { ...b, children: updateChildren(b.children) };
            return b;
          });
        };
        return updateChildren(prev);
      });
    } else {
      setBlocks([...blocks, newBlock]);
    }
  };

  const removeBlock = (id: string) => {
    const removeRecursively = (list: Block[]): Block[] => {
      return list.filter(b => b.id !== id).map(b => ({
        ...b,
        children: b.children ? removeRecursively(b.children) : undefined
      }));
    };
    setBlocks(removeRecursively(blocks));
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    const updateRecursively = (list: Block[]): Block[] => {
      return list.map(b => {
        if (b.id === id) return { ...b, ...updates };
        if (b.children) return { ...b, children: updateRecursively(b.children) };
        return b;
      });
    };
    setBlocks(updateRecursively(blocks));
  };

  const executeBlock = async (block: Block) => {
    if (!isRunningRef.current) return;
    setActiveBlockId(block.id);
    
    if (block.type === BlockType.REPEAT) {
      const iters = block.iterations || 1;
      for (let i = 0; i < iters; i++) {
        if (!isRunningRef.current) break;
        if (block.children) {
          for (const child of block.children) await executeBlock(child);
        }
      }
    } else if (block.type === BlockType.ULTRASONIC) {
      const threshold = block.threshold || 20;
      while (isRunningRef.current && distanceRef.current > threshold) {
        await new Promise(r => setTimeout(r, 50));
      }
    } else {
      if (block.type === BlockType.LED) setLedOn(!!block.state);
      if (block.type === BlockType.BUZZER) setBuzzerOn(!!block.state);
      setCurrentMode(block.type);
      setCurrentSpeed(block.speed * 2);
      await sendToHardware(block);
      await new Promise(resolve => {
        const t = setTimeout(resolve, block.duration * 1000);
        const check = setInterval(() => { if (!isRunningRef.current) { clearTimeout(t); clearInterval(check); resolve(null); } }, 50);
      });
    }
  };

  const stopMission = () => {
    isRunningRef.current = false;
    setIsRunning(false);
    setActiveBlockId(null);
    setCurrentMode(BlockType.STOP);
    setCurrentSpeed(0);
    setLedOn(false);
    setBuzzerOn(false);
    sendToHardware(null);
    addLog("MISSION ENDED.", 'info');
  };

  const runProgram = async () => {
    if (blocks.length === 0 || isRunning) return;
    isRunningRef.current = true;
    setIsRunning(true);
    addLog("MISSION START", 'success');
    for (const block of blocks) {
      if (!isRunningRef.current) break;
      await executeBlock(block);
    }
    stopMission();
  };

  const handleExplain = async () => {
    setIsExplaining(true);
    const text = await explainCode(blocks, config);
    setAiExplanation(text);
    setIsExplaining(false);
  };

  const formatMacForArduino = (mac: string) => {
    return mac.split(':').map(h => '0x' + h).join(', ');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50">
      {!isSerialSupported && (
        <div className="bg-rose-600 text-white px-6 py-2 flex items-center justify-center gap-3 text-[10px] font-black animate-pulse">
          <AlertTriangle className="w-4 h-4" /> <span>HARDWARE ERROR: WEB SERIAL NOT SUPPORTED</span>
        </div>
      )}

      <header className="bg-slate-900 border-b border-slate-800 px-8 py-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-500 p-2.5 rounded-[1.5rem] shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <Cpu className="text-slate-950 w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent leading-none">ROBO-BLOCK P2P</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] text-slate-600 uppercase font-black tracking-[0.3em]">ESP-NOW Debugger</span>
              <div className={`w-2 h-2 rounded-full ${serialPort ? 'bg-sky-500 animate-pulse' : 'bg-slate-700'}`} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setShowManual(true)} className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-6 py-3 rounded-2xl font-black text-[10px] uppercase border border-indigo-500/20 transition-all">
            <Search className="w-4 h-4" /> Connection Troubleshooter
          </button>
          
          <div className="flex items-center gap-2">
            <button onClick={serialPort ? disconnectHardware : connectHardware} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase border transition-all ${serialPort ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}>
              <Usb className="w-4 h-4" /> {serialPort ? 'Unlink' : 'Connect'}
            </button>
            {serialPort && (
              <button onClick={testPing} className="bg-amber-500/10 text-amber-400 border border-amber-500/20 p-3 rounded-2xl hover:bg-amber-500/20 transition-all" title="Test Connection">
                <Radar className="w-5 h-5" />
              </button>
            )}
          </div>

          <button onClick={() => setShowConfig(true)} className="p-3 bg-slate-800 rounded-2xl text-slate-400 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          
          <div className="w-px h-10 bg-slate-800 mx-2" />
          {isRunning ? (
            <button onClick={stopMission} className="bg-rose-500 hover:bg-rose-400 text-white px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-500/30">Abort</button>
          ) : (
            <button onClick={runProgram} disabled={blocks.length === 0} className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-slate-950 px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/30">Go!</button>
          )}
        </div>
      </header>

      {showManual && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-50 flex items-center justify-center p-8">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl max-h-[90vh] rounded-[3rem] overflow-hidden shadow-2xl flex flex-col animate-block">
            <div className="p-10 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
              <div className="flex items-center gap-4">
                <Radar className="w-10 h-10 text-sky-400" />
                <div>
                  <h2 className="font-black text-2xl uppercase tracking-tighter text-white">"Why is it not connecting?"</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Troubleshooting ESP-NOW MAC addresses</p>
                </div>
              </div>
              <button onClick={() => setShowManual(false)} className="bg-slate-800 text-slate-400 p-3 rounded-2xl hover:text-white transition-colors text-xl">✕</button>
            </div>
            
            <div className="flex-1 p-12 overflow-y-auto space-y-12 custom-scrollbar">
              <section className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-[2rem] space-y-4">
                <h3 className="text-amber-400 font-black flex items-center gap-2 uppercase tracking-tighter text-lg">
                  <Info className="w-6 h-6" /> Step 1: Confirm Your Robot's MAC
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  ESP32s have TWO Mac addresses (Access Point and Station). <b>ESP-NOW requires the STATION MAC.</b> 
                  Flash this code to your Robot Car and open the Serial Monitor to find the real ID:
                </p>
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 font-mono text-[11px] text-emerald-400">
                  #include &lt;WiFi.h&gt;<br/>
                  void setup() {'{'} Serial.begin(115200); WiFi.mode(WIFI_STA); Serial.println(WiFi.macAddress()); {'}'}<br/>
                  void loop() {'{'} {'}'}
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-lg font-black text-slate-100 flex items-center gap-3"><Cpu className="w-6 h-6 text-indigo-400" /> Bridge (Transmitter) Firmware</h3>
                <p className="text-xs text-slate-400">Flash this to the ESP32 connected to your USB port. It now explicitly adds your Robot as a peer.</p>
                <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 font-mono text-[10px] text-sky-400 leading-relaxed">
<pre>{`#include <esp_now.h>
#include <WiFi.h>

// Robot Car ID from your Config: ${config.receiverMac}
uint8_t robotMac[] = {${formatMacForArduino(config.receiverMac)}};

void setup() {
  Serial.begin(115200); WiFi.mode(WIFI_STA);
  if (esp_now_init() != ESP_OK) return;
  
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, robotMac, 6);
  peerInfo.channel = 0; peerInfo.encrypt = false;
  
  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("FAILED to add robot as peer!");
  }
}

void loop() {
  if (Serial.available()) {
    String d = Serial.readStringUntil('\\n');
    esp_now_send(robotMac, (uint8_t*)d.c_str(), d.length());
  }
}`}</pre>
                </div>
              </section>
            </div>
            
            <div className="p-8 border-t border-slate-800 bg-slate-800/50 flex justify-between items-center">
               <div className="flex items-center gap-3 text-emerald-400 text-[10px] font-black uppercase">
                 <CheckCircle2 className="w-5 h-5" /> 2.4GHz Direct Link Active
               </div>
               <button onClick={() => setShowManual(false)} className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-12 py-4 rounded-2xl transition-all shadow-xl text-xs uppercase tracking-widest">
                 Update my hardware now
               </button>
            </div>
          </div>
        </div>
      )}

      {showConfig && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-block p-10 space-y-8">
            <h2 className="font-black text-xl text-sky-400 uppercase text-center tracking-tighter">Network Paring</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">Receiver (4WD Car) MAC</label>
                <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 font-mono text-sm text-emerald-400 focus:outline-none ring-2 ring-emerald-500/20"
                  value={config.receiverMac} onChange={(e) => setConfig({...config, receiverMac: e.target.value.toUpperCase()})} />
                <p className="text-[9px] text-slate-600 italic">Format: BC:DD:C2:E1:92:F0</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest block">Bridge (Joystick) MAC</label>
                <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 font-mono text-sm text-indigo-400 focus:outline-none ring-2 ring-indigo-500/20"
                  value={config.transmitterMac} onChange={(e) => setConfig({...config, transmitterMac: e.target.value.toUpperCase()})} />
              </div>
            </div>
            <button onClick={() => setShowConfig(false)} className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-xs shadow-xl">Apply Parity</button>
          </div>
        </div>
      )}

      <main className="flex-1 grid grid-cols-12 gap-8 p-8 overflow-hidden">
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6 overflow-hidden">
          <BlockCoding blocks={blocks} onAddBlock={addBlock} onRemoveBlock={removeBlock} onUpdateBlock={updateBlock} activeBlockId={activeBlockId} isRunning={isRunning} />
          <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl flex flex-col justify-between">
            <button onClick={handleExplain} disabled={isExplaining || blocks.length === 0}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20">
              <Brain className={`w-5 h-5 ${isExplaining ? 'animate-bounce' : ''}`} /> {isExplaining ? 'AI Processing...' : 'AI Tutor: Explain Mission'}
            </button>
            {aiExplanation && (
              <div className="mt-6 p-6 bg-slate-800/40 rounded-[2rem] border border-indigo-500/20 text-xs text-slate-300 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar italic">
                {aiExplanation}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 flex flex-col gap-8 overflow-hidden">
          <div className="flex-[3] min-h-[450px]">
            <RobotSimulator currentMode={currentMode} currentSpeed={currentSpeed} isRunning={isRunning} ledOn={ledOn} buzzerOn={buzzerOn} distance={distance} />
          </div>
          <div className="flex-[1.5] bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-3 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest"><Terminal className="w-3 h-3" /> Hardware Diagnostics Feed</div>
              {serialPort && <div className="text-[8px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full font-bold">115200 BAUD</div>}
            </div>
            <div className="flex-1 p-5 font-mono text-[9px] text-sky-500/90 overflow-y-auto bg-slate-950 custom-scrollbar">
              {terminalLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-800 space-y-2">
                  <Usb className="w-6 h-6 opacity-20" />
                  <p className="italic">Connect to Bridge ESP32 to see live data packets...</p>
                </div>
              ) : (
                terminalLogs.map((log, i) => <div key={i} className="mb-1 leading-tight border-b border-white/5 pb-1">{log}</div>)
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
