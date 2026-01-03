
export enum BlockType {
  // Motion
  FORWARD = 'FORWARD',
  BACKWARD = 'BACKWARD',
  TURN_LEFT = 'TURN_LEFT',
  TURN_RIGHT = 'TURN_RIGHT',
  SPIN_LEFT = 'SPIN_LEFT',
  SPIN_RIGHT = 'SPIN_RIGHT',
  STOP = 'STOP',
  // Control
  REPEAT = 'REPEAT',
  WAIT = 'WAIT',
  // Sensors
  ULTRASONIC = 'ULTRASONIC',
  // Actions
  LED = 'LED',
  BUZZER = 'BUZZER'
}

export interface Block {
  id: string;
  type: BlockType;
  duration: number; // seconds
  speed: number;   // 0-100
  iterations?: number; // for REPEAT
  state?: boolean;     // for LED/Buzzer
  threshold?: number;  // for ULTRASONIC (cm)
  children?: Block[];  // for REPEAT
}

export interface RobotState {
  x: number;
  y: number;
  angle: number;
  leftSpeed: number;
  rightSpeed: number;
  ledOn: boolean;
  buzzerOn: boolean;
  distance: number; // Current sensor reading in cm
}

export interface HardwareConfig {
  transmitterMac: string;
  receiverMac: string;
}
