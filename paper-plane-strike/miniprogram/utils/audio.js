const AUDIO_FILES = {
  bgm: "/assets/audio/bgm.mp3",
  tap: "/assets/audio/tap.mp3",
  deploy: "/assets/audio/deploy.mp3",
  confirm: "/assets/audio/confirm.mp3",
  miss: "/assets/audio/miss.mp3",
  hit: "/assets/audio/hit.mp3",
  kill: "/assets/audio/kill.mp3",
  victory: "/assets/audio/victory.mp3",
  defeat: "/assets/audio/defeat.mp3",
  resultVictory: "/assets/audio/result-victory.mp3",
  resultDefeat: "/assets/audio/result-defeat.mp3"
};

class MiniAudio {
  constructor() {
    this.bgm = null;
    this.resultMusic = null;
    this.started = false;
    this.enabled = true;
  }

  canUseAudio() {
    return typeof wx !== "undefined" && typeof wx.createInnerAudioContext === "function";
  }

  configure() {
    if (!this.canUseAudio() || typeof wx.setInnerAudioOption !== "function") return;
    wx.setInnerAudioOption({
      obeyMuteSwitch: false,
      mixWithOther: true
    });
  }

  ensureBgm() {
    if (!this.canUseAudio()) return null;
    if (!this.bgm) {
      this.configure();
      this.bgm = wx.createInnerAudioContext();
      this.bgm.src = AUDIO_FILES.bgm;
      this.bgm.loop = true;
      this.bgm.volume = 0.32;
      this.bgm.obeyMuteSwitch = false;
    }
    return this.bgm;
  }

  startBgm() {
    if (!this.enabled) return;
    this.stopResultMusic();
    const bgm = this.ensureBgm();
    if (!bgm) return;

    try {
      bgm.play();
      this.started = true;
    } catch (error) {
      this.started = false;
    }
  }

  pauseBgm() {
    if (!this.bgm) return;
    try {
      this.bgm.pause();
    } catch (error) {
      // Ignore platform audio state errors.
    }
  }

  stopBgm() {
    if (!this.bgm) return;
    try {
      this.bgm.stop();
    } catch (error) {
      try {
        this.bgm.pause();
        this.bgm.seek(0);
      } catch (innerError) {
        // Ignore platform audio state errors.
      }
    }
    this.started = false;
  }

  stopResultMusic() {
    if (!this.resultMusic) return;
    try {
      this.resultMusic.destroy();
    } catch (error) {
      // Ignore platform audio state errors.
    }
    this.resultMusic = null;
  }

  playResult(winner) {
    if (!this.enabled || !this.canUseAudio()) return;
    this.configure();
    this.stopBgm();
    this.stopResultMusic();

    const resultMusic = wx.createInnerAudioContext();
    resultMusic.src = winner === "PLAYER" ? AUDIO_FILES.resultVictory : AUDIO_FILES.resultDefeat;
    resultMusic.volume = 0.58;
    resultMusic.obeyMuteSwitch = false;
    this.resultMusic = resultMusic;

    const cleanup = () => {
      if (this.resultMusic === resultMusic) this.resultMusic = null;
      try {
        resultMusic.destroy();
      } catch (error) {
        // Ignore platform audio state errors.
      }
    };

    if (typeof resultMusic.onEnded === "function") resultMusic.onEnded(cleanup);
    if (typeof resultMusic.onError === "function") resultMusic.onError(cleanup);

    try {
      resultMusic.play();
    } catch (error) {
      cleanup();
    }
  }

  destroy() {
    this.stopResultMusic();
    if (!this.bgm) return;
    try {
      this.bgm.destroy();
    } catch (error) {
      // Ignore platform audio state errors.
    }
    this.bgm = null;
    this.started = false;
  }

  play(name) {
    if (!this.enabled || !this.canUseAudio()) return;
    const src = AUDIO_FILES[name] || AUDIO_FILES.tap;
    this.configure();

    const effect = wx.createInnerAudioContext();
    effect.src = src;
    effect.volume = name === "kill" ? 0.72 : 0.62;
    effect.obeyMuteSwitch = false;

    const cleanup = () => {
      try {
        effect.destroy();
      } catch (error) {
        // Ignore platform audio state errors.
      }
    };

    if (typeof effect.onEnded === "function") effect.onEnded(cleanup);
    if (typeof effect.onError === "function") effect.onError(cleanup);

    try {
      effect.play();
    } catch (error) {
      cleanup();
    }
  }
}

module.exports = new MiniAudio();
