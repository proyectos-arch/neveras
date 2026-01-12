'use client';

export type ChamberType = '+2+8' | '+15+25' | '-15-25' | 'FRIDGE-30';

export type GelPackModel = 's4' | 's22' | 'm20';

export type GelPackVolume = 4 | 12 | 28 | 56 | 96;

export type GelPackStatus = 'Por activar' | 'Leaked Test' | 'Conditioning' | 'Ready' | 'In-Use' | 'Inspección' | 'Discarded';

export type UserRole = 'super-admin' | 'admin' | 'operator';

export type ConditioningEvent = {
  startTime: string; // ISO 8601 string
  endTime?: string; // ISO 8601 string
  chamberType: string; // Keep as string for flexibility from settings
};

export interface Reading {
  id: string;
  gelPackId: string;
  temperature: number;
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: string; // ISO 8601 string
  status: 'Normal' | 'Alert';
}

export interface GelPack {
  id: string;
  serial: string; 
  model: GelPackModel;
  volume: GelPackVolume;
  chamberType: ChamberType; // The main chamber type associated with the model
  status: GelPackStatus;
  createdAt: string; // ISO 8601 string
  ownerId: string;
  conditioningHistory: ConditioningEvent[];
  lastConditioningEvent?: ConditioningEvent | null;
  qrCodeUrl: string;
  readings?: Reading[]; 
}

export interface ConditioningStep {
    chamber: string;
    hours: number;
}

export interface ConditioningProfile {
    steps: ConditioningStep[];
}

export interface UserProfile {
    userId: string;
    email: string;
    displayName?: string;
    leakedTestHours: number;
    conditioningProfiles: {
        s4: ConditioningProfile;
        s22: ConditioningProfile;
        m20: ConditioningProfile;
    };
    role: UserRole;
}

export interface GTC {
  id: string;
  serial: string;
  volume: 4 | 12 | 28 | 56 | 96;
  status: 'Available' | 'In-Transit' | 'Returned';
  ownerId: string;
  createdAt: string; // ISO 8601
}

export interface Assembly {
  id: string;
  gtcId: string;
  gtcSerial: string;
  chamberType: ChamberType;
  gelPackIds: string[];
  status: 'Assembling' | 'In-Transit' | 'Returned' | 'Aborted';
  ownerId: string;
  createdAt: string; // ISO 8601
  transitStartTime?: string; // ISO 8601
  returnTime?: string; // ISO 8601
}
