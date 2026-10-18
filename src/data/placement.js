// How a node's placement decides what it contributes, and how several nodes
// fold into the one reading set the screens grade and draw. Kept apart from
// SensorContext so it is plain data logic, testable without React.

// Nothing has been read yet. Every channel is 'No data' rather than zero.
export const NO_READINGS = { co2: null, pmIndoor: null, pmOutdoor: null, temp: null, rh: null };

// Which readings each placement is allowed to supply. A node only fills the
// slots it can actually speak to, so an outdoor node never claims a CO₂ value
// and an indoor node never claims to know the air outside.
export const SLOTS = {
  indoor: ['co2', 'pmIndoor', 'temp', 'rh'],
  outdoor: ['pmOutdoor', 'temp', 'rh'],
};

// Temperature and humidity exist on both placements, so indoor wins when both
// are registered: the app presents them as the conditions you are sitting in.
const PREFER_INDOOR = ['temp', 'rh'];

// `per` is { [deviceId]: { reading, at, placement } }. Returns the merged
// readings, the newest contributing timestamp, and which node filled each slot
// (so a screen can say where a temperature was measured).
export function mergeReadings(devices, per) {
  const readings = { ...NO_READINGS };
  const sources = {};
  let updatedAt = null;

  for (const device of devices) {
    const entry = per[device.id];
    if (!entry || !entry.reading) continue;
    for (const slot of SLOTS[device.placement] || []) {
      const value = entry.reading[slot];
      if (value == null) continue;
      const taken = sources[slot];
      // First writer wins, except that an indoor node may take temp/rh from an
      // outdoor one, and a newer sample beats an older one from the same side.
      const beats =
        !taken ||
        (PREFER_INDOOR.includes(slot) && device.placement === 'indoor' && taken.placement === 'outdoor') ||
        (taken.placement === device.placement && entry.at > taken.at);
      if (!beats) continue;
      readings[slot] = value;
      sources[slot] = { deviceId: device.id, placement: device.placement, at: entry.at };
    }
    if (entry.at != null && (updatedAt == null || entry.at > updatedAt)) updatedAt = entry.at;
  }

  return { readings, updatedAt, sources };
}
