/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Sintetizador Web Audio API puro para alertas sonoros no ATLASΩ Terminal
 * Sem arquivos externos, latência zero, compatível com navegadores desktop e Android.
 */

export type AlertSoundType = 'BEEP' | 'CHIME' | 'RADAR' | 'SIREN' | 'MUTED';

class SoundEffectsService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public play(type: AlertSoundType) {
    if (this.isMuted || type === 'MUTED') return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      switch (type) {
        case 'BEEP': {
          // Beep duplo tecnológico de confirmação
          this.createTone(ctx, 880, now, 0.1, 'sine');
          this.createTone(ctx, 1174.66, now + 0.12, 0.15, 'sine');
          break;
        }

        case 'CHIME': {
          // Acorde suave harmônico de sino financeiro (Major Triad)
          this.createTone(ctx, 523.25, now, 0.35, 'triangle', 0.2); // C5
          this.createTone(ctx, 659.25, now + 0.08, 0.35, 'triangle', 0.2); // E5
          this.createTone(ctx, 783.99, now + 0.16, 0.45, 'triangle', 0.25); // G5
          this.createTone(ctx, 1046.50, now + 0.24, 0.6, 'sine', 0.3); // C6
          break;
        }

        case 'RADAR': {
          // Pulso sonar com sweep ascendente
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(1760, now + 0.25);

          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.35);
          break;
        }

        case 'SIREN': {
          // Alerta crítico de limite/urgência com oscilação rápida
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.linearRampToValueAtTime(950, now + 0.15);
          osc.frequency.linearRampToValueAtTime(600, now + 0.3);
          osc.frequency.linearRampToValueAtTime(950, now + 0.45);

          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.55);
          break;
        }
      }
    } catch (e) {
      console.warn('Erro ao reproduzir efeito sonoro:', e);
    }
  }

  private createTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.25
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

export const soundEffects = new SoundEffectsService();
