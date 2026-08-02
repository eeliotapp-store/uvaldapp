import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  cn,
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  detectShiftType,
  getShiftTypeLabel,
  getLocalDate,
} from './utils';

afterEach(() => {
  vi.useRealTimers();
});

describe('cn', () => {
  it('combina clases y resuelve conflictos de Tailwind (la última gana)', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('ignora valores falsy (útil para clases condicionales)', () => {
    expect(cn('base', false && 'oculto', undefined, 'activo')).toBe('base activo');
  });
});

describe('formatCurrency', () => {
  it('formatea con separador de miles y sin decimales (estilo COP)', () => {
    expect(formatCurrency(182400)).toContain('182.400');
    expect(formatCurrency(182400)).not.toContain(',');
  });

  it('no muestra decimales aunque el monto los tenga', () => {
    expect(formatCurrency(538100.4)).toContain('538.100');
  });

  it('formatea 0 sin explotar', () => {
    expect(formatCurrency(0)).toContain('0');
  });

  it('formatea montos grandes (millones) correctamente', () => {
    expect(formatCurrency(20690300)).toContain('20.690.300');
  });
});

describe('formatDate', () => {
  it('formatea como DD/MM/YYYY', () => {
    expect(formatDate('2026-07-18T12:00:00')).toBe('18/07/2026');
  });

  it('acepta un objeto Date además de un string', () => {
    expect(formatDate(new Date('2026-01-05T12:00:00'))).toBe('05/01/2026');
  });
});

describe('formatTime', () => {
  it('incluye la hora y minuto', () => {
    expect(formatTime('2026-07-18T14:05:00')).toContain('02:05');
  });
});

describe('formatDateTime', () => {
  it('combina fecha y hora separadas por un espacio', () => {
    const result = formatDateTime('2026-07-18T14:05:00');
    expect(result.startsWith('18/07/2026 ')).toBe(true);
    expect(result).toContain('02:05');
  });
});

describe('detectShiftType', () => {
  it('devuelve "day" a las 6:00am exacto (límite inferior)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T06:00:00'));
    expect(detectShiftType()).toBe('day');
  });

  it('devuelve "day" a las 5:59pm (límite superior, todavía día)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T17:59:00'));
    expect(detectShiftType()).toBe('day');
  });

  it('devuelve "night" a las 5:59am (justo antes del corte)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T05:59:00'));
    expect(detectShiftType()).toBe('night');
  });

  it('devuelve "night" a las 6:00pm exacto (justo en el corte de la noche)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T18:00:00'));
    expect(detectShiftType()).toBe('night');
  });

  it('devuelve "night" a medianoche', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T00:00:00'));
    expect(detectShiftType()).toBe('night');
  });
});

describe('getShiftTypeLabel', () => {
  it('traduce day/night a Día/Noche', () => {
    expect(getShiftTypeLabel('day')).toBe('Día');
    expect(getShiftTypeLabel('night')).toBe('Noche');
  });
});

describe('getLocalDate', () => {
  it('devuelve la fecha local en formato YYYY-MM-DD', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 5)); // meses en JS son 0-indexados: 6 = julio
    expect(getLocalDate()).toBe('2026-07-05');
  });

  it('rellena con cero mes y día de un solo dígito', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 9)); // enero 9
    expect(getLocalDate()).toBe('2026-01-09');
  });
});
