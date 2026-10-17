import { BANDS } from './levels';

const n = (v) => v.toLocaleString('en-US');

// Ranges shown in Resources come from the same constants the app uses to grade readings,
// so the text always matches what the app actually does.
export function levelRows() {
  const air = (label, unit, band) => ({
    label,
    unit,
    good: `≤ ${n(band.good)}`,
    moderate: `${n(band.good + 1)}–${n(band.moderate)}`,
    bad: `> ${n(band.moderate)}`,
  });
  return [
    air('Indoor CO₂', 'ppm', BANDS.co2),
    air('Indoor PM2.5', 'µg/m³', BANDS.pmIndoor),
    air('Outdoor PM2.5', 'µg/m³', BANDS.pmOutdoor),
  ];
}

const rangeLines = () =>
  levelRows()
    .map((r) => `• ${r.label} (${r.unit}): Good ${r.good}, Moderate ${r.moderate}, Unhealthy ${r.bad}`)
    .join('\n');

export const LEVEL_CARDS = [
  { level: 'good', icon: '🟢', title: 'Good', text: 'Healthy air. Nothing to do.' },
  { level: 'moderate', icon: '🟠', title: 'Moderate', text: 'Not ideal, so keep an eye on it.' },
  { level: 'bad', icon: '🔴', title: 'Unhealthy', text: 'Action needed. An alert appears and AirGuard suggests what to do.' },
];

