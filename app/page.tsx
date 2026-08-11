"use client";

import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type Mode = "drift" | "bloom" | "echo";
type Visitor = "rocket" | "alien";
type SolarPhase = "idle" | "incoming" | "detonation" | "aftermath" | "rebirth";
type FieldFeature = "craft" | "meteors" | "eclipse";
type FocusDuration = 20 | 60;
type FlightPhase = "hyperspace" | "cruise" | "arrival";

type Signal = {
  id: number;
  x: number;
  y: number;
  mode: Mode;
};

type DeepScan = {
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

type DashboardTelemetry = {
  scanId: number;
  sector: string;
  readings: [string, string, string];
  blips: { x: number; y: number; delay: number; size: number }[];
  spectrum: { height: number; duration: number; delay: number }[];
  centerReadings: [string, string, string];
  matrixDelays: number[];
};

const modes: { id: Mode; label: string; note: string; detail: string }[] = [
  {
    id: "drift",
    label: "Drift",
    note: "brown noise / grounded calm",
    detail: "Warm brown noise and low tones for settling into the moment.",
  },
  {
    id: "bloom",
    label: "Bloom",
    note: "pink noise / open focus",
    detail: "Breathing pink noise and soft chords for clear, gentle focus.",
  },
  {
    id: "echo",
    label: "Echo",
    note: "air noise / spacious quiet",
    detail: "Filtered air and distant echoes for giving busy thoughts more room.",
  },
];

const modeFrequency: Record<Mode, number> = {
  drift: 196,
  bloom: 261.6,
  echo: 329.6,
};

const cruiseStars = [
  [-46, -38, 3.8, -0.2], [-34, -44, 4.6, -2.8], [-19, -41, 5.2, -1.1],
  [3, -46, 4.1, -3.6], [21, -42, 5.8, -0.9], [39, -36, 4.9, -4.2],
  [47, -19, 3.7, -1.9], [43, 2, 5.4, -3.1], [48, 24, 4.3, -0.6],
  [36, 39, 5.9, -2.2], [19, 44, 4.7, -4.7], [-2, 47, 5.1, -1.5],
  [-23, 42, 3.9, -3.9], [-41, 35, 5.6, -0.4], [-47, 16, 4.5, -2.5],
  [-43, -4, 5.3, -4.5], [-29, -27, 4.2, -1.3], [-12, -31, 6.1, -3.3],
  [14, -28, 4.8, -0.8], [31, -22, 5.7, -2.7], [34, 13, 4.4, -4.1],
  [24, 29, 5.5, -1.7], [4, 33, 4, -3.5], [-16, 29, 6, -0.3],
  [-33, 20, 4.6, -2.1], [-35, -14, 5.2, -4.3], [-7, -18, 3.6, -1],
  [11, -13, 4.9, -3], [20, 8, 5.4, -0.1], [-18, 10, 4.3, -2.4],
] as const;

const initialDashboardTelemetry: DashboardTelemetry = {
  scanId: 0,
  sector: "ᖶᖇ-07",
  readings: ["Θ 7.884", "Δ 03.11", "Ψ LOCK"],
  blips: [
    { x: 27, y: 61, delay: -0.2, size: 3 },
    { x: 74, y: 29, delay: -0.9, size: 3 },
    { x: 63, y: 78, delay: -1.5, size: 2 },
  ],
  spectrum: Array.from({ length: 8 }, (_, index) => ({
    height: 28 + ((index * 17) % 60),
    duration: 1.8 + (index % 4) * 0.3,
    delay: -(index * 0.31),
  })),
  centerReadings: ["42.7", "08.3", "SYNC"],
  matrixDelays: Array.from({ length: 12 }, (_, index) => -(index * 0.19)),
};

function createDashboardTelemetry(): DashboardTelemetry {
  const contactCount = 3 + Math.floor(Math.random() * 3);
  const spectrumCount = 8 + Math.floor(Math.random() * 4);
  const glyphs = ["ᖶᖇ", "⌬ᚫ", "ᒥᗝ", "ϟ⌁", "⟟ᖵ"];

  return {
    scanId: Math.floor(Math.random() * 1_000_000),
    sector: `${glyphs[Math.floor(Math.random() * glyphs.length)]}-${String(Math.floor(Math.random() * 99)).padStart(2, "0")}`,
    readings: [
      `Θ ${(Math.random() * 9 + 1).toFixed(3)}`,
      `Δ ${(Math.random() * 7).toFixed(2)}`,
      Math.random() > 0.28 ? "Ψ LOCK" : "Ψ SEEK",
    ],
    blips: Array.from({ length: contactCount }, () => ({
      x: 14 + Math.random() * 72,
      y: 14 + Math.random() * 72,
      delay: -(Math.random() * 2.4),
      size: 2 + Math.floor(Math.random() * 3),
    })),
    spectrum: Array.from({ length: spectrumCount }, () => ({
      height: 18 + Math.random() * 76,
      duration: 1.3 + Math.random() * 2.1,
      delay: -(Math.random() * 2.8),
    })),
    centerReadings: [
      (18 + Math.random() * 74).toFixed(1),
      (Math.random() * 18).toFixed(1).padStart(4, "0"),
      Math.random() > 0.22 ? "SYNC" : "CAL",
    ],
    matrixDelays: Array.from({ length: 12 }, () => -(Math.random() * 2.8)),
  };
}

function createRandomConstellation(count: number) {
  const points: [number, number][] = [];
  let attempts = 0;

  while (points.length < count && attempts < 120) {
    const candidate: [number, number] = [
      7 + Math.random() * 86,
      9 + Math.random() * 80,
    ];
    const hasRoom = points.every(([x, y]) =>
      Math.hypot(candidate[0] - x, candidate[1] - y) > 9,
    );
    if (hasRoom) points.push(candidate);
    attempts += 1;
  }

  while (points.length < count) {
    points.push([7 + Math.random() * 86, 9 + Math.random() * 80]);
  }

  return points;
}

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

function playDeepScanSound(context: AudioContext, output: AudioNode) {
  const now = context.currentTime;
  const frequencies = [432, 288, 216];

  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = now + index * 0.13;
    const duration = 2.2 + index * 0.26;

    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * (index === 2 ? 1.45 : 0.72),
      startAt + duration,
    );
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.045 / (index + 1), startAt + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.04);
  });
}

