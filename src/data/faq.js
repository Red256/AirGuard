import { BANDS, HUMIDITY_BAND, TEMP_BAND } from './levels';

const n = (v) => v.toLocaleString('en-US');

// Ranges shown in the FAQ come from the same constants the app uses to grade readings,
// so the FAQ always matches what the app actually does.
export function levelRows() {
  const air = (label, unit, band) => ({
    label,
    unit,
    good: `≤ ${n(band.good)}`,
    moderate: `${n(band.good + 1)}–${n(band.moderate)}`,
    bad: `> ${n(band.moderate)}`,
  });
  const ranged = (label, unit, b) => ({
    label,
    unit,
    good: `${b.goodMin}–${b.goodMax}`,
    moderate: `${b.goodMin - b.margin}–${b.goodMin - 1} or ${b.goodMax + 1}–${b.goodMax + b.margin}`,
    bad: `< ${b.goodMin - b.margin} or > ${b.goodMax + b.margin}`,
  });
  return [
    air('Indoor CO₂', 'ppm', BANDS.co2),
    air('Indoor PM2.5', 'µg/m³', BANDS.pmIndoor),
    air('Outdoor PM2.5', 'µg/m³', BANDS.pmOutdoor),
    ranged('Temperature', '°F', TEMP_BAND),
    ranged('Humidity', '%', HUMIDITY_BAND),
  ];
}

const rangeLines = () =>
  levelRows()
    .map((r) => `• ${r.label} (${r.unit}): Good ${r.good}, Moderate ${r.moderate}, Unhealthy ${r.bad}`)
    .join('\n');

export const LEVEL_CARDS = [
  { level: 'good', icon: '🟢', title: 'Good', text: 'Healthy air. Nothing to do.' },
  { level: 'moderate', icon: '🟠', title: 'Moderate', text: 'Not ideal, so keep an eye on it. No alert is sent.' },
  { level: 'bad', icon: '🔴', title: 'Unhealthy', text: 'Act now. An alert appears and AirGuard suggests what to do.' },
];

// Same shape as the Coyote Alert FAQ: categories of questions, answers written as bullet lines.
export function getFaqCategories() {
  return [
    {
      id: 1,
      category: 'The Basics',
      icon: '💡',
      questions: [
        {
          question: 'What does AirGuard do?',
          answer:
            'AirGuard keeps an eye on the air in and around your home:\n• Tracks indoor CO₂, indoor PM2.5, outdoor PM2.5, temperature and humidity\n• Warns you when a reading is Unhealthy\n• Suggests what to do about it',
        },
        {
          question: 'What do Good, Moderate and Unhealthy mean?',
          answer:
            'Every reading gets one of three levels:\n• Good (green): healthy, nothing to do\n• Moderate (orange): not ideal, so keep an eye on it. No alert is sent\n• Unhealthy (red): act now. AirGuard raises an alert and suggests what to do',
        },
        {
          question: 'Is the data in the app real?',
          answer:
            'Yes, by default. AirGuard reads the sensor node in your home:\n• A Sensirion SEN66 on a Particle Boron measures the air and publishes every 5 minutes\n• The readings go to a cloud database, and the app reads the newest one\n• Outdoor PM2.5 is the exception: nothing measures it yet, so it shows as No data\n• You can switch to simulated readings on the Alerts tab to see how the app responds to bad air',
        },
        {
          question: 'Why does a reading say "No data"?',
          answer:
            'A reading is only shown when the sensor actually reported it:\n• Outdoor PM2.5 has no sensor connected, so it is always No data for now\n• The node leaves out a channel for the first few seconds after it starts up, while that part of the sensor warms up\n• If everything says No data, the app has not heard from your node — check that it is powered and online',
        },
      ],
    },
    {
      id: 2,
      category: 'Your Readings',
      icon: '📊',
      questions: [
        {
          question: 'What are the Good, Moderate and Unhealthy ranges?',
          answer: `Each reading has its own ranges:\n${rangeLines()}\n• Temperature and humidity have a comfortable middle range. They never trigger alerts`,
        },
        {
          question: 'What is CO₂ and why does it matter indoors?',
          answer:
            '• Carbon dioxide builds up indoors from breathing, especially in closed rooms\n• Outdoor air is about 420 ppm\n• High indoor CO₂ makes air feel stale and can cause drowsiness, headaches and trouble concentrating\n• Fresh air brings it back down',
        },
        {
          question: 'What is PM2.5?',
          answer:
            '• Fine particles 2.5 micrometers or smaller, about 1/30th the width of a human hair\n• They come from smoke, traffic, dust and cooking\n• They are small enough to reach deep into your lungs, so lower is better\n• AirGuard tracks indoor and outdoor PM2.5 separately',
        },
        {
          question: 'Why is a reading orange but I got no alert?',
          answer:
            'Orange means Moderate.\n• AirGuard only raises an alert when a reading is Unhealthy (red)\n• Moderate readings stay quiet',
        },
      ],
    },
    {
      id: 3,
      category: 'Alerts',
      icon: '🔔',
      questions: [
        {
          question: 'When do I get an alert?',
          answer:
            '• Only when indoor CO₂, indoor PM2.5 or outdoor PM2.5 becomes Unhealthy\n• Moderate readings do not trigger an alert\n• Temperature and humidity never do',
        },
        {
          question: 'What should I do when I see an alert?',
          answer:
            'Tap the alert to see a suggestion. In general:\n• Unhealthy outdoor air: keep windows and doors closed, set your HVAC to recirculate, and run a HEPA air purifier if you have one\n• Unhealthy indoor particles: check for cooking fumes, smoke and candles, use the kitchen exhaust, and ventilate if the air outside is clean\n• Unhealthy CO₂: open a window for 5 to 10 minutes if the air outside is clean',
        },
        {
          question: 'Why does it say keep windows closed when CO₂ is Unhealthy?',
          answer:
            '• If the air outside is Unhealthy too, opening a window would let particles in\n• Unhealthy outdoor air takes priority\n• AirGuard tells you to keep windows closed and use filtration instead',
        },
        {
          question: 'When does an alert end?',
          answer:
            '• As soon as the reading drops back to Moderate or Good\n• It then moves from Current alerts to Past alerts\n• Past alerts show the peak value and how long it lasted',
        },
      ],
    },
    {
      id: 4,
      category: 'Using the App',
      icon: '📱',
      questions: [
        {
          question: 'How do I get a suggestion for a reading?',
          answer:
            '• On the Home tab, any reading that is Unhealthy is outlined in red and says "Tap for suggestion"\n• Tap it to see what to do\n• You can also tap an alert on the Alerts tab',
        },
        {
          question: 'Where can I see past alerts?',
          answer:
            '• On the Alerts tab, under Past alerts\n• They are grouped by day\n• Each one shows the peak reading, the time range and how long it lasted',
        },
        {
          question: 'How often do readings update?',
          answer:
            '• The node measures every second and publishes every 5 minutes\n• The app updates the moment a new reading lands, with no need to refresh\n• "Updated" at the bottom of the Home tab is the age of the reading itself, not of the app',
        },
        {
          question: 'What does the Analytics tab show?',
          answer:
            '• Charts of indoor CO₂, indoor PM2.5 and outdoor PM2.5, built from the readings your node has published\n• Switch between the last 24 hours, 7 days or 30 days\n• A break in a line means the node was offline for that stretch\n• Tap the info button on a chart to see what it measures',
        },
      ],
    },
  ];
}
