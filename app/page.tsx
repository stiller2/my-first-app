"use client";

import {
  type CSSProperties,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type Mode = "drift" | "bloom" | "echo";
type Visitor = "rocket" | "alien";

type Signal = {
  id: number;
  x: number;
  y: number;
  mode: Mode;
};

type AmbientVoice = {
  stop: () => void;
};

type AudioBus = {
  input: DynamicsCompressorNode;
  volume: GainNode;
};

const modes: { id: Mode; label: string; note: string; detail: string }[] = [
  {
    id: "drift",
    label: "Drift",
    note: "brown noise / falling tones",
    detail: "Slow rings, warm brown noise, and low descending chimes.",
  },
  {
    id: "bloom",
    label: "Bloom",
    note: "pink noise / soft chords",
    detail: "Opening petals, breathing pink noise, and gentle major chords.",
  },
  {
    id: "echo",
    label: "Echo",
    note: "air noise / distant repeats",
    detail: "Broken geometry, filtered air, and small sounds that repeat away.",
  },
];

const modeFrequency: Record<Mode, number> = {
  drift: 196,
  bloom: 261.6,
  echo: 329.6,
};

function createNoiseBuffer(context: AudioContext, mode: Mode, duration = 4) {
  const buffer = context.createBuffer(
    1,
    context.sampleRate * duration,
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  let brown = 0;
  let pinkA = 0;
  let pinkB = 0;
  let pinkC = 0;

  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;

    if (mode === "drift") {
      brown = (brown + 0.018 * white) / 1.018;
      data[index] = brown * 3.1;
    } else if (mode === "bloom") {
      pinkA = 0.99765 * pinkA + white * 0.099046;
      pinkB = 0.963 * pinkB + white * 0.296516;
      pinkC = 0.57 * pinkC + white * 1.052691;
      data[index] = (pinkA + pinkB + pinkC + white * 0.1848) * 0.12;
    } else {
      data[index] = white * 0.42;
    }
  }

  return buffer;
}

function startAmbient(
  context: AudioContext,
  mode: Mode,
  output: AudioNode,
): AmbientVoice {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const master = context.createGain();
  const lfo = context.createOscillator();
  const lfoDepth = context.createGain();
  const now = context.currentTime;
  const targetGain = mode === "echo" ? 0.062 : mode === "bloom" ? 0.078 : 0.092;

  source.buffer = createNoiseBuffer(context, mode);
  source.loop = true;
  filter.type = mode === "echo" ? "bandpass" : "lowpass";
  filter.frequency.value = mode === "drift" ? 620 : mode === "bloom" ? 1050 : 1850;
  filter.Q.value = mode === "echo" ? 0.8 : 0.35;

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(targetGain, now + 1.4);
  lfo.frequency.value = mode === "bloom" ? 0.075 : mode === "drift" ? 0.045 : 0.11;
  lfoDepth.gain.value = targetGain * (mode === "bloom" ? 0.34 : 0.18);

  source.connect(filter);
  filter.connect(master);
  lfo.connect(lfoDepth);
  lfoDepth.connect(master.gain);

  if (mode === "echo") {
    const delay = context.createDelay(1);
    const feedback = context.createGain();
    delay.delayTime.value = 0.36;
    feedback.gain.value = 0.18;
    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(master);
  }

  master.connect(output);
  source.start(now);
  lfo.start(now);

  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      const stopAt = context.currentTime + 0.7;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), context.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, stopAt);
      source.stop(stopAt + 0.05);
      lfo.stop(stopAt + 0.05);
    },
  };
}