// Categories of questions, answers written as bullet lines.
export function getFaqCategories() {
  return [
    {
      id: 1,
      category: 'Understand Your Air',
      icon: '🍃',
      questions: [
        {
          question: 'Why does indoor air quality matter?',
          answer:
            '• Most of us spend the majority of our time indoors, so the air inside matters a lot\n• Stale air and fine particles can affect comfort, sleep, focus and breathing\n• Indoor air can be worse than outdoor air when a space is closed up or has cooking, smoke or candles\n• Knowing what is in your air helps you act before it becomes a problem',
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
          question: 'Does a high CO₂ reading mean the air is toxic?',
          answer:
            '• No. At the levels found in homes, CO₂ is not a poison\n• It is a sign that fresh air is not getting in and that other things you breathe out or give off may be building up too\n• High CO₂ mostly means the room feels stuffy and could use fresh air',
        },
        {
          question: 'What do Good, Moderate, and Unhealthy mean?',
          answer: `Every reading gets one of three levels:\n• Good (green): healthy, nothing to do\n• Moderate (orange): not ideal, so keep an eye on it\n• Unhealthy (red): action needed. AirGuard raises an alert and suggests what to do\n\nThe ranges:\n${rangeLines()}`,
        },
      ],
    },
    {
      id: 2,
      category: 'Readings & Trends',
      icon: '📊',
      questions: [
        {
          question: 'Why does AirGuard measure both indoor and outdoor PM2.5?',
          answer:
            '• Comparing the two shows where particles are coming from\n• If outdoor PM2.5 is high, opening a window can make your air worse\n• If indoor PM2.5 is high and outdoor is low, the source is probably inside your home\n• The best action depends on both numbers',
        },
        {
          question: 'Why might indoor PM2.5 suddenly increase?',
          answer:
            '• Cooking, especially frying or burning food\n• Candles, incense, fireplaces or smoking\n• Cleaning, vacuuming or stirring up dust\n• Smoky outdoor air getting inside\n• Check for these sources first, then ventilate if the air outside is clean',
        },
        {
          question: 'Why does AirGuard show historical data?',
          answer:
            '• The Trends tab shows indoor CO₂, indoor PM2.5 and outdoor PM2.5 over the last 24 hours, 7 days or 30 days\n• Trends help you spot patterns, like CO₂ building up overnight or particles spiking at dinner time\n• Patterns make it easier to change habits so alerts happen less often',
        },
        {
          question: 'Is the data in the app real?',
          answer:
            'Yes. Every number in the app comes from the node you registered:\n• A Sensirion SEN66 on a Particle Boron measures the air and publishes every 5 minutes\n• The readings go to a cloud database, and the app reads the newest one\n• Outdoor PM2.5 is the exception: nothing measures it yet, so it shows as No data\n• There is no demo or simulated mode — if a reading is blank, the sensor did not report it',
        },
        {
          question: 'How do I connect my node to the app?',
          answer:
            'AirGuard shows readings from one node, which you register the first time you open the app:\n• Enter the 24-character device id from the Particle console or the label on your node\n• AirGuard checks that the id has published readings before saving it\n• The id is stored on your phone, so you only do this once\n• To point the app at a different node, tap "Registered node" at the bottom of the Alerts tab',
        },
        {
          question: 'Why does a reading say "No data"?',
          answer:
            'A reading is only shown when the sensor actually reported it:\n• Outdoor PM2.5 has no sensor connected, so it is always No data for now\n• The node leaves out a channel for the first few seconds after it starts up, while that part of the sensor warms up\n• If everything says No data, the app has not heard from your node — check that it is powered and online',
        },
        {
          question: 'How often do readings update?',
          answer:
            '• The node measures every second and publishes every 5 minutes\n• The app updates the moment a new reading lands, with no need to refresh\n• "Updated" at the bottom of the Home tab is the age of the reading itself, not of the app',
        },
        {
          question: 'Why is a reading orange but I did not get an alert?',
          answer:
            'Orange means Moderate.\n• AirGuard only raises an alert when a reading is Unhealthy (red)\n• Moderate readings stay quiet, but they are worth watching',
        },
        {
          question: 'When will AirGuard send me an alert?',
          answer:
            '• Only when indoor CO₂, indoor PM2.5 or outdoor PM2.5 becomes Unhealthy\n• Moderate readings do not trigger an alert\n• The alert ends as soon as the reading drops back to Moderate or Good\n• It then moves from Current alerts to Past alerts, which show the peak value and how long it lasted',
        },
      ],
    },
    {
      id: 3,
      category: 'What Should I Do?',
      icon: '✅',
      questions: [
        {
          question: 'When should I ventilate my home?',
          answer:
            '• When indoor CO₂ is Unhealthy and the air outside is clean\n• Open a window or door for 5 to 10 minutes\n• AirGuard shows Ventilate Now when this is the case',
        },
        {
          question: 'When should I keep my windows closed?',
          answer:
            '• When outdoor PM2.5 is Unhealthy, for example during smoke or heavy pollution\n• Keep windows and doors closed, set your HVAC to recirculate, and run a HEPA air purifier if you have one\n• AirGuard shows Keep Windows Closed when this is the case',
        },
        {
          question: 'What should I do if indoor PM2.5 is high?',
          answer:
            '• Check for cooking fumes, smoke and candles and put them out or stop them if you can\n• Use the kitchen exhaust fan\n• Run a HEPA air purifier if you have one\n• Ventilate if the air outside is clean',
        },
        {
          question: 'Why can’t I just open a window whenever CO₂ is high?',
          answer:
            '• Opening a window brings outdoor air in, whatever is in it\n• If outdoor PM2.5 is Unhealthy, you would trade stale air for polluted air\n• So AirGuard checks the air outside first and only says to ventilate when it is clean',
        },
        {
          question: 'What does “Ventilate and Check Indoor Sources” mean?',
          answer:
            '• Indoor PM2.5 is Unhealthy and the air outside is clean\n• Check for what is putting particles in the air, like cooking, smoke or candles\n• Open a window to let clean air in while you deal with the source',
        },
        {
          question: 'Can AirGuard help during wildfire smoke?',
          answer:
            '• Yes. Wildfire smoke raises outdoor PM2.5, and AirGuard shows Keep Windows Closed when it becomes Unhealthy\n• Keep windows and doors closed and run a HEPA purifier if you have one\n• Watch indoor PM2.5 to see how well your home is holding up\n• Follow local health guidance for your area',
        },
      ],
    },
    {
      id: 4,
      category: 'About AirGuard',
      icon: 'ℹ️',
      badge: 'info',
      questions: [
        {
          question: 'What makes AirGuard different from a normal air-quality monitor?',
          answer:
            '• It looks at indoor and outdoor air together, not just one number\n• It turns readings into a clear action, like open a window or keep it closed\n• It only alerts you when something is Unhealthy, so alerts stay meaningful',
        },
        {
          question: 'Is AirGuard a medical device?',
          answer:
            '• No. AirGuard gives general information about your air, not medical advice\n• It cannot diagnose or treat any condition\n• If you have a health concern, talk to a healthcare professional',
        },
        {
          question: 'How does AirGuard decide whether I should ventilate?',
          answer:
            '• If outdoor PM2.5 is Unhealthy, it says to keep windows closed\n• Otherwise, if indoor PM2.5 is Unhealthy, it says to ventilate and check indoor sources\n• Otherwise, if indoor CO₂ is Unhealthy, it says to ventilate now\n• If nothing is Unhealthy, no action is needed',
        },
        {
          question: 'Why does AirGuard compare indoor and outdoor air?',
          answer:
            '• Fresh air is the fix for stale indoor air, but only when the air outside is clean\n• Comparing the two tells you whether opening a window will help or hurt\n• It also helps tell apart pollution coming from inside and from outside',
        },
      ],
    },
  ];
}
