// Portfolio content. Everything the site says comes from this file; edit freely.
//
// Text can be a plain string or a per-language object: { en: 'Hello', fr: 'Bonjour', de: 'Hallo' }.
// Save titles use "\n" where the console would break the line (two lines at most).
//
// A save's `icon` picks a 3D model for it: monitor, floppy, disc, cube, gem, book, controller, rocket, terminal,
// globe, robot, note, camera, gear, star, heart, badge, cartridge. `color` tints it, `label` is printed on it.
// `bg` is the four-corner background of the save screen (top-left, top-right, bottom-left, bottom-right),
// exactly like icon.sys on a real memory card. `size` is in KB and `date` is "YYYY/MM/DD HH:MM:SS".
window.PORTFOLIO = {
  name: 'Elyes Zguem',
  role: 'Developer & Designer',
  bootText: 'Elyes Zguem presents',

  // Version Information (Triangle on the main menu). `menu` opens an option page:
  // console = Diagnosis, driver = Disc Speed / Texture Mapping (both work), profile and contact = the lists below.
  about: [
    { labelKey: 'console', value: 'EZ2', menu: 'console' },
    { label: 'Profile', value: 'Developer & Designer', menu: 'profile' },
    { label: 'Contact', value: 'Click For Details', menu: 'contact' },
    { labelKey: 'browser', value: '2.00' },
    { labelKey: 'cdplayer', value: '2.00' },
    { labelKey: 'driver', value: '1.11', menu: 'driver' },
  ],
  profileTitle: 'Elyes',
  profile: [
    ['Role', 'Developer & Designer'],
    ['Focus', 'Web, games, tools'],
    ['Console', 'Elyes Computer Entertainment'],
  ],
  contactTitle: 'Contact',
  contact: [
    { label: 'Discord', value: 'elyesgmzboi', url: '' },
    { label: 'GitHub', value: 'Elyes Zguem', url: 'https://github.com/elyesgmzboi' },
    { label: 'Instagram', value: 'Lyes', url: 'https://instagram.com/elyesgmzboi' },
  ],

  // Memory cards in the Browser. Each save is a project.
  cards: [
    {
      name: 'Projects',
      free: 5330,
      saves: [
        {
          title: 'PS2 OSD\nPortfolio', icon: { model: 'monitor', color: '#3b6cff', label: 'S2' }, size: 1024, date: '2026/10/01 12:00:00',
          type: 'Web Application', stack: 'three.js, WebGL, Web Audio',
          desc: 'This site: the PlayStation 2 system menu rebuilt for the browser. Boot sequence, orbs, memory card browser and System Configuration, all driven by the same frame counter the console uses.',
          url: '', source: '',
          bg: ['#1c2f7a', '#452080', '#0a3b66', '#0b0f2e'],
        },
        {
          title: 'Opening\nSequence', icon: { model: 'disc', color: '#4a6cff' }, size: 768, date: '2026/10/01 09:30:00',
          type: 'Real-time Scene', stack: 'WebGL, ROM reverse engineering',
          desc: 'The startup scene ported from the console ROM: a field of towers built from a memory card history, six layers of scrolling fog, four lights with trails and five glass cubes, under the original camera curve.',
          url: '', source: '',
          bg: ['#0b1a5a', '#1a0b4a', '#06123a', '#02030c'],
        },
        {
          title: 'System\nConfiguration', icon: { model: 'gear', color: '#3fa9ff' }, size: 1536, date: '2026/09/28 14:07:00',
          type: 'Interactive Scene', stack: 'GS emulation in GLSL',
          desc: 'The clock of glass rods and the floating cubes, rendered the way the PS2 Graphics Synthesizer does it: screen-space refraction, 8-bit blending and the always-on zoom blur. Every setting works.',
          url: '', source: '',
          bg: ['#1a3a7a', '#3a2070', '#0a2a5a', '#060a20'],
        },
        {
          title: 'The Orbs', icon: { model: 'gem', color: '#48c8f6' }, size: 312, date: '2026/09/28 13:44:00',
          type: 'Animation', stack: 'JavaScript',
          desc: 'The seven orbs are a clock: the ring turns with the seconds, tilts with the hour and grows over the hour, each orb lapping it 21 to 27 times a minute. Checked against a console capture to within 3 px.',
          url: '', source: '',
          bg: ['#0c4a7a', '#10306a', '#08304a', '#030a18'],
        },
        {
          title: 'Memory Card\nBrowser', icon: { model: 'floppy', color: '#39c6ff', label: 'MC' }, size: 640, date: '2026/10/01 10:15:00',
          type: 'Interface', stack: 'three.js',
          desc: 'Where this portfolio lives. Each project is a save with its own icon and its own four-corner background, just like icon.sys on a real memory card.',
          url: '', source: '',
          bg: ['#0c5a82', '#0b2a5a', '#083a52', '#030a14'],
        },
        {
          title: 'Console\nSounds', icon: { model: 'heart', color: '#ff4f7b' }, size: 860, date: '2026/10/01 10:40:00',
          type: 'Audio', stack: 'Web Audio',
          desc: 'The cursor, enter and back sounds, the startup chime and the menu hums are cut from recordings of the console, matched to a capture by spectral correlation.',
          url: '', source: '',
          bg: ['#7a1c3c', '#2a0f40', '#5a0a22', '#120612'],
        },
      ],
    },
    {
      name: 'Lab',
      free: 145,
      saves: [
        {
          title: 'ROM\nResearch', icon: { model: 'terminal', color: '#c9f24a' }, size: 256, date: '2026/09/28 10:00:00',
          type: 'Reference', stack: 'aap/osdbits',
          desc: 'The ground truth behind the recreation: the reverse-engineered OSDSYS ROM in aap/osdbits. Camera, tunnel, glass and orbit maths all come from it.',
          url: 'https://github.com/aap/osdbits', source: '',
          bg: ['#4a6a0a', '#0a4a3a', '#2a3a06', '#060c04'],
        },
        {
          title: 'Glass\nShaders', icon: { model: 'cube', color: '#ff6bd6', label: 'FX' }, size: 128, date: '2026/09/28 14:09:00',
          type: 'Experiment', stack: 'GLSL',
          desc: 'Fake refraction the PS2 way: sample the finished screen, offset by the projected normal, then layer scrolling environment maps keyed on what is behind.',
          url: '', source: '',
          bg: ['#7a1c6b', '#1c2f7a', '#3a0a3a', '#0a0616'],
        },
        {
          title: 'Your System\nConfiguration', icon: { model: 'cartridge', color: '#9aa0a8' }, size: 5, date: '2026/10/01 12:00:00',
          type: 'System', stack: '',
          desc: 'Settings for this console. Change them in System Configuration.',
          url: '', source: '', system: true,
          bg: ['#10205a', '#301060', '#081a40', '#02030c'],
        },
      ],
    },
  ],

  // The disc in the Browser: the featured project. Enter plays the logo, then its title screen.
  disc: {
    title: 'Featured Project', icon: { model: 'disc', color: '#3b6cff' },
    type: 'Featured', stack: 'three.js, WebGL',
    desc: 'The PS2 OSD portfolio itself.',
    url: '', source: '',
    bg: ['#10205a', '#301060', '#081a40', '#02030c'],
  },
};