function playSolarSound(
  context: AudioContext,
  output: AudioNode,
  stage: "incoming" | "detonation",
) {
  const now = context.currentTime;

  if (stage === "incoming") {
    const whistle = context.createOscillator();
    const whistleGain = context.createGain();
    whistle.type = "triangle";
    whistle.frequency.setValueAtTime(520, now);
    whistle.frequency.exponentialRampToValueAtTime(78, now + 1.5);
    whistleGain.gain.setValueAtTime(0.0001, now);
    whistleGain.gain.exponentialRampToValueAtTime(0.024, now + 0.08);
    whistleGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);
    whistle.connect(whistleGain);
    whistleGain.connect(output);
    whistle.start(now);
    whistle.stop(now + 1.6);
    return;
  }

  const impact = context.createBufferSource();
  const impactFilter = context.createBiquadFilter();
  const impactGain = context.createGain();
  const lowTone = context.createOscillator();
  const lowGain = context.createGain();

  impact.buffer = createNoiseBuffer(context, "echo", 1.8);
  impactFilter.type = "lowpass";
  impactFilter.frequency.setValueAtTime(1100, now);
  impactFilter.frequency.exponentialRampToValueAtTime(90, now + 1.7);
  impactGain.gain.setValueAtTime(0.11, now);
  impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
  impact.connect(impactFilter);
  impactFilter.connect(impactGain);
  impactGain.connect(output);

  lowTone.type = "sine";
  lowTone.frequency.setValueAtTime(92, now);
  lowTone.frequency.exponentialRampToValueAtTime(32, now + 1.45);
  lowGain.gain.setValueAtTime(0.12, now);
  lowGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);
  lowTone.connect(lowGain);
  lowGain.connect(output);

  impact.start(now);
  impact.stop(now + 1.82);
  lowTone.start(now);
  lowTone.stop(now + 1.58);
}

function playFeatureSound(
  context: AudioContext,
  output: AudioNode,
  feature: FieldFeature,
) {
  const now = context.currentTime;

  if (feature === "craft") {
    const delay = context.createDelay(1);
    const echoGain = context.createGain();
    delay.delayTime.value = 0.34;
    echoGain.gain.value = 0.22;
    delay.connect(echoGain);
    echoGain.connect(output);

    [392, 523.25, 659.25].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = now + index * 0.3;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.036, startAt + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.25);
      oscillator.connect(gain);
      gain.connect(output);
      gain.connect(delay);
      oscillator.start(startAt);
      oscillator.stop(startAt + 1.3);
    });
    return;
  }

  if (feature === "meteors") {
    [1174.66, 987.77, 1318.51, 880, 1046.5, 1567.98].forEach(
      (frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startAt = now + index * 0.13;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startAt);
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 0.68,
          startAt + 1.05,
        );
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.022, startAt + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.1);
        oscillator.connect(gain);
        gain.connect(output);
        oscillator.start(startAt);
        oscillator.stop(startAt + 1.12);
      },
    );
    return;
  }

  [110, 164.81, 220].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.025 / (index + 1), now + 0.8);
    gain.gain.setValueAtTime(0.025 / (index + 1), now + 2.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(now);
    oscillator.stop(now + 4.55);
  });
}

