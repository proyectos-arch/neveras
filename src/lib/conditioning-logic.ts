'use client';

import { isAfter, add, formatDistanceToNowStrict } from "date-fns";
import { es } from 'date-fns/locale';
import type { GelPack, UserProfile, ConditioningProfile } from "./types";

const DEFAULT_PROFILES: { [key in 's4' | 's22' | 'm20']: ConditioningProfile } = {
    s4: {
        steps: [
            { chamber: '-15-25', hours: 24 },
            { chamber: '+2+8', hours: 24 },
        ],
    },
    s22: {
        steps: [{ chamber: '+15+25', hours: 24 }],
    },
    m20: {
        steps: [
            { chamber: '-15-25', hours: 24 },
            { chamber: 'FRIDGE-30', hours: 72 },
        ],
    },
};
const DEFAULT_LEAKED_TEST_HOURS = 24;

export const getNextStep = (
    pack: GelPack,
    currentTime: Date,
    userProfile?: UserProfile | null
): { needsAction: boolean, message: string, isReady?: boolean } => {
    const leakedTestHours = userProfile?.leakedTestHours ?? DEFAULT_LEAKED_TEST_HOURS;
    const profiles = userProfile?.conditioningProfiles || DEFAULT_PROFILES;
    const packProfile = profiles[pack.model];

    const lastEvent = pack.lastConditioningEvent;

    const getTimeElapsedMessage = (): string => {
        if (!lastEvent?.startTime) return '';
        const elapsed = formatDistanceToNowStrict(new Date(lastEvent.startTime), { locale: es });
        return ` (ha estado ahí por ${elapsed})`;
    };

    const isTimeUp = (requiredHours: number): boolean => {
        if (!lastEvent?.startTime) return false;
        const endTime = add(new Date(lastEvent.startTime), { hours: requiredHours });
        return isAfter(currentTime, endTime);
    };

    if (pack.status === 'Por activar') {
        return { needsAction: true, message: `Iniciar en Leaked Test.` };
    }

    if (pack.status === 'Leaked Test' && isTimeUp(leakedTestHours)) {
        if (packProfile && packProfile.steps.length > 0) {
            const firstStep = packProfile.steps[0];
            const elapsedMessage = getTimeElapsedMessage();
            return { needsAction: true, message: `Mover de Leaked Test a ${firstStep.chamber}${elapsedMessage}.` };
        }
        return { needsAction: true, message: `Perfil no configurado para ${pack.model}.` };
    }

    if (pack.status === 'Inspección') {
        return { needsAction: true, message: `Aprobar para reacondicionar o descartar.` };
    }

    if (pack.status === 'Conditioning' && lastEvent && packProfile) {
        const currentStepIndex = packProfile.steps.findIndex(step => step.chamber === lastEvent.chamberType);

        if (currentStepIndex !== -1) {
            const currentStep = packProfile.steps[currentStepIndex];
            if (isTimeUp(currentStep.hours)) {
                const elapsedMessage = getTimeElapsedMessage();
                const nextStepIndex = currentStepIndex + 1;
                if (nextStepIndex < packProfile.steps.length) {
                    const nextStep = packProfile.steps[nextStepIndex];
                    return { needsAction: true, message: `Mover de ${currentStep.chamber} a ${nextStep.chamber}${elapsedMessage}.` };
                } else {
                    return { needsAction: true, message: `Finalizar y marcar como "RTU"${elapsedMessage}.` };
                }
            }
        }
    }

    return { needsAction: false, message: `No requiere acción inmediata.` };
};
