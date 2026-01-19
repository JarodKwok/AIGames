
export class AudioEngine {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number) {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playMiss() {
    this.playTone(150, 'sine', 0.2, 0.2);
  }

  playHit() {
    this.playTone(600, 'square', 0.15, 0.1);
  }

  playKill() {
    this.init();
    if (!this.ctx) return;
    
    // Multi-stage explosion sound
    this.playTone(800, 'sawtooth', 0.4, 0.2);
    setTimeout(() => this.playTone(400, 'sawtooth', 0.3, 0.15), 100);
    setTimeout(() => this.playTone(200, 'sine', 0.5, 0.3), 200);
  }
}

export const audio = new AudioEngine();
