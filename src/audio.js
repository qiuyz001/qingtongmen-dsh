import * as Tone from 'tone';

/**
 * All sound is synthesised in the browser. No external audio assets.
 * The graph is only started from a user gesture (sound toggle).
 */
export class AudioEngine {
  constructor() {
    this.started = false;
    this.enabled = false;
    this.built = false;
  }

  async toggle() {
    if (!this.started) {
      await Tone.start();
      this.build();
      this.started = true;
      this.enabled = true;
    } else {
      this.enabled = !this.enabled;
    }
    Tone.getDestination().mute = !this.enabled;
    if (this.enabled) this.setScene(this.scene || 3);
    return this.enabled;
  }

  build() {
    if (this.built) return;
    this.built = true;
    const master = new Tone.Gain(0.85).toDestination();
    this.master = master;
    this.reverb = new Tone.Reverb({ decay: 7.5, preDelay: 0.05, wet: 0.55 }).connect(master);
    this.verbSend = new Tone.Gain(0.7).connect(this.reverb);

    // wind — brown noise through a slowly breathing lowpass
    this.windFilter = new Tone.Filter(520, 'lowpass', -12).connect(master);
    this.windGain = new Tone.Gain(0.1).connect(this.windFilter);
    this.wind = new Tone.Noise('brown').start();
    this.wind.connect(this.windGain);
    this.windLfo = new Tone.LFO(0.06, 240, 1050).start();
    this.windLfo.connect(this.windFilter.frequency);
    this.windGainLfo = new Tone.LFO(0.033, 0.035, 0.085).start();
    this.windGainLfo.connect(this.windGain.gain);

    // sub-bass rumble of the rift
    this.rumbleGain = new Tone.Gain(0.024).connect(master);
    this.rumble = new Tone.Oscillator(31, 'sine').start();
    this.rumble.connect(this.rumbleGain);
    this.rumble2 = new Tone.Oscillator(46.5, 'triangle').start();
    this.rumble2Gain = new Tone.Gain(0.008).connect(master);
    this.rumble2.connect(this.rumble2Gain);

    // deer-horn call: saw + formant filter + long reverb
    this.hornFilter = new Tone.Filter({ type: 'bandpass', frequency: 420, Q: 2.4 }).connect(this.verbSend);
    this.hornGain = new Tone.Gain(0.16).connect(this.hornFilter);
    this.horn = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 1.4, decay: 0.5, sustain: 0.72, release: 3.8 },
      volume: -10,
    }).connect(this.hornGain);
    this.horn2 = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 2.2, decay: 1, sustain: 0.6, release: 4.5 },
      volume: -17,
    }).connect(this.hornGain);
    this.hornDetune = new Tone.LFO(0.11, -14, 14).start();
    this.hornDetune.connect(this.horn.detune);

    // close thud / skin crack / door rumble voices
    this.noiseBurst = new Tone.Noise('pink');
    this.noiseBurstGain = new Tone.Gain(0).connect(master);
    this.noiseBurstFilter = new Tone.Filter(600, 'lowpass').connect(this.noiseBurstGain);
    this.noiseBurst.connect(this.noiseBurstFilter);
    this.noiseBurst.start();
    this.metal = new Tone.MetalSynth({
      frequency: 110, envelope: { attack: 0.002, decay: 0.9, release: 0.3 },
      harmonicity: 3.2, modulationIndex: 18, resonance: 2400, octaves: 1.2, volume: -26,
    }).connect(this.verbSend);
  }

  setScene(node) {
    this.scene = node;
    if (!this.built || !this.enabled) return;
    const valley = node === 1;
    const crevice = node === 2;
    this.windGain.gain.rampTo(valley ? 0.13 : crevice ? 0.045 : 0.028, 2.5);
    this.windFilter.frequency.rampTo(valley ? 760 : crevice ? 380 : 300, 2.5);
    this.rumbleGain.gain.rampTo(node >= 3 ? 0.026 : 0.01, 3);
    this.hornGain.gain.rampTo(node === 6 ? 0.2 : 0.0001, 2);
  }

  hornCall() {
    if (!this.started || !this.enabled) return;
    this.hornGain.gain.rampTo(0.2, 1.0);
    const t = Tone.now();
    const notes = [['D2', 0, 4.2], ['A1', 3.0, 4.8], ['D2', 7.2, 5.5]];
    for (const [n, at, dur] of notes) {
      this.horn.triggerAttackRelease(n, dur, t + at, 0.7);
      this.horn2.triggerAttackRelease(n, dur, t + at + 0.05, 0.45);
    }
  }

  doorRumble(open = true) {
    if (!this.started || !this.enabled) return;
    const t = Tone.now();
    this.noiseBurstGain.gain.cancelScheduledValues(t);
    this.noiseBurstGain.gain.setValueAtTime(0.0001, t);
    this.noiseBurstGain.gain.exponentialRampToValueAtTime(0.16, t + 0.4);
    this.noiseBurstGain.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    this.noiseBurstFilter.frequency.cancelScheduledValues(t);
    this.noiseBurstFilter.frequency.setValueAtTime(open ? 260 : 420, t);
    this.noiseBurstFilter.frequency.exponentialRampToValueAtTime(open ? 900 : 140, t + 3.4);
    this.metal.triggerAttackRelease(78, 1.6, t + 0.1, 0.35);
    this.rumble.frequency.cancelScheduledValues(t);
    this.rumble.frequency.setValueAtTime(46, t);
    this.rumble.frequency.exponentialRampToValueAtTime(open ? 30 : 27, t + 4);
  }

  impact() {
    if (!this.started || !this.enabled) return;
    const t = Tone.now();
    this.noiseBurstGain.gain.cancelScheduledValues(t);
    this.noiseBurstGain.gain.setValueAtTime(0.0001, t);
    this.noiseBurstGain.gain.exponentialRampToValueAtTime(0.32, t + 0.06);
    this.noiseBurstGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    this.noiseBurstFilter.frequency.setValueAtTime(1400, t);
    this.noiseBurstFilter.frequency.exponentialRampToValueAtTime(110, t + 1.8);
    this.metal.triggerAttackRelease(48, 2.2, t, 0.6);
  }

  crack() {
    if (!this.started || !this.enabled) return;
    const t = Tone.now();
    const g = new Tone.Gain(0.18).connect(this.verbSend);
    const n = new Tone.Noise('white').connect(g);
    n.start(t).stop(t + 0.5);
    const f = new Tone.Filter(3200, 'highpass').connect(g);
    n.connect(f);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  }
}