function playFocusBell(context: AudioContext, output: AudioNode) {
  const now = context.currentTime;

  [523.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = now + index * 0.22;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.026, startAt + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 2.2);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(startAt);
    oscillator.stop(startAt + 2.25);
  });
}

function playHyperspaceSound(context: AudioContext, output: AudioNode) {
  const now = context.currentTime;
  const rush = context.createBufferSource();
  const rushFilter = context.createBiquadFilter();
  const rushGain = context.createGain();
  const engine = context.createOscillator();
  const engineGain = context.createGain();

  rush.buffer = createNoiseBuffer(context, "echo", 4.5);
  rushFilter.type = "bandpass";
  rushFilter.Q.value = 0.7;
  rushFilter.frequency.setValueAtTime(240, now);
  rushFilter.frequency.exponentialRampToValueAtTime(2400, now + 3.2);
  rushFilter.frequency.exponentialRampToValueAtTime(520, now + 4.45);
  rushGain.gain.setValueAtTime(0.0001, now);
  rushGain.gain.exponentialRampToValueAtTime(0.058, now + 1.1);
  rushGain.gain.setValueAtTime(0.058, now + 3.1);
  rushGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.45);
  rush.connect(rushFilter);
  rushFilter.connect(rushGain);
  rushGain.connect(output);

  engine.type = "sine";
  engine.frequency.setValueAtTime(42, now);
  engine.frequency.exponentialRampToValueAtTime(86, now + 3.4);
  engineGain.gain.setValueAtTime(0.0001, now);
  engineGain.gain.exponentialRampToValueAtTime(0.045, now + 0.65);
  engineGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.4);
  engine.connect(engineGain);
  engineGain.connect(output);

  rush.start(now);
  rush.stop(now + 4.5);
  engine.start(now);
  engine.stop(now + 4.45);
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("drift");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [deepScan, setDeepScan] = useState<DeepScan | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isConstellating, setIsConstellating] = useState(false);
  const [signalCount, setSignalCount] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [volume, setVolume] = useState(0.82);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [solarPhase, setSolarPhase] = useState<SolarPhase>("idle");
  const [activeFeature, setActiveFeature] = useState<FieldFeature | null>(null);
  const [focusDuration, setFocusDuration] = useState<FocusDuration | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [flightPhase, setFlightPhase] = useState<FlightPhase>("cruise");
  const [dashboardTelemetry, setDashboardTelemetry] = useState<DashboardTelemetry>(
    initialDashboardTelemetry,
  );
  const [fieldReadings, setFieldReadings] = useState({
    orbit: "18.2",
    relay: 4,
    signal: "CALM",
  });
  const nextId = useRef(1);
  const audioContext = useRef<AudioContext | null>(null);
  const audioBus = useRef<AudioBus | null>(null);
  const ambientVoice = useRef<AmbientVoice | null>(null);
  const timers = useRef<number[]>([]);
  const focusDeadline = useRef<number | null>(null);
  const remainingSecondsRef = useRef(0);
  const flightTimer = useRef<number | null>(null);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach(window.clearTimeout);
      if (flightTimer.current) window.clearTimeout(flightTimer.current);
      ambientVoice.current?.stop();
      void audioContext.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!focusDuration) return;

    document.body.classList.add("focus-session-open");
    return () => document.body.classList.remove("focus-session-open");
  }, [focusDuration]);

  useEffect(() => {
    if (!focusDuration || sessionPaused || remainingSecondsRef.current === 0) return;

    focusDeadline.current = Date.now() + remainingSecondsRef.current * 1000;
    const interval = window.setInterval(() => {
      const deadline = focusDeadline.current;
      if (!deadline) return;
      const nextRemaining = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1000),
      );

      remainingSecondsRef.current = nextRemaining;
      setRemainingSeconds(nextRemaining);
      if (nextRemaining === 0) {
        window.clearInterval(interval);
        setFlightPhase("arrival");
        const context = audioContext.current;
        if (context?.state === "running" && audioBus.current) {
          playFocusBell(context, audioBus.current.input);
        }
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [focusDuration, sessionPaused]);

  useEffect(() => {
    if (!focusDuration || sessionPaused) return;

    const telemetryInterval = window.setInterval(() => {
      if (remainingSecondsRef.current === 0) return;
      setDashboardTelemetry(createDashboardTelemetry());
    }, 4200);

    return () => window.clearInterval(telemetryInterval);
  }, [focusDuration, sessionPaused]);

  useEffect(() => {
    const fieldTelemetryInterval = window.setInterval(() => {
      const signalStates = ["CALM", "CLEAR", "SOFT", "OPEN"];
      setFieldReadings({
        orbit: (12 + Math.random() * 18).toFixed(1),
        relay: 1 + Math.floor(Math.random() * 8),
        signal: signalStates[Math.floor(Math.random() * signalStates.length)],
      });
    }, 5400);

    return () => window.clearInterval(fieldTelemetryInterval);
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
    if (event.detail > 1) return;
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

  function handleFieldPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (focusDuration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const lookX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const lookY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    event.currentTarget.style.setProperty("--look-x", `${(lookX * 13).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--look-y", `${(lookY * 10).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--look-far-x", `${(lookX * -5).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--look-far-y", `${(lookY * -4).toFixed(2)}px`);
  }

  function resetFieldParallax(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--look-x", "0px");
    event.currentTarget.style.setProperty("--look-y", "0px");
    event.currentTarget.style.setProperty("--look-far-x", "0px");
    event.currentTarget.style.setProperty("--look-far-y", "0px");
  }

  async function handleFieldDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, input") || focusDuration) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const id = nextId.current++;
    const scan = {
      id,
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
      mode,
    };

    setDeepScan(scan);
    const context = await ensureAudio();
    if (context?.state === "running" && audioBus.current) {
      playDeepScanSound(context, audioBus.current.input);
    }

    const timer = window.setTimeout(() => {
      setDeepScan((current) => current?.id === id ? null : current);
    }, 5200);
    timers.current.push(timer);
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
    const constellation = createRandomConstellation(8 + Math.floor(Math.random() * 5));

    setIsConstellating(true);
    constellation.forEach(([x, y], index) => {
      const timer = window.setTimeout(
        () => emitSignal(x, y, activeMode, index, context ?? undefined),
        index * (90 + Math.random() * 95),
      );
      timers.current.push(timer);
    });

    const finishTimer = window.setTimeout(
      () => setIsConstellating(false),
      constellation.length * 185 + 700,
    );
    timers.current.push(finishTimer);
  }

  async function nukeSun() {
    if (solarPhase !== "idle" || activeFeature) return;
    const context = await ensureAudio();
    const output = audioBus.current?.input;

    setSolarPhase("incoming");
    if (context && output) playSolarSound(context, output, "incoming");

    const detonationTimer = window.setTimeout(() => {
      setSolarPhase("detonation");
      if (context && output) playSolarSound(context, output, "detonation");
    }, 1550);
    const aftermathTimer = window.setTimeout(
      () => setSolarPhase("aftermath"),
      3750,
    );
    const rebirthTimer = window.setTimeout(
      () => setSolarPhase("rebirth"),
      5350,
    );
    const resetTimer = window.setTimeout(
      () => setSolarPhase("idle"),
      6900,
    );
    timers.current.push(
      detonationTimer,
      aftermathTimer,
      rebirthTimer,
      resetTimer,
    );
  }

  async function triggerFeature(feature: FieldFeature) {
    if (activeFeature || solarPhase !== "idle") return;
    const context = await ensureAudio();
    const duration: Record<FieldFeature, number> = {
      craft: 9000,
      meteors: 5200,
      eclipse: 7200,
    };

    if (context && audioBus.current) {
      playFeatureSound(context, audioBus.current.input, feature);
    }

    setActiveFeature(feature);
    const featureTimer = window.setTimeout(
      () => setActiveFeature(null),
      duration[feature],
    );
    timers.current.push(featureTimer);
  }

  async function startFocusSession(duration: FocusDuration) {
    const context = await ensureAudio();
    if (context && audioBus.current) {
      playHyperspaceSound(context, audioBus.current.input);
    }
    setFlightPhase("hyperspace");
    setDashboardTelemetry(createDashboardTelemetry());
    setFocusDuration(duration);
    setRemainingSeconds(duration * 60);
    remainingSecondsRef.current = duration * 60;
    setSessionPaused(false);
    setActiveFeature(null);
    setSolarPhase("idle");

    if (flightTimer.current) window.clearTimeout(flightTimer.current);
    flightTimer.current = window.setTimeout(() => {
      setFlightPhase("cruise");
      flightTimer.current = null;
    }, 4600);
  }

  function endFocusSession() {
    setFocusDuration(null);
    setRemainingSeconds(0);
    remainingSecondsRef.current = 0;
    setSessionPaused(false);
    setFlightPhase("cruise");
    if (flightTimer.current) window.clearTimeout(flightTimer.current);
    flightTimer.current = null;
    focusDeadline.current = null;
  }

  function toggleSessionPause() {
    if (remainingSeconds === 0) return;
    setSessionPaused((paused) => !paused);
  }

  const currentMode = modes.find((item) => item.id === mode)!;
  const solarStatus: Record<SolarPhase, string> = {
    idle: "Nuke sun",
    incoming: "Incoming…",
    detonation: "Detonated",
    aftermath: "Sun offline",
    rebirth: "Reforming…",
  };
  const focusTime = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;
  const focusProgress = focusDuration
    ? Math.min(
        100,
        Math.max(
          0,
          ((focusDuration * 60 - remainingSeconds) / (focusDuration * 60)) *
            100,
        ),
      )
    : 0;
  const focusProgressPercent = Math.round(focusProgress);
  const rocketPosition = 2 + focusProgress * 0.96;

  return (
    <main
      className={`shell theme-${mode} ${focusDuration ? `is-focus-session flight-${flightPhase} ${sessionPaused ? "session-paused" : ""}` : ""}`}
    >
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Drift, back to top">
          <span className="brand-mark" aria-hidden="true" />
          DRIFT
        </a>
        <p className="edition">Guhan&apos;s white noise focus space · No. 001</p>
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
          <p className="eyebrow">Meditation and focus, in orbit</p>
          <h1>
            Make a little
            <span>space.</span>
          </h1>
          <p className="lede">
            Choose a timer. Settle into white noise. Let the stars move while
            your mind stays here.
          </p>
          <div className="focus-launcher" aria-labelledby="focus-title">
            <div>
              <p className="focus-kicker">Choose your voyage</p>
              <h2 id="focus-title">Breathe. Focus. Drift.</h2>
            </div>
            <div className="focus-options">
              <button type="button" onClick={() => void startFocusSession(20)}>
                <span>Gentle focus</span>
                <strong>20 min</strong>
              </button>
              <button type="button" onClick={() => void startFocusSession(60)}>
                <span>Deep focus</span>
                <strong>60 min</strong>
              </button>
            </div>
          </div>
          <button
            className={`enter-button constellation-button ${isConstellating ? "is-casting" : ""}`}
            type="button"
            onClick={() => void launchConstellation()}
            disabled={isConstellating}
          >
            <span>{isConstellating ? "Setting the stars…" : "Scatter a constellation"}</span>
            <span className="constellation-mark" aria-hidden="true">
              <i /><i /><i />
            </span>
          </button>
          <div className="intro-meta">
            <span>20 &amp; 60 minute focus voyages</span>
            <span>Three ways to find quiet</span>
          </div>
        </div>

        <div
          className={`signal-field ${isActive ? "is-active" : ""} ${isConstellating ? "is-constellating" : ""} ${visitor ? "has-visitor" : ""} solar-${solarPhase} feature-${activeFeature ?? "idle"}`}
          onPointerDown={(event) => void handleFieldPointer(event)}
          onPointerMove={handleFieldPointerMove}
          onPointerLeave={resetFieldParallax}
          onDoubleClick={(event) => void handleFieldDoubleClick(event)}
          onKeyDown={(event) => {
            if ((event.target as HTMLElement).closest("button, input")) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              void ensureAudio().then((context) =>
                emitSignal(50, 50, mode, signalCount, context ?? undefined),
              );
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Interactive meditation field. Click, tap, or press Enter to place a calming signal. Double-click to run a deep-space scan."
        >
          <div className="field-grid" aria-hidden="true" />
          <div className="observatory-frame" aria-hidden="true">
            <span className="station-corner station-corner-one" />
            <span className="station-corner station-corner-two" />
            <span className="station-corner station-corner-three" />
            <span className="station-corner station-corner-four" />
            <span className="station-ticks station-ticks-top" />
            <span className="station-ticks station-ticks-side" />
            <small>OBSERVATION DECK // DRIFT-01</small>
          </div>
          <div className="mode-space-weather" aria-hidden="true">
            <span /><span /><span />
          </div>
          <div className="ambient ambient-one" aria-hidden="true" />
          <div className="ambient ambient-two" aria-hidden="true" />
          {focusDuration && (
            <div className="space-flight" aria-hidden="true">
              <div className="hyperspace-tunnel">
                <i /><i /><i /><i /><i /><i /><i /><i />
                <i /><i /><i /><i /><i /><i /><i /><i />
                <i /><i /><i /><i /><i /><i /><i /><i />
                <i /><i /><i /><i /><i /><i /><i /><i />
              </div>
              <div className="cruise-starfield">
                {cruiseStars.map(([x, y, duration, delay], index) => (
                  <i
                    key={`${x}-${y}`}
                    style={
                      {
                        "--flight-x": `${x}vw`,
                        "--flight-y": `${y}vh`,
                        "--flight-duration": `${duration}s`,
                        "--flight-delay": `${delay}s`,
                        "--flight-size": `${1 + (index % 3) * 0.65}px`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
              <span className="flight-nebula" />
              <span className="flight-planet"><i /></span>
              <span className="flight-comet" />
              <div className="arrival-event">
                <span className="arrival-horizon" />
                <span className="arrival-ring arrival-ring-one" />
                <span className="arrival-ring arrival-ring-two" />
                <span className="arrival-stars"><i /><i /><i /><i /><i /></span>
              </div>
            </div>
          )}
          <div className="star-glints" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="slow-drifters" aria-hidden="true">
            <span className="drifter ringed-world"><i /></span>
            <span className="drifter crescent-world" />
            <span className="drifter far-satellite"><i /><i /></span>
            <span className="drifter dust-cloud" />
            <span className="drifter relay-satellite"><i /><i /><i /></span>
            <span className="drifter deep-comet" />
            <span className="drifter moon-pair"><i /></span>
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

          {activeFeature === "craft" && (
            <div className="deployed-craft" aria-hidden="true">
              <span className="craft-beam craft-beam-one" />
              <span className="craft-beam craft-beam-two" />
              <span className="craft-panel craft-panel-left"><i /></span>
              <span className="craft-body"><i /></span>
              <span className="craft-panel craft-panel-right"><i /></span>
            </div>
          )}

          {activeFeature === "meteors" && (
            <div className="meteor-shower" aria-hidden="true">
              <i /><i /><i /><i /><i /><i /><i />
            </div>
          )}

          {activeFeature === "eclipse" && (
            <div className="eclipse-moon" aria-hidden="true">
              <span className="eclipse-corona" />
              <span className="diamond-flare" />
              <i /><i /><i />
            </div>
          )}

          {solarPhase === "incoming" && (
            <div className="sun-missile" aria-hidden="true">
              <span className="missile-flame" />
              <span className="missile-body"><i /></span>
              <span className="missile-fins" />
            </div>
          )}

          {solarPhase === "detonation" && (
            <div className="solar-explosion" aria-hidden="true">
              <span className="explosion-flash" />
              <span className="shockwave shockwave-one" />
              <span className="shockwave shockwave-two" />
              <span className="solar-debris">
                <i /><i /><i /><i /><i /><i /><i /><i />
              </span>
            </div>
          )}

          <div className="core" aria-hidden="true">
            <span className="core-dot" />
            <span className="orbit orbit-one"><i /><i /></span>
            <span className="orbit orbit-two"><i /><i /><i /></span>
            <span className="orbit orbit-three"><i /><i /></span>
            <span className="orbit-label orbit-label-one">ORBIT A · {fieldReadings.orbit} AU</span>
            <span className="orbit-label orbit-label-two">MOON RELAY · {String(fieldReadings.relay).padStart(2, "0")}</span>
            <span className="orbit-label orbit-label-three">SIGNAL {fieldReadings.signal}</span>
            <span className="axis axis-x" />
            <span className="axis axis-y" />
          </div>

          {focusDuration && (
            <div className="cockpit-shell" aria-hidden="true">
              <div className="windshield-rim rim-left" />
              <div className="windshield-rim rim-right" />
              <div className="windshield-rim rim-bottom" />
              <div className="canopy-frame canopy-top">
                <span /><span /><span />
              </div>
              <div className="canopy-strut strut-left"><i /></div>
              <div className="canopy-strut strut-right"><i /></div>
              <div className="side-window side-window-left">
                <i /><i /><i /><i /><i />
              </div>
              <div className="side-window side-window-right">
                <i /><i /><i /><i /><i />
              </div>
              <div className="canopy-glass">
                <span className="glass-reflection reflection-one" />
                <span className="glass-reflection reflection-two" />
                <span className="glass-scratches"><i /><i /><i /><i /></span>
                <span className="glass-condensation condensation-left" />
                <span className="glass-condensation condensation-right" />
                <span className="dashboard-reflection" />
                <span className="target-reticle"><i /><i /><i /></span>
                <span className="flight-vector">VECTOR // 7.42</span>
                {remainingSeconds === 0 && (
                  <div className="arrival-message">
                    <span>Voyage complete</span>
                    <strong>You made some space.</strong>
                    <small>Take one slow breath before returning.</small>
                  </div>
                )}
              </div>
              <div className="alien-dashboard">
                <div className="dashboard-ridge">
                  <span /><span /><span /><span /><span /><span /><span />
                </div>
                <div className="auxiliary-pod pod-left">
                  <span className="mini-dial"><i /></span>
                  <span className="mini-dial"><i /></span>
                  <small>ION</small>
                </div>
                <div className="auxiliary-pod pod-right">
                  <span className="mini-slider"><i /></span>
                  <span className="mini-slider"><i /></span>
                  <span className="mini-slider"><i /></span>
                </div>
                <div className="left-flight-bank">
                  <small>AUX // 07</small>
                  <span className="bank-dial"><i /></span>
                  <span className="bank-readout">ϟ 84</span>
                  <span className="bank-bars"><i /><i /><i /><i /></span>
                  <span className="bank-switches"><i /><i /><i /></span>
                </div>
                <section className="alien-console console-left">
                  <div className="console-label">
                    {flightPhase === "arrival"
                      ? "DESTINATION · FOUND"
                      : `${dashboardTelemetry.sector} · SCAN ARRAY`}
                  </div>
                  <div className="alien-radar">
                    <span className="radar-sweep" />
                    {dashboardTelemetry.blips.map((blip, index) => (
                      <i
                        key={`${dashboardTelemetry.scanId}-blip-${index}`}
                        style={
                          {
                            left: `${blip.x}%`,
                            top: `${blip.y}%`,
                            width: `${blip.size}px`,
                            height: `${blip.size}px`,
                            animationDelay: `${blip.delay}s`,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </div>
                  <div className="glyph-strip">⌁ ⟟ ⊹ ᚫ ⌬ ᖶ ⧖</div>
                  <div className="micro-readouts">
                    {dashboardTelemetry.readings.map((reading) => (
                      <span key={reading}>{reading}</span>
                    ))}
                  </div>
                  <div className="spectral-bars">
                    {dashboardTelemetry.spectrum.map((bar, index) => (
                      <i
                        key={`${dashboardTelemetry.scanId}-spectrum-${index}`}
                        style={
                          {
                            "--spectrum-height": `${bar.height}%`,
                            animationDuration: `${bar.duration}s`,
                            animationDelay: `${bar.delay}s`,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </div>
                </section>
                <section className="alien-console console-center">
                  <div className="console-label">
                    {flightPhase === "hyperspace"
                      ? "VOID DRIVE // ENGAGED"
                      : flightPhase === "arrival"
                        ? "FOCUS VOYAGE // COMPLETE"
                        : "NAV CORE // NOMINAL"}
                  </div>
                  <div className="nav-sphere">
                    <span className="nav-orbit nav-orbit-one"><i /></span>
                    <span className="nav-orbit nav-orbit-two"><i /></span>
                    <strong>⟡</strong>
                  </div>
                  <div className="alien-command-line">ᖵᖇᗩ · ⌁⌁ · ϟ7 · ᒥᗝᒪ</div>
                  <div className="touch-keys">
                    <i /><i /><i /><i /><i /><i /><i /><i />
                  </div>
                  <div className="telemetry-stack">
                    <span><b>ᚫ</b> {dashboardTelemetry.centerReadings[0]}</span>
                    <span><b>ϟ</b> {dashboardTelemetry.centerReadings[1]}</span>
                    <span><b>⌁</b> {dashboardTelemetry.centerReadings[2]}</span>
                  </div>
                </section>
                <section className="alien-console console-right">
                  <div className="console-label">
                    {flightPhase === "arrival" ? "BIO-LINK // RESTING" : "BIO-LINK // STABLE"}
                  </div>
                  <div className="signal-wave">
                    <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
                  </div>
                  <div className="engine-gauges">
                    <span style={{ "--gauge": "194deg" } as CSSProperties}><i />72</span>
                    <span style={{ "--gauge": "238deg" } as CSSProperties}><i />88</span>
                    <span style={{ "--gauge": "173deg" } as CSSProperties}><i />64</span>
                  </div>
                  <div className="power-matrix">
                    {dashboardTelemetry.matrixDelays.map((delay, index) => (
                      <i
                        key={`${dashboardTelemetry.scanId}-matrix-${index}`}
                        style={{ animationDelay: `${delay}s` }}
                      />
                    ))}
                  </div>
                  <div className="glyph-strip">ᒪ ∷ ⧫ ⌇ ᖵ ◌ ⊢</div>
                </section>
                <div className="throttle-cluster">
                  <span className="throttle throttle-one"><i /></span>
                  <span className="throttle throttle-two"><i /></span>
                </div>
                <div className="system-lights">
                  <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
                </div>
              </div>
              <div className="pilot-seat pilot-seat-left" />
              <div className="pilot-seat pilot-seat-right" />
              <div className="control-yoke control-yoke-left"><i /></div>
              <div className="control-yoke control-yoke-right"><i /></div>
            </div>
          )}

          {focusDuration && (
            <div
              className="focus-hud"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="focus-hud-brand">
                <span className="brand-mark" aria-hidden="true" />
                <span>DRIFT focus</span>
                <small>{focusDuration} minute voyage</small>
              </div>
              <div className="focus-clock" aria-live="polite">
                <span>
                  {remainingSeconds === 0
                    ? "Orbit complete"
                    : sessionPaused
                      ? "Holding still"
                      : flightPhase === "hyperspace"
                        ? "Leaving the noise"
                        : "Focus orbit"}
                </span>
                <strong>{focusTime}</strong>
                <div
                  className="flight-progress"
                  role="progressbar"
                  aria-label="Focus voyage completion"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={focusProgressPercent}
                  style={
                    {
                      "--focus-progress": `${focusProgress}%`,
                      "--rocket-position": `${rocketPosition}%`,
                    } as CSSProperties
                  }
                >
                  <div className="progress-copy">
                    <span>Voyage</span>
                    <b>{focusProgressPercent}%</b>
                  </div>
                  <div className="progress-track">
                    <span className="progress-fill" />
                    <span className="progress-rocket"><i /></span>
                  </div>
                </div>
                <i aria-hidden="true" />
              </div>
              <div className="focus-hud-controls">
                <button
                  type="button"
                  onClick={toggleSessionPause}
                  disabled={remainingSeconds === 0}
                >
                  {sessionPaused && remainingSeconds > 0 ? "Continue" : "Pause"}
                </button>
                <label>
                  <span>Cabin</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(volume * 100)}
                    onChange={(event) =>
                      void handleVolumeChange(Number(event.target.value) / 100)
                    }
                    aria-label="Focus session sound volume"
                  />
                </label>
                <button type="button" onClick={endFocusSession}>
                  Exit session
                </button>
              </div>
            </div>
          )}

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

          {deepScan && (
            <span
              className={`deep-space-scan scan-${deepScan.mode}`}
              key={deepScan.id}
              style={{ "--scan-x": `${deepScan.x}%`, "--scan-y": `${deepScan.y}%` } as CSSProperties}
              aria-hidden="true"
            >
              <span className="scan-lens" />
              <span className="scan-orbit"><i /><i /></span>
              <small>DEEP SCAN</small>
            </span>
          )}

          <p className="field-coordinate" aria-live="polite">
            {solarPhase === "incoming"
              ? "Incoming object · this seems unwise"
              : solarPhase === "detonation"
                ? "Solar integrity · 0%"
                : solarPhase === "aftermath"
                  ? "Sun offline · please stand by"
                  : solarPhase === "rebirth"
                    ? "Stellar reboot · 87%"
                    : activeFeature === "craft"
                      ? "Orbital craft · deployment nominal"
                      : activeFeature === "meteors"
                        ? "Meteor shower · look up"
                        : activeFeature === "eclipse"
                          ? "Totality · light falling"
                    : visitor === "rocket"
              ? "Local transit · RV—01"
              : visitor === "alien"
                ? "Unidentified visitor · seems friendly"
                : "Quiet sector · breathe slowly"}
          </p>
          <p className="field-hint">
            <span aria-hidden="true">↖</span> Tap to settle · double-click to scan
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
            <div className="field-actions">
              <button
                className="nuke-button"
                type="button"
                onClick={() => void nukeSun()}
                disabled={solarPhase !== "idle" || activeFeature !== null}
                aria-label="Launch a fictional missile at the sun"
              >
                <span className="nuke-emoji" aria-hidden="true">🚀︎</span>
                {solarStatus[solarPhase]}
              </button>
              <button
                className="feature-button"
                type="button"
                onClick={() => void triggerFeature("craft")}
                disabled={solarPhase !== "idle" || activeFeature !== null}
              >
                <span aria-hidden="true">◇</span>
                Deploy craft
              </button>
              <button
                className="feature-button"
                type="button"
                onClick={() => void triggerFeature("meteors")}
                disabled={solarPhase !== "idle" || activeFeature !== null}
              >
                <span aria-hidden="true">☄︎</span>
                Meteors
              </button>
              <button
                className="feature-button"
                type="button"
                onClick={() => void triggerFeature("eclipse")}
                disabled={solarPhase !== "idle" || activeFeature !== null}
              >
                <span aria-hidden="true">◐</span>
                Eclipse
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="statusbar">
        <p>
          <span className="status-pulse" aria-hidden="true" />
          Orbit {isActive ? "awake" : "resting"}
        </p>
        <p className="mode-readout">
          {currentMode.label} <span>{currentMode.note}</span>
        </p>
        <p className="signal-count">
          {String(signalCount).padStart(2, "0")} star{signalCount === 1 ? "" : "s"} placed
        </p>
      </footer>
    </main>
  );
}
