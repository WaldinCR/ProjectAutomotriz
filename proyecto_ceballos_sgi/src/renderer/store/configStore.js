// Configuración de la empresa (nombre, RNC, ITBIS, NCF, impresora).
// Se carga una vez por sesión y se refresca al guardarla en Admin.
import { create } from 'zustand';
import { obtenerConfig } from '../services/configService';

export const useConfigStore = create((set, get) => ({
  config: null,
  cargar: async (forzar = false) => {
    if (get().config && !forzar) return get().config;
    const config = await obtenerConfig();
    set({ config });
    return config;
  },
  establecer: (config) => set({ config }),
}));
