import { createContext } from 'react';
import type { DicoloreReport } from '@/lib/dicoloreReportCache';

export interface DicoloreReportState {
  isDicolore: boolean;
  scope: string;
  ready: boolean;
  report?: DicoloreReport;
  approved: boolean;
}

export const DicoloreReportContext = createContext<DicoloreReportState>({
  isDicolore: false, scope: '', ready: false, approved: false,
});