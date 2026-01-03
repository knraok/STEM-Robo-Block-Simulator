
import React, { useState, useEffect, useRef } from 'react';
import { MotionMode, Block, HardwareConfig } from './types';
import RobotSimulator from './components/RobotSimulator';
import BlockCoding from './components/BlockCoding';
import { explainCode } from './services/geminiService';
import { 
  Brain, 
  Play, 
  Square, 
  RotateCcw, 
  Cpu, 
  Radio, 
  ShieldAlert, 
  Settings, 
  Link, 
  CheckCircle2, 
  XCircle, 
  Smartphone, 
  Usb, 
  Terminal, 
  BookOpen, 
  AlertTriangle,
  Info
} from 'lucide-react';

const App: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [currentMode, setCurrentMode] = useState<MotionMode>(MotionMode.STOP);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [isExplaining, setIsExplaining] = useState(false);
  
  // Use a Ref to track running state to avoid stale closure issues in the async loop
  const isRunningRef = useRef(false);
  
  // Hardware & Serial State
  const [showConfig, setShowConfig] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [serialPort, setSerialPort] = useState<any>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isSerialSupported, setIsSerialSupported] = useState(true);
  
  // Ref for the writer to ensure it's not lost between renders
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
    // Check for Web Serial support
    // @ts-ignore
    if (!navigator.serial) {
      setIsSerialSupported(false);
    }
  }, [config]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTerminalLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 30));
  };

  const connectHardware = async () => {
    try {
      addLog("INIT: Requesting USB Port...");
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      
      const writer = port.writable.getWriter();
      serialWriterRef.current = writer;
      setSerialPort(port);
      
      addLog("SUCCESS: Link Established with ESP32 @ 115200bps.");
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        addLog("CANCELLED: No device was selected.");
      } else if (err.name === 'NetworkError') {
        addLog("ERROR: Port Busy. Is the Arduino Serial Monitor open? Please close it!");
      } else {
        addLog("ERROR: " + err.message);
      }
    }
  };

  const disconnectHardware = async () => {
    if (serialWriterRef.current) {
      try {
        await serialWriterRef.current.releaseLock();
      } catch (e) {}
      serialWriterRef.current = null;
    }
    if (serialPort) {
      try {
        await serialPort.close();
      } catch (e) {}
      setSerialPort(null);
    }
    addLog("OFFLINE: Serial Port Closed.");
  };

  const sendToHardware = async (block: Block | null) => {
    if (!serialWriterRef.current) return;
    
    try {
      const command = block 
        ? JSON.stringify({ t: block.type, s: block.speed, d: block.duration }) + "\n"
        : JSON.stringify({ t: "STOP", s: 0, d: 0 }) + "\n";
      
      const encoder = new TextEncoder();
      await serialWriterRef.current.write(encoder.encode(command));
      addLog(`TXD >> ${command.trim()}`);
    } catch (err) {
      addLog("TX ERROR: Failed to send data packet.");
      disconnectHardware(); // Force disconnect on failure to allow clean retry
    }
  };

  const addBlock = (type: MotionMode) => {
    const newBlock: Block = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      duration: 1,
      speed: 80,
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (index: number) => {
    const newBlocks = [...blocks];
    newBlocks.splice(index, 1);
    setBlocks(newBlocks);
  };

  const updateBlock = (index: number, updates: Partial<Block>) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates };
    setBlocks(newBlocks);
  };

  const stopMission = () => {
    isRunningRef.current = false;
    setIsRunning(false);
    setActiveBlockIndex(null);
    setCurrentMode(MotionMode.STOP);
    setCurrentSpeed(0);
    sendToHardware(null);
    addLog("STOPPED: Mission interrupted by user.");
  };

  const resetSimulator = () => {
    isRunningRef.current = false;
    setIsRunning(false);
    setActiveBlockIndex(null);
    setCurrentMode(MotionMode.STOP);
    setCurrentSpeed(0);
    sendToHardware(null);
  };

  const runProgram = async () => {
    if (blocks.length === 0 || isRunning) return;

    isRunningRef.current = true;
    setIsRunning(true);
    addLog("STARTING MISSION: Processing blocks sequentially...");
    
    for (let i = 0; i < blocks.length; i++) {
      // Re-check Ref inside loop to see if user clicked STOP
      if (!isRunningRef.current) break;

      const block = blocks[i];
      setActiveBlockIndex(i);
      setCurrentMode(block.type);
      setCurrentSpeed(block.speed * 2);
      
      await sendToHardware(block);

      // Sleep for the specified duration
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, block.duration * 1000);
        // Periodically check if we should stop early
        const checkInterval = setInterval(() => {
          if (!isRunningRef.current) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            resolve(null);
          }
        }, 50);
      });

      if (!isRunningRef.current) break;
    }
    
    if (isRunningRef.current) {
      addLog("MISSION COMPLETE: All blocks executed.");
    }
    resetSimulator();
  };

  const handleExplain = async () => {
    setIsExplaining(true);
    const text = await explainCode(blocks, config);
    setAiExplanation(text);
    setIsExplaining(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50">
      {/* Compatibility Banner */}
      {!isSerialSupported && (
        <div className="bg-rose-600 text-white px-6 py-2 flex items-center justify-center gap-3 text-sm font-bold animate-pulse">
          <AlertTriangle className="w-5 h-5" />
          <span>INCOMPATIBLE BROWSER: Please use Google Chrome or Microsoft Edge for Hardware Support.</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.4)]">
            <Cpu className="text-slate-950 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent leading-none">
              STEM Robo-Block
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">4WD Demo Platform</span>
              <div className={`flex items-center gap-1 ${serialPort ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'} px-1.5 py-0.5 rounded border border-current/20`}>
                <div className={`w-1.5 h-1.5 rounded-full ${serialPort ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-[9px] font-bold uppercase">{serialPort ? 'Linked' : 'No Hardware'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowManual(true)}
            className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-4 py-2 rounded-full font-semibold text-sm transition-all border border-indigo-500/20"
          >
            <BookOpen className="w-4 h-4" />
            Demo Manual
          </button>
          
          <button 
            disabled={!isSerialSupported}
            onClick={serialPort ? disconnectHardware : connectHardware}
            className={`flex items-center gap-2 ${serialPort ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'} px-4 py-2 rounded-full font-semibold text-sm transition-all border disabled:opacity-30`}
          >
            <Usb className="w-4 h-4" />
            {serialPort ? 'Disconnect' : 'Connect ESP32'}
          </button>

          <button onClick={() => setShowConfig(true)} className="p-2 text-slate-400 hover:text-white">
            <Settings className="w-5 h-5" />
          </button>
          
          <div className="w-px h-8 bg-slate-800 mx-2" />

          {isRunning ? (
            <button 
              onClick={stopMission}
              className="flex items-center gap-2 bg-rose-500 hover:bg-rose-400 text-white px-8 py-2.5 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(244,63,94,0.3)] animate-pulse"
            >
              <Square className="w-4 h-4 fill-current" />
              STOP MISSION
            </button>
          ) : (
            <button 
              onClick={runProgram}
              disabled={blocks.length === 0}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:opacity-50 text-slate-950 px-8 py-2.5 rounded-full font-bold transition-all shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" />
              RUN MISSION
            </button>
          )}
        </div>
      </header>

      {/* Manual / Troubleshooting Modal */}
      {showManual && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-8">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-block">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3 text-indigo-400">
                <BookOpen className="w-6 h-6" />
                <h2 className="font-bold text-xl">Educator's Deployment Guide</h2>
              </div>
              <button onClick={() => setShowManual(false)} className="text-slate-500 hover:text-white text-2xl font-light">✕</button>
            </div>
            
            <div className="flex-1 p-8 overflow-y-auto space-y-8 custom-scrollbar">
              {/* Troubleshooting Alert */}
              <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-3xl space-y-4">
                <h3 className="text-rose-400 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> CONNECTION TROUBLESHOOTING
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
                  <li className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                    <span className="text-rose-400 font-bold block mb-1">1. Close Arduino Serial Monitor</span>
                    The browser cannot "steal" the port if Arduino IDE is still watching the Serial output. Close the IDE terminal!
                  </li>
                  <li className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                    <span className="text-rose-400 font-bold block mb-1">2. Check Your Cable</span>
                    Ensure you're using a **Data Cable**, not just a "Charging Cable". Some cheap USB cables only transmit power.
                  </li>
                  <li className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                    <span className="text-rose-400 font-bold block mb-1">3. USB Drivers (CH340/CP2102)</span>
                    If your computer doesn't see "COM3" or "USB Serial", you likely need to install the driver for your specific ESP32 board.
                  </li>
                  <li className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                    <span className="text-rose-400 font-bold block mb-1">4. Reload Page</span>
                    If it glitched, reload this app. Web Serial sessions sometimes need a fresh start after a physical unplug.
                  </li>
                </ul>
              </div>

              <section className="space-y-4">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Info className="w-5 h-5 text-indigo-400" /> Transmitter Bridge Firmware
                </h3>
                <p className="text-sm text-slate-400 italic">Flash this to your Joystick/Transmitter ESP32 using Arduino IDE:</p>
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto relative group">
<pre>{`#include <esp_now.h>
#include <WiFi.h>
#include <ArduinoJson.h>

// MAC address of the 4WD Car
uint8_t robotAddress[] = {${config.receiverMac.split(':').map(h => '0x'+h).join(', ')}};

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  pinMode(2, OUTPUT); // Onboard LED for status
  
  if (esp_now_init() != ESP_OK) return;
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, robotAddress, 6);
  peerInfo.channel = 0; peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);
}

void loop() {
  if (Serial.available()) {
    digitalWrite(2, HIGH); // Blink LED when data arrives
    String data = Serial.readStringUntil('\\n');
    esp_now_send(robotAddress, (uint8_t *)data.c_str(), data.length());
    delay(10);
    digitalWrite(2, LOW);
  }
}`}</pre>
                </div>
              </section>
            </div>
            
            <div className="p-6 border-t border-slate-800 bg-slate-800/30">
              <button 
                onClick={() => setShowManual(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
              >
                I'VE CHECKED EVERYTHING - LET'S GO!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAC Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-block">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <Link className="w-5 h-5" />
                <h2 className="font-bold text-lg">Hardware Setup</h2>
              </div>
              <button onClick={() => setShowConfig(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Transmitter MAC</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 font-mono text-sm text-emerald-400"
                    value={config.transmitterMac}
                    onChange={(e) => setConfig({...config, transmitterMac: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Robot (Receiver) MAC</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 font-mono text-sm text-emerald-400"
                    value={config.receiverMac}
                    onChange={(e) => setConfig({...config, receiverMac: e.target.value.toUpperCase()})}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic">Changing these MAC addresses will update the "Bridge Code" in the manual.</p>
              <button onClick={() => setShowConfig(false)} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition-all">
                SAVE HARDWARE LINKS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-12 gap-6 p-6 overflow-hidden">
        {/* Left: Code Blocks */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 overflow-hidden">
          <BlockCoding 
            blocks={blocks} 
            onAddBlock={addBlock} 
            onRemoveBlock={removeBlock} 
            onUpdateBlock={updateBlock}
            activeBlockIndex={activeBlockIndex}
            isRunning={isRunning}
          />
          
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <button 
              onClick={handleExplain}
              disabled={isExplaining || blocks.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all shadow-lg"
            >
              <Brain className={`w-5 h-5 ${isExplaining ? 'animate-bounce' : ''}`} />
              {isExplaining ? 'AI ANALYZING...' : 'AI EXPLAIN MY LOGIC'}
            </button>
            {aiExplanation && (
              <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-indigo-500/30 text-sm text-slate-300 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                <p className="font-bold text-indigo-400 mb-2 flex items-center gap-1">
                  <Brain className="w-4 h-4" /> AI Tutor:
                </p>
                {aiExplanation}
              </div>
            )}
          </div>
        </div>

        {/* Right: Simulator & Terminal */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-hidden">
          <div className="flex-[2] min-h-[350px]">
            <RobotSimulator 
              currentMode={currentMode} 
              currentSpeed={currentSpeed} 
              isRunning={isRunning} 
            />
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
            {/* Live Console */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <Terminal className="w-3 h-3" /> HW Serial Debugger
                </div>
                {serialPort && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
              </div>
              <div className="flex-1 p-3 font-mono text-[9px] text-emerald-500/90 overflow-y-auto bg-slate-950 custom-scrollbar">
                {terminalLogs.length === 0 ? (
                  <p className="text-slate-700 italic">Awaiting hardware connection...</p>
                ) : (
                  terminalLogs.map((log, i) => <div key={i} className="mb-0.5 leading-tight opacity-90">{log}</div>)
                )}
              </div>
            </div>

            {/* Network Info */}
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between">
              <div className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Radio className="text-indigo-400 w-4 h-4" /> 
                  ESP-NOW Topology
                </h4>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-950/80 p-2 rounded-xl border border-slate-700/50">
                    <p className="text-[7px] text-slate-500 uppercase font-black mb-1">Controller</p>
                    <p className="text-[10px] font-mono text-indigo-400 truncate">{config.transmitterMac}</p>
                  </div>
                  <Link className="w-3 h-3 text-slate-700 shrink-0" />
                  <div className="flex-1 bg-slate-950/80 p-2 rounded-xl border border-slate-700/50">
                    <p className="text-[7px] text-slate-500 uppercase font-black mb-1">4WD Robot</p>
                    <p className="text-[10px] font-mono text-emerald-400 truncate">{config.receiverMac}</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-start gap-3">
                <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Real-time synchronization active. Every movement in the simulator generates a corresponding packet sent from <b>{config.transmitterMac.slice(-5)}</b> to your car.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 px-6 py-2.5 flex justify-between items-center text-[9px] text-slate-500 font-medium uppercase tracking-[0.2em]">
        <span>STEM Robotics Educators Demo v2.1</span>
        <div className="flex gap-6 items-center">
          <span className="flex items-center gap-1">
            <CheckCircle2 className={`w-3 h-3 ${serialPort ? 'text-emerald-500' : 'text-slate-700'}`} /> USB API
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-indigo-500" /> ESP-NOW 2.4GHz
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