function playInteractionSound(
  context: AudioContext,
  mode: Mode,
  output: AudioNode,
  variation = 0,
) {
  const now = context.currentTime;
  const texture = context.createBufferSource();
  const textureFilter = context.createBiquadFilter();
  const textureGain = context.createGain();
  const textureLength = mode === "echo" ? 0.18 : 0.42;

  texture.buffer = createNoiseBuffer(context, mode, textureLength);
  textureFilter.type = mode === "drift" ? "lowpass" : mode === "bloom" ? "bandpass" : "highpass";
  textureFilter.frequency.value = mode === "drift" ? 480 : mode === "bloom" ? 1350 : 2600;
  textureFilter.Q.value = mode === "bloom" ? 1.4 : 0.7;
  textureGain.gain.setValueAtTime(0.0001, now);
  textureGain.gain.exponentialRampToValueAtTime(mode === "echo" ? 0.072 : 0.058, now + 0.012);
  textureGain.gain.exponentialRampToValueAtTime(0.0001, now + textureLength);
  texture.connect(textureFilter);
  textureFilter.connect(textureGain);
  textureGain.connect(output);
  texture.start(now);
  texture.stop(now + textureLength + 0.02);

  const frequencies =
    mode === "bloom"
      ? [1, 1.25, 1.5]
      : mode === "echo"
        ? [1, 2]
        : [1];

  frequencies.forEach((ratio, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const base = modeFrequency[mode] * Math.pow(2, (variation % 5) / 12);
    const startAt = now + (mode === "bloom" ? index * 0.035 : 0);
    const duration = mode === "drift" ? 1.35 : mode === "bloom" ? 1.7 : 0.56;

    oscillator.type = mode === "echo" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(base * ratio, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(
      base * ratio * (mode === "drift" ? 0.72 : mode === "bloom" ? 1.08 : 0.92),
      startAt + duration,
    );
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(
      mode === "bloom" ? 0.044 : mode === "echo" ? 0.082 : 0.12,
      startAt + 0.025,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);

    if (mode === "echo") {
      const delay = context.createDelay(1);
      const feedback = context.createGain();
      delay.delayTime.value = 0.2 + index * 0.08;
      feedback.gain.value = 0.28;
      gain.connect(output);
      gain.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(output);
    } else {
      gain.connect(output);
    }

    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  });
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("drift");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isConstellating, setIsConstellating] = useState(false);
  const [signalCount, setSignalCount] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [volume, setVolume] = useState(0.82);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const nextId = useRef(1);
  const audioContext = useRef<AudioContext | null>(null);
  const audioBus = useRef<AudioBus | null>(null);
  const ambientVoice = useRef<AmbientVoice | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach(window.clearTimeout);
      ambientVoice.current?.stop();
      void audioContext.current?.close();
    };
  }, []);

  useEffect(() => {
    let arrivalTimer = 0;
    let departureTimer = 0;
    let cancelled = false;
    let nextVisitor: Visitor = "rocket";

    const scheduleVisit = (delay: number) => {
      arrivalTimer = window.setTimeout(() => {
        if (cancelled) return;
        const arrivingVisitor = nextVisitor;
        const visitLength = arrivingVisitor === "rocket" ? 8200 : 10400;
        setVisitor(arrivingVisitor);

        departureTimer = window.setTimeout(() => {
          if (cancelled) return;
          setVisitor(null);
          nextVisitor = arrivingVisitor === "rocket" ? "alien" : "rocket";
          const quietInterval =
            nextVisitor === "alien"
              ? 13000 + Math.random() * 9000
              : 19000 + Math.random() * 14000;
          scheduleVisit(quietInterval);
        }, visitLength);
      }, delay);
    };

    scheduleVisit(5500 + Math.random() * 3500);

    return () => {
      cancelled = true;
      window.clearTimeout(arrivalTimer);
      window.clearTimeout(departureTimer);
    };
  }, []);

  useEffect(() => {
    const context = audioContext.current;
    ambientVoice.current?.stop();
    ambientVoice.current = null;

    if (soundOn && context && audioBus.current) {
      const nextVoice = startAmbient(context, mode, audioBus.current.input);
      ambientVoice.current = nextVoice;
    }
  }, [mode, soundOn]);

  useEffect(() => {
    const bus = audioBus.current;
    const context = audioContext.current;
    if (!bus || !context) return;

    const now = context.currentTime;
    bus.volume.gain.cancelScheduledValues(now);
    bus.volume.gain.setTargetAtTime(soundOn ? Math.max(volume, 0.0001) : 0.0001, now, 0.045);
  }, [soundOn, volume]);

  async function ensureAudio(initialVolume = volume) {
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) {
        setAudioBlocked(true);
        return null;
      }

      const context = audioContext.current ?? new AudioContextClass();
      audioContext.current = context;

      if (!audioBus.current) {
        const limiter = context.createDynamicsCompressor();
        const volumeControl = context.createGain();
        limiter.threshold.value = -18;
        limiter.knee.value = 18;
        limiter.ratio.value = 8;
        limiter.attack.value = 0.005;
        limiter.release.value = 0.24;
        volumeControl.gain.value = Math.max(initialVolume, 0.0001);
        limiter.connect(volumeControl);
        volumeControl.connect(context.destination);
        audioBus.current = { input: limiter, volume: volumeControl };
      }

      if (context.state !== "running") {
        await context.resume();
      }

      if (context.state !== "running") {
        setAudioBlocked(true);
        return null;
      }

      setAudioBlocked(false);
      setSoundOn(true);
      return context;
    } catch {
      setAudioBlocked(true);
      setSoundOn(false);
      return null;
    }
  }

  function emitSignal(
    x: number,
    y: number,
    signalMode: Mode = mode,
    variation = 0,
    contextOverride?: AudioContext,
  ) {
    const id = nextId.current++;
    setIsActive(true);
    setSignalCount((count) => count + 1);
    setSignals((current) => [...current, { id, x, y, mode: signalMode }]);

    const context = contextOverride ?? (soundOn ? audioContext.current : null);
    if (context?.state === "running" && audioBus.current) {
      playInteractionSound(context, signalMode, audioBus.current.input, variation);
    }

    const timer = window.setTimeout(() => {
      setSignals((current) => current.filter((signal) => signal.id !== id));
    }, 4200);
    timers.current.push(timer);
  }

  async function handleFieldPointer(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const context = await ensureAudio();
    emitSignal(
      ((event.clientX - bounds.left) / bounds.width) * 100,
      ((event.clientY - bounds.top) / bounds.height) * 100,
      mode,
      signalCount,
      context ?? undefined,
    );
  }

  async function handleSoundToggle() {
    if (soundOn) {
      setSoundOn(false);
      return;
    }

    const context = await ensureAudio();
    if (context && audioBus.current) {
      playInteractionSound(context, mode, audioBus.current.input, signalCount);
    }
  }

  async function handleVolumeChange(nextVolume: number) {
    setVolume(nextVolume);
    if (!soundOn) await ensureAudio(nextVolume);
  }

  async function launchConstellation() {
    if (isConstellating) return;
    const activeMode = mode;
    const context = await ensureAudio();
    const patterns: Record<Mode, [number, number][]> = {
      drift: [[18, 66], [28, 57], [39, 49], [51, 43], [63, 39], [74, 42], [82, 51]],
      bloom: [[50, 49], [50, 29], [69, 39], [71, 62], [50, 72], [29, 62], [31, 39], [50, 49]],
      echo: [[21, 31], [34, 40], [48, 49], [62, 58], [76, 67], [62, 40], [48, 31], [34, 58], [21, 67]],
    };

    setIsConstellating(true);
    patterns[activeMode].forEach(([x, y], index) => {
      const timer = window.setTimeout(
        () => emitSignal(x, y, activeMode, index, context ?? undefined),
        index * 135,
      );
      timers.current.push(timer);
    });

    const finishTimer = window.setTimeout(
      () => setIsConstellating(false),
      patterns[activeMode].length * 135 + 900,
    );
    timers.current.push(finishTimer);
  }

  function resetField() {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setSignals([]);
    setSignalCount(0);
    setIsActive(false);
    setIsConstellating(false);
  }

  const currentMode = modes.find((item) => item.id === mode)!;

  return (
    <main className={`shell theme-${mode}`}>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Drift, back to top">
          <span className="brand-mark" aria-hidden="true" />
          DRIFT
        </a>
        <p className="edition">Guhan&apos;s white noise website · No. 001</p>
        <div className="volume-control">
          <button
            className="speaker-button"
            type="button"
            onClick={() => void handleSoundToggle()}
            aria-label={soundOn ? "Mute sound" : "Turn sound on"}
          >
            <span
              className={`speaker-icon ${!soundOn || volume === 0 ? "is-muted" : ""}`}
              aria-hidden="true"
            >
              <i />
            </span>
          </button>
          <input
            className="volume-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(volume * 100)}
            onChange={(event) => void handleVolumeChange(Number(event.target.value) / 100)}
            aria-label="Sound volume"
          />
          <output className="volume-readout" aria-live="polite">
            {audioBlocked ? "Blocked" : soundOn ? `${Math.round(volume * 100)}%` : "Off"}
          </output>
        </div>
      </header>

      <section className="experience" id="top">
        <div className="intro">
          <p className="eyebrow">An instrument for idle hands</p>
          <h1>
            Make a little
            <span>noise.</span>
          </h1>
          <p className="lede">
            A quiet corner of the internet that responds to your touch. No
            score. No objective. Just leave a signal and watch it drift.
          </p>
          <button
            className={`enter-button constellation-button ${isConstellating ? "is-casting" : ""}`}
            type="button"
            onClick={() => void launchConstellation()}
            disabled={isConstellating}
          >
            <span>{isConstellating ? "Drawing the sky…" : "Release a constellation"}</span>
            <span className="constellation-mark" aria-hidden="true">
              <i /><i /><i />
            </span>
          </button>
          <div className="intro-meta">
            <span>Sound starts on first touch</span>
            <span>Every mode sounds different</span>
          </div>
        </div>

        <div
          className={`signal-field ${isActive ? "is-active" : ""} ${isConstellating ? "is-constellating" : ""} ${visitor ? "has-visitor" : ""}`}
          onPointerDown={(event) => void handleFieldPointer(event)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              void ensureAudio().then((context) =>
                emitSignal(50, 50, mode, signalCount, context ?? undefined),
              );
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Interactive signal field. Click, tap, or press Enter to add a signal."
        >
          <div className="field-grid" aria-hidden="true" />
          <div className="ambient ambient-one" aria-hidden="true" />
          <div className="ambient ambient-two" aria-hidden="true" />
          <div className="star-glints" aria-hidden="true">
            <i /><i /><i /><i />
          </div>

          {visitor === "rocket" && (
            <div className="space-visitor rocket-visitor" aria-hidden="true">
              <span className="rocket-wake" />
              <span className="rocket-flame" />
              <span className="rocket-body"><i /></span>
              <span className="rocket-fin" />
            </div>
          )}

          {visitor === "alien" && (
            <div className="space-visitor alien-visitor" aria-hidden="true">
              <span className="alien-beam" />
              <span className="alien-dome"><i /><i /></span>
              <span className="alien-hull"><i /><i /><i /></span>
            </div>
          )}

          <div className="core" aria-hidden="true">
            <span className="core-dot" />
            <span className="orbit orbit-one"><i /></span>
            <span className="orbit orbit-two"><i /></span>
            <span className="orbit orbit-three"><i /></span>
            <span className="axis axis-x" />
            <span className="axis axis-y" />
          </div>

          {signals.map((signal) => (
            <span
              className={`user-signal signal-${signal.mode}`}
              key={signal.id}
              style={{ "--x": `${signal.x}%`, "--y": `${signal.y}%` } as CSSProperties}
              aria-hidden="true"
            >
              <i />
            </span>
          ))}

          <p className="field-coordinate" aria-live="polite">
            {visitor === "rocket"
              ? "Local transit · RV—01"
              : visitor === "alien"
                ? "Unidentified visitor · seems friendly"
                : "34° 03′ N   /   118° 15′ W"}
          </p>
          <p className="field-hint">
            <span aria-hidden="true">↖</span> Click anywhere to leave a signal
          </p>

          <div className="field-controls" onPointerDown={(event) => event.stopPropagation()}>
            <div className="mode-picker" aria-label="Signal mode">
              {modes.map((item) => (
                <button
                  key={item.id}
                  className={mode === item.id ? "selected" : ""}
                  type="button"
                  onClick={() => setMode(item.id)}
                  aria-pressed={mode === item.id}
                  title={item.detail}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button className="reset-button" type="button" onClick={resetField}>
              Clear field
            </button>
          </div>
        </div>
      </section>

      <footer className="statusbar">
        <p>
          <span className="status-pulse" aria-hidden="true" />
          Field {isActive ? "awake" : "resting"}
        </p>
        <p className="mode-readout">
          {currentMode.label} <span>{currentMode.note}</span>
        </p>
        <p className="signal-count">
          {String(signalCount).padStart(2, "0")} signal{signalCount === 1 ? "" : "s"}
        </p>
      </footer>
    </main>
  );
}
